export const BUCKET = 'site-images';
export const MAX_FILE = 5 * 1024 * 1024;
let client;
export async function getClient() {
  if (client) return client;
  const c = window.CMS_CONFIG;
  if (!c?.url || !c?.publishableKey) throw new Error('Подключите Supabase в cms-config.js по инструкции ADMIN_SETUP.md.');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(c.url)) throw new Error('Неверный адрес проекта Supabase.');
  if (c.publishableKey.startsWith('sb_secret_')) throw new Error('В браузере разрешён только publishable key.');
  // Lazy import: public fallback works even when the CDN is unavailable.
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.49.1');
  client = createClient(c.url, c.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storage: window.sessionStorage } });
  return client;
}
export async function content(db) {
  const rows = [];
  for (let offset=0; ; offset+=500) {
    const { data, error } = await db.from('site_content').select('*').order('position').order('id').range(offset,offset+499);
    if (error) throw error;
    rows.push(...data);
    if (data.length<500) return rows;
  }
}
export function safeURL(value, image = false) {
  if (typeof value !== 'string' || !value.trim()) return '';
  if (/^assets\/[a-z0-9._-]+$/i.test(value)) return new URL(value, new URL('./', import.meta.url)).href;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || (!image && ['tel:', 'mailto:'].includes(url.protocol))) return url.href;
  } catch { /* Invalid URL */ }
  return '';
}
export async function validateImage(file) {
  if (!file || file.size > MAX_FILE || file.size === 0) throw new Error('Выберите изображение размером до 5 МБ.');
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const type = b[0]===255 && b[1]===216 && b[2]===255 ? 'image/jpeg' :
    [137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v) ? 'image/png' :
    String.fromCharCode(...b.slice(0,4))==='RIFF' && String.fromCharCode(...b.slice(8,12))==='WEBP' ? 'image/webp' : '';
  if (!type || file.type !== type) throw new Error('Допустимы только настоящие JPG, PNG и WebP.');
  const bitmap = await createImageBitmap(file);
  const valid = bitmap.width <= 12000 && bitmap.height <= 12000;
  bitmap.close();
  if (!valid) throw new Error('Максимальное разрешение — 12000 × 12000.');
  return type;
}
