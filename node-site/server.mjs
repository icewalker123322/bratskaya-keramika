import http from 'node:http';
import { readFile, writeFile, rename, mkdir, readdir, copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyDefaults } from './public/copy-defaults.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.mp4': 'video/mp4' };
const fail = (status, message) => Object.assign(new Error(message), { status });
const str = (value, max = 1000) => typeof value === 'string' && value.length <= max;
const imagePath = value => value === '' || (str(value, 200) && /^(?:\/uploads\/[\da-f-]+|\/assets\/brand\/[a-z0-9-]+)\.(jpg|png|webp)$/.test(value));
const safeUrl = value => value === '' || (str(value, 500) && /^https:\/\/[^\s]+$/i.test(value));
const isDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function validateContent(c) {
  if (!c || typeof c !== 'object') throw fail(400, 'Некорректные данные.');
  for(const key of ['telegramUrl','maxUrl','bookingBotUrl'])if(c[key]!==undefined&&!safeUrl(c[key]))throw fail(400,'Ссылка должна начинаться с https://');
  if(c.siteSettings!==undefined){
    if(!c.siteSettings||typeof c.siteSettings!=='object'||Array.isArray(c.siteSettings)||Object.values(c.siteSettings).some(x=>!str(x,5000)))throw fail(400,'Проверьте условия и подписи.');
  }
  if(c.novemberSchedule!==undefined){
    if(!Array.isArray(c.novemberSchedule)||c.novemberSchedule.length>62)throw fail(400,'В расписании допускается до 62 дней.');
    for(const day of c.novemberSchedule)if(!day||!str(day.day,500)||!str(day.dates,500)||!Array.isArray(day.events)||day.events.length>100||day.events.some(e=>!Array.isArray(e)||e.length<2||e.length>3||e.some(v=>!str(v,1000))))throw fail(400,'Проверьте дни, время и цены в расписании.');
  }
  if (c.copy !== undefined && (!c.copy || typeof c.copy !== 'object' || Array.isArray(c.copy))) throw fail(400, 'Проверьте тексты разделов.');
  const copy = { ...copyDefaults, ...c.copy };
  for (const key of Object.keys(copyDefaults)) if (!str(copy[key], 3000)) throw fail(400, 'Текст раздела не должен превышать 3000 символов.');
  c.copy = Object.fromEntries(Object.keys(copyDefaults).map(key => [key, copy[key]]));
  for (const key of ['name', 'tagline', 'heroTitle', 'heroText', 'aboutTitle', 'aboutText', 'phone', 'email', 'address', 'hours', 'socialUrl']) {
    if (!str(c[key], key.endsWith('Text') ? 5000 : 500)) throw fail(400, `Проверьте поле ${key}.`);
  }
  if (!c.name.trim() || !c.heroTitle.trim() || !imagePath(c.heroImage) || !imagePath(c.aboutImage) || !imagePath(c.logoImage || '') || !safeUrl(c.socialUrl) || typeof c.bookingEnabled !== 'boolean') throw fail(400, 'Проверьте название, изображения и ссылку.');
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) throw fail(400, 'Проверьте адрес электронной почты.');
  if (c.phone && !/^[\d\s()+-]{5,30}$/.test(c.phone)) throw fail(400, 'Проверьте телефон.');
  if (c.bookingEnabled && (!c.phone && !c.email)) throw fail(400, 'Для открытия записи укажите телефон или почту мастерской.');
  for (const key of ['courses', 'sessions', 'masters', 'gallery', 'faq']) if (!Array.isArray(c[key]) || c[key].length > 200) throw fail(400, `Проверьте список ${key}.`);
  const ids = new Set();
  for (const course of c.courses) {
    if (!course || !str(course.id, 80) || !/^[a-z0-9-]+$/.test(course.id) || ids.has(course.id)) throw fail(400, 'У занятий должны быть уникальные идентификаторы.');
    ids.add(course.id);
    for (const key of ['title', 'subtitle', 'description', 'details', 'price', 'duration', 'age']) if (!str(course[key], key === 'details' ? 5000 : 1000)) throw fail(400, 'Проверьте текст занятия.');
    if (!course.title.trim() || !['pottery', 'kids', 'art', 'guest'].includes(course.category) || !imagePath(course.image) || !['wheel', 'cup', 'pair', 'brush'].includes(course.art)) throw fail(400, 'Проверьте категорию и изображение занятия.');
  }
  const sessionIds = new Set();
  for (const s of c.sessions) {
    if (!s || !str(s.id, 80) || !/^[a-z0-9-]+$/.test(s.id) || sessionIds.has(s.id) || !ids.has(s.courseId) || !isDate(s.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time) || !str(s.note, 500)) throw fail(400, 'Проверьте даты, время и направления в расписании.');
    sessionIds.add(s.id);
  }
  for (const m of c.masters) if (!m || !str(m.name, 150) || !m.name.trim() || !str(m.description, 2000) || !imagePath(m.image)) throw fail(400, 'Проверьте информацию о мастере.');
  for (const g of c.gallery) if (!g || !imagePath(g.image) || !g.image || !str(g.caption, 300)) throw fail(400, 'Проверьте фотографию в галерее.');
  for (const f of c.faq) if (!f || !str(f.question, 300) || !str(f.answer, 2000)) throw fail(400, 'Проверьте вопросы и ответы.');
  return c;
}

