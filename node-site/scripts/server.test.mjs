import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createApp } from '../server.mjs';

await mkdir('.qa', { recursive: true });
const temp = await mkdtemp(path.resolve('.qa/server-'));
const options = { dataDir: path.join(temp,'data'), uploadsDir: path.join(temp,'uploads'), password:'test-password-for-local-checks' };
let server = await createApp(options);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let origin = `http://127.0.0.1:${server.address().port}`;
let cookie = '';
const call = (url, method = 'GET', body, auth = false, customOrigin = origin) => fetch(`${origin}${url}`, {method,headers:{Origin:customOrigin,...(body ? {'Content-Type':'application/json'} : {}),...(auth ? {Cookie:cookie} : {})},body:body ? JSON.stringify(body) : undefined});
try {
  await test('public content and assets work; private files are inaccessible', async () => {
    for (const route of ['/', '/admin', '/styles.css', '/app.js', '/assets/pottery.svg', '/assets/fonts/ruslan-display.ttf']) assert.equal((await call(route)).status,200,route);
    for (const route of ['/data/admin-password.txt', '/data/requests.json', '/server.mjs', '/api/admin/requests']) assert.ok([401,404].includes((await call(route)).status),route);
    assert.equal((await (await call('/api/content')).json()).bookingEnabled,false);
  });
  await test('login rejects wrong passwords and foreign origins', async () => {
    assert.equal((await call('/api/admin/login','POST',{password:options.password},false,'https://unrelated.example')).status,403);
    assert.equal((await call('/api/admin/login','POST',{password:'wrong'})).status,401);
    const r = await call('/api/admin/login','POST',{password:options.password}); assert.equal(r.status,200); cookie = r.headers.get('set-cookie').split(';')[0];
    assert.equal((await call('/api/admin/session','GET',null,true)).status,200);
  });
  const content = await (await call('/api/content')).json();
  await test('legacy section copy is normalized; guest courses and section edits are validated', async () => {
    assert.equal(content.copy.classesTitle,'Что сотворим?');
    const guest={...content.courses[0],id:'guest-check',category:'guest',title:'Гостевой мастер-класс'};
    const changed={...content,courses:[...content.courses,guest],copy:{...content.copy,classesTitle:'Ремесленные занятия'}};
    assert.equal((await call('/api/admin/content','PUT',changed,true)).status,200);
    assert.equal((await (await call('/api/content')).json()).copy.classesTitle,'Ремесленные занятия');
    assert.equal((await call('/api/admin/content','PUT',{...changed,copy:{classesTitle:'a'.repeat(3001)}},true)).status,400);
    assert.equal((await call('/api/admin/content','PUT',content,true)).status,200);
  });
  await test('disabled booking rejects applications and content is validated', async () => {
    assert.equal((await call('/api/requests','POST',{})).status,409);
    assert.equal((await call('/api/admin/content','PUT',{...content,bookingEnabled:true},true)).status,400);
    assert.equal((await call('/api/admin/content','PUT',{...content,heroImage:'javascript:alert(1)'},true)).status,400);
    assert.equal((await call('/api/admin/content','PUT',{...content,socialUrl:'javascript:alert(1)'},true)).status,400);
    assert.equal((await call('/api/admin/content','PUT',{...content,sessions:[{id:'x',courseId:'wheel',date:'2027-02-30',time:'12:00',note:''}]},true)).status,400);
    const enabled = {...content,phone:'+7 999 000-00-00',bookingEnabled:true};
    assert.equal((await call('/api/admin/content','PUT',enabled,true)).status,200);
  });
  await test('booking validates consent, persists, and deduplicates retries', async () => {
    const body = {name:'Тестовый посетитель',phone:'+7 999 111-22-33',comment:'Тестовая заявка',courseId:'wheel',sessionId:'',consent:true,requestId:'unique-test-request'};
    assert.equal((await call('/api/requests','POST',{...body,consent:false})).status,400);
    const r1 = await (await call('/api/requests','POST',body)).json();
    const r2 = await (await call('/api/requests','POST',body)).json();
    assert.ok(r1.id); assert.equal(r1.id,r2.id);
    const requests = await (await call('/api/admin/requests','GET',null,true)).json(); assert.equal(requests.length,1); assert.equal(requests[0].name,body.name);
    assert.equal(JSON.parse(await readFile(path.join(options.dataDir,'requests.json'),'utf8')).length,1);
  });
  await test('upload rejects scripts and accepts image signatures', async () => {
    const headers = {Origin:origin,Cookie:cookie};
    assert.equal((await fetch(`${origin}/api/admin/upload`,{method:'POST',headers,body:'<svg onload="alert(1)"></svg>'})).status,400);
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
    const uploaded = await fetch(`${origin}/api/admin/upload`,{method:'POST',headers,body:png}); assert.equal(uploaded.status,201);
    const {image} = await uploaded.json(); assert.equal((await call(image)).status,200);
  });
  await test('content and requests survive restart; sessions expire on restart', async () => {
    await new Promise(resolve => server.close(resolve)); server = await createApp(options);
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve)); origin = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await (await call('/api/content')).json()).bookingEnabled,true);
    assert.equal((await call('/api/admin/requests','GET',null,true)).status,401);
    const r = await call('/api/admin/login','POST',{password:options.password}); cookie = r.headers.get('set-cookie').split(';')[0];
    const requests = await (await call('/api/admin/requests','GET',null,true)).json(); assert.equal(requests.length,1);
    assert.equal((await call('/api/admin/requests','DELETE',{id:requests[0].id},true)).status,200);
    assert.deepEqual(await (await call('/api/admin/requests','GET',null,true)).json(),[]);
  });
} finally { await new Promise(resolve => server.close(resolve)); }
