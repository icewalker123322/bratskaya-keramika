import { safeURL } from './cms-client.js';
const node = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
function image(d) {
  const img = node('img'); img.src = safeURL(d.image, true); img.alt = d.alt || ''; img.loading = 'lazy'; return img;
}
export function renderItem(row, index) {
  const d = row.data; let el;
  if (row.kind === 'class') {
    el = node('article','class-card'); el.dataset.category = d.category;
    const pic = node('div','class-image'); pic.append(image(d));
    const meta = node('div','class-meta'); meta.append(node('span','',d.meta1),node('span','',d.meta2));
    el.append(pic,meta,node('h3','',d.title),node('p','',d.description));
  } else if (row.kind === 'gallery') {
    el = node('button','gallery-item' + (['tall','wide'].includes(d.shape) ? ' '+d.shape : ''));
    el.dataset.image = safeURL(d.image,true); el.dataset.caption = d.caption || d.title;
    const caption = node('span','',d.title); caption.append(node('b','','↗')); el.append(image(d),caption);
  } else if (row.kind === 'benefit') {
    el=node('article','benefit-row'); const num=node('span','benefit-number',String(index+1).padStart(2,'0')); num.setAttribute('aria-hidden','true');
    const copy=node('div'); copy.append(node('h3','',d.title),node('p','',d.description)); el.append(num,copy);
  } else if (row.kind === 'faq') {
    el=node('details'); const summary=node('summary','',d.title); summary.append(node('span','','＋')); el.append(summary,node('p','',d.description));
  }
  return el;
}
export function applyContent(rows) {
  const map=new Map(rows.map(r=>[r.id,r]));
  document.querySelectorAll('[data-cms-text]').forEach(el=>{
    const row=map.get(el.dataset.cmsText); el.hidden=!row; if(row) el.textContent=row.data.text;
  });
  document.querySelectorAll('[data-cms-image]').forEach(el=>{
    const row=map.get(el.dataset.cmsImage); el.hidden=!row;
    if(row){el.src=safeURL(row.data.image,true);el.alt=row.data.alt||'';}
  });
  document.querySelectorAll('[data-cms-link]').forEach(el=>{
    const row=map.get(el.dataset.cmsLink); if(row) el.href=safeURL(row.data.href);
  });
  for(const [kind,selector] of Object.entries({class:'.class-grid',gallery:'.gallery',benefit:'.benefits-list',faq:'.questions'})) {
    const parent=document.querySelector(selector);
    parent.replaceChildren(...rows.filter(r=>r.kind===kind).map(renderItem));
  }
  const settings=map.get('settings')?.data;
  if(settings){document.title=settings.title;document.querySelector('meta[name="description"]').content=settings.description;}
  document.dispatchEvent(new Event('cms:updated'));
}