async function readBody(req, limit = 512 * 1024) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > limit) throw fail(413, 'Файл или запрос слишком большой.'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
async function jsonBody(req) { try { return JSON.parse((await readBody(req)).toString('utf8')); } catch (e) { if (e.status) throw e; throw fail(400, 'Некорректный JSON.'); } }
async function atomic(file, value) { const tmp = `${file}.${randomUUID()}.tmp`; await writeFile(tmp, JSON.stringify(value, null, 2), { mode: 0o600 }); await rename(tmp, file); }
async function readOrCreate(file, fallback) { try { return JSON.parse(await readFile(file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; await atomic(file, fallback); return fallback; } }

export async function createApp(options = {}) {
  const dataDir = options.dataDir || process.env.DATA_DIR || path.join(root, 'data');
  const uploadsDir = options.uploadsDir || process.env.UPLOADS_DIR || path.join(publicDir, 'uploads');
  await mkdir(dataDir, { recursive: true }); await mkdir(uploadsDir, { recursive: true });
  const seedDir=path.join(publicDir,'seed-uploads');
  for(const name of await readdir(seedDir).catch(e=>{if(e.code==='ENOENT')return [];throw e;})){
    if(!/^[a-f0-9-]+\.(png|jpg|webp)$/.test(name))continue;
    await copyFile(path.join(seedDir,name),path.join(uploadsDir,name),constants.COPYFILE_EXCL).catch(e=>{if(e.code!=='EEXIST')throw e;});
  }
  const defaults = JSON.parse(await readFile(path.join(root, 'data/default.json'), 'utf8'));
  let content = validateContent(await readOrCreate(path.join(dataDir, 'content.json'), defaults));
  let requests = await readOrCreate(path.join(dataDir, 'requests.json'), []);
  let password = options.password || process.env.ADMIN_PASSWORD;
  if (!password) {
    try { password = (await readFile(path.join(dataDir, 'admin-password.txt'), 'utf8')).trim(); }
    catch (e) { if (e.code !== 'ENOENT') throw e; password = randomBytes(18).toString('base64url'); await writeFile(path.join(dataDir, 'admin-password.txt'), password, { mode: 0o600 }); }
  }
  const sessions = new Map(); const attempts = new Map(); let writeQueue = Promise.resolve();
  const serial = task => { const next = writeQueue.then(task); writeQueue = next.catch(() => {}); return next; };
  const limited = (key, limit) => {
    const now = Date.now();
    for (const [k, v] of attempts) if (v.expires < now) attempts.delete(k);
    const entry = attempts.get(key) || { count: 0, expires: now + 15 * 60 * 1000 };
    entry.count++; attempts.set(key, entry); if (entry.count > limit) throw fail(429, 'Слишком много попыток. Попробуйте через 15 минут.');
  };
  const authenticated = req => {
    for (const [token, expires] of sessions) if (expires < Date.now()) sessions.delete(token);
    const token = /(?:^|;\s*)workshop_session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
    if (!token || !sessions.has(token)) throw fail(401, 'Войдите в редактор.');
    return token;
  };
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
    const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
    try {
      const url = new URL(req.url, 'http://localhost');
      const pathname = decodeURIComponent(url.pathname);
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        if (!req.headers.origin || new URL(req.headers.origin).host !== req.headers.host) throw fail(403, 'Запрос разрешён только с этого сайта.');
      }
      if (pathname === '/api/content' && req.method === 'GET') return send(200, content);
      if (pathname === '/api/admin/login' && req.method === 'POST') {
        limited(`login:${req.socket.remoteAddress}`, 10);
        const body = await jsonBody(req); const received = Buffer.from(typeof body?.password === 'string' ? body.password : ''); const expected = Buffer.from(password);
        if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw fail(401, 'Неверный пароль.');
        const token = randomBytes(32).toString('hex'); sessions.set(token, Date.now() + 8 * 60 * 60 * 1000);
        res.setHeader('Set-Cookie', `workshop_session=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=28800${process.env.COOKIE_SECURE === '1' ? '; Secure' : ''}`);
        return send(200, { ok: true });
      }
      if (pathname.startsWith('/api/admin/')) {
        const token = authenticated(req);
        if (pathname === '/api/admin/session' && req.method === 'GET') return send(200, { ok: true });
        if (pathname === '/api/admin/logout' && req.method === 'POST') { sessions.delete(token); res.setHeader('Set-Cookie', 'workshop_session=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0'); return send(200, { ok: true }); }
        if (pathname === '/api/admin/content' && req.method === 'PUT') {
          const next = validateContent(await jsonBody(req));
          await serial(async () => { await atomic(path.join(dataDir, 'content.json'), next); content = next; });
          return send(200, { ok: true });
        }
        if (pathname === '/api/admin/requests' && req.method === 'GET') return send(200, requests);
        if (pathname === '/api/admin/requests' && req.method === 'DELETE') {
          const { id } = await jsonBody(req);
          await serial(async () => { const next = requests.filter(r => r.id !== id); await atomic(path.join(dataDir, 'requests.json'), next); requests = next; });
          return send(200, { ok: true });
        }
        if (pathname === '/api/admin/upload' && req.method === 'POST') {
          const data = await readBody(req, 6 * 1024 * 1024); let ext;
          if (data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ext = 'png';
          else if (data[0] === 255 && data[1] === 216 && data[2] === 255) ext = 'jpg';
          else if (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') ext = 'webp';
          else throw fail(400, 'Загрузите изображение JPG, PNG или WebP до 6 МБ.');
          const filename = `${randomUUID()}.${ext}`; await writeFile(path.join(uploadsDir, filename), data);
          return send(201, { image: `/uploads/${filename}` });
        }
      }
      if (pathname === '/api/requests' && req.method === 'POST') {
        limited(`request:${req.socket.remoteAddress}`, 8);
        if (!content.bookingEnabled) throw fail(409, 'Запись пока не открыта.');
        const body = await jsonBody(req);
        if (!body || !str(body.name, 100) || body.name.trim().length < 2 || !str(body.phone, 30) || !/^[+\d\s()-]{7,30}$/.test(body.phone) || body.phone.replace(/\D/g, '').length < 7 || !str(body.comment || '', 1500) || body.consent !== true || !str(body.requestId, 100)) throw fail(400, 'Проверьте имя, телефон и согласие на обработку заявки.');
        if (body.website) throw fail(400, 'Не удалось отправить заявку.');
        const course = content.courses.find(c => c.id === body.courseId); if (!course) throw fail(400, 'Выберите занятие.');
        const session = body.sessionId ? content.sessions.find(s => s.id === body.sessionId && s.courseId === course.id) : null;
        if (body.sessionId && (!session || new Date(`${session.date}T${session.time}:00+08:00`).getTime() < Date.now())) throw fail(409, 'Это занятие уже недоступно. Выберите другую дату.');
        const result = await serial(async () => {
          if (!content.bookingEnabled) throw fail(409, 'Запись пока не открыта.');
          const existing = requests.find(r => r.requestId === body.requestId); if (existing) return existing;
          if (requests.length >= 10000) throw fail(503, 'Свяжитесь с мастерской по телефону.');
          const request = { id: randomUUID(), requestId: body.requestId, createdAt: new Date().toISOString(), name: body.name.trim(), phone: body.phone.trim(), comment: (body.comment || '').trim(), course: course.title, session: session ? `${session.date} ${session.time}` : 'Дата по согласованию', consentAt: new Date().toISOString() };
          const next = [...requests, request]; await atomic(path.join(dataDir, 'requests.json'), next); requests = next; return request;
        });
        return send(201, { ok: true, id: result.id });
      }
      if (pathname.startsWith('/api/')) throw fail(404, 'Не найдено.');
      if (!['GET', 'HEAD'].includes(req.method)) throw fail(405, 'Метод не поддерживается.');
      let relative = pathname === '/' ? '/index.html' : pathname === '/admin' || pathname === '/admin/' ? '/admin.html' : pathname;
      const upload = relative.startsWith('/uploads/');
      if (upload && !/^\/uploads\/[\da-f-]+\.(png|jpg|webp)$/.test(relative)) throw fail(404, 'Не найдено.');
      const base = upload ? uploadsDir : publicDir;
      const file = path.resolve(base, upload ? relative.slice('/uploads/'.length) : `.${relative}`);
      if (!file.startsWith(base + path.sep) || relative.split('/').some(p => p.startsWith('.'))) throw fail(404, 'Не найдено.');
      const ext = path.extname(file); if (!mime[ext]) throw fail(404, 'Не найдено.');
      let data; try { data = await readFile(file); } catch (e) { if (e.code === 'ENOENT' || e.code === 'EISDIR') throw fail(404, 'Не найдено.'); throw e; }
      res.writeHead(200, { 'Content-Type': mime[ext], 'Cache-Control': ['.html', '.js', '.css'].includes(ext) ? 'no-cache' : 'public, max-age=3600' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (e) { if (!res.headersSent) send(e.status || 500, { error: e.status ? e.message : 'Не удалось выполнить запрос. Попробуйте ещё раз.' }); else res.end(); if (!e.status) console.error(e); }
  });
  server.requestTimeout = 30000;
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createApp(); const port = Number(process.env.PORT || 4173);
  server.listen(port, process.env.HOST || '127.0.0.1', () => {
    console.log(`Local: http://127.0.0.1:${port}\nEditor: http://127.0.0.1:${port}/admin\nPassword: data/admin-password.txt (or ADMIN_PASSWORD environment variable)`);
  });
}
