import { getClient, content } from './cms-client.js';
import { applyContent } from './cms-render.js';
if (window.CMS_CONFIG?.url && window.CMS_CONFIG?.publishableKey) {
  try {
    const rows = await content(await getClient());
    if (!rows.some(r=>r.id==='settings')) throw new Error('Начальные данные CMS ещё не импортированы.');
    applyContent(rows.filter(row=>row.published));
  } catch(error) { console.warn('CMS: показано исходное содержимое сайта.', error.message); }
}
