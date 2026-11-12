import { siteSettings } from './site-settings.js';
import { scheduleEditor } from './admin-schedule.js';
import { copyDefaults, copyGroups } from './copy-defaults.js';
const $ = s => document.querySelector(s);
const settingsLabels={discountText:'Скидки и предоплата',termsTitle:'Заголовок условий',termsText:'Что входит в стоимость и сроки обжига',celebrationText:'Праздники и дополнительные услуги',benefitsTitle:'Заголовок преимуществ',benefitsIntro:'Вступление к преимуществам',benefit1Title:'Преимущество 1 — заголовок',benefit1Text:'Преимущество 1 — описание',benefit2Title:'Преимущество 2 — заголовок',benefit2Text:'Преимущество 2 — описание',benefit3Title:'Преимущество 3 — заголовок',benefit3Text:'Преимущество 3 — описание',aboutCaption:'Подпись фото мастерской',togetherCaption:'Подпись фото свидания',galleryText:'Текст рядом с галереей',scheduleFootnote:'Примечание под расписанием'};
function imagePicker(key,value){
 const images=new Map();
 for(const c of data.courses)if(c.image)images.set(c.image,c.title);
 for(const g of data.gallery)if(g.image&&!images.has(g.image))images.set(g.image,g.caption||'Фото галереи');
 for(const [url,title] of [[data.heroImage,'Первый экран'],[data.aboutImage,'Мастерская'],[data.logoImage,'Логотип']])if(url&&!images.has(url))images.set(url,title);
 return `<label class="field">Или выбрать из фотографий сайта<select data-key="${key}"><option value="${esc(value||'')}">Выбрать фотографию…</option>${[...images].map(([url,title])=>`<option value="${esc(url)}">${esc(title)}</option>`).join('')}</select></label>`;
}
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
let data; let activeTab = 'general'; let dirty = false; let uploading = false; let revision = 0;
const markDirty = () => { dirty = true; revision++; $('#save-status').textContent = 'Есть несохранённые изменения'; };
const message = (text, error = false) => { $('#editor-message').textContent = text; $('#editor-message').className = `form-message ${error ? 'error' : 'success'}`; };
async function api(url, options = {}) {
  const r = await fetch(url, options); const result = await r.json();
  if (!r.ok) { if (r.status === 401 && !url.endsWith('/login')) { $('#editor').hidden = true; $('#login-panel').hidden = false; } throw new Error(result.error || 'Не удалось выполнить запрос.'); } return result;
}
function get(key) { return key.split('.').reduce((v, k) => v?.[k], data); }
function set(key, value) { const parts = key.split('.'); const last = parts.pop(); parts.reduce((v, k) => v[k], data)[last] = value; markDirty(); }
function field(label, key, type = 'text', help = '') {
  const val = get(key) ?? ''; const id = `f-${key.replaceAll('.', '-')}`;
  return `<label class="field ${type === 'textarea' ? 'full' : ''}" for="${id}">${esc(label)}${type === 'textarea' ? `<textarea id="${id}" data-key="${key}" maxlength="5000">${esc(val)}</textarea>` : `<input id="${id}" type="${type}" data-key="${key}" value="${esc(val)}" maxlength="500">`}${help ? `<span class="field-help">${esc(help)}</span>` : ''}</label>`;
}
function select(label, key, options) { return `<label class="field">${esc(label)}<select data-key="${key}">${options.map(([value, text]) => `<option value="${esc(value)}" ${get(key) === value ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`; }
function imageField(label, key) { const value = get(key); return `<div class="field full"><span>${esc(label)}</span>${value ? `<img class="editor-image" src="${esc(value)}" alt="Текущее изображение"><div class="image-tools"><button type="button" class="remove-image" data-remove-image="${key}">Убрать изображение</button></div>` : '<span class="image-placeholder">Фотография ещё не добавлена</span>'}${imagePicker(key,value)}<label class="field">Загрузить JPG, PNG или WebP до 6 МБ<input type="file" data-upload="${key}" accept="image/jpeg,image/png,image/webp"></label></div>`; }
const removeButton = (list, i) => `<button type="button" class="delete-button" data-remove="${list}" data-index="${i}">Удалить</button>`;
const addButton = (list, label) => `<button class="button button-outline editor-add" data-add="${list}">+ ${label}</button>`;

async function render() {
  const target = $('#editor-content'); message('');
  if (activeTab === 'general') {
    target.innerHTML = `<section class="editor-section"><h2>Название и первый экран</h2><div class="form-grid">${field('Название мастерской', 'name')}${field('Строка над заголовком', 'tagline')}${field('Главный заголовок (перенос строки задаёт новую строку)', 'heroTitle', 'textarea')}${field('Вступительный текст', 'heroText', 'textarea')}${imageField('Логотип', 'logoImage')}${imageField('Фотография на первом экране', 'heroImage')}</div></section><section class="editor-section"><h2>О мастерской</h2><div class="form-grid">${field('Заголовок раздела', 'aboutTitle')}${field('Рассказ о мастерской', 'aboutText', 'textarea')}${imageField('Фотография мастерской', 'aboutImage')}</div></section><section class="editor-section"><h2>Контакты и запись</h2><p>Укажите реальные данные. Пустые поля не показываются на сайте.</p><div class="form-grid">${field('Телефон', 'phone', 'tel')}${field('Электронная почта', 'email', 'email')}${field('Адрес', 'address', 'textarea')}${field('Часы работы', 'hours')}${field('ВКонтакте (https://)', 'socialUrl', 'url')}${field('Telegram (https://)', 'telegramUrl', 'url')}${field('Telegram-бот для записи на МК (https://t.me/...)', 'bookingBotUrl', 'url')}${field('МАКС (https://)', 'maxUrl', 'url')}</div><label class="inline-check"><input type="checkbox" data-key="bookingEnabled" ${data.bookingEnabled ? 'checked' : ''}><span>Открыть запись через форму. Для этого укажите телефон или почту. Заявки сохраняются в разделе «Заявки».</span></label></section>`;
  } else if (activeTab === 'settings') {
    target.innerHTML = '<section class="editor-section"><h2>Условия, подписи и преимущества курсов</h2><div class="form-grid">' + Object.keys(siteSettings).map(key=>field(settingsLabels[key] || key,`siteSettings.${key}`,'textarea')).join('') + '</div></section>';
  } else if (activeTab === 'copy') {
    target.innerHTML = copyGroups.map(([title,fields]) => `<section class="editor-section"><h2>${esc(title)}</h2><div class="form-grid">${fields.map(([key,label]) => field(label,`copy.${key}`,'textarea')).join('')}</div></section>`).join('');
  } else if (activeTab === 'courses') {
    target.innerHTML = addButton('courses', 'Добавить занятие') + data.courses.map((c, i) => `<section class="editor-section"><div class="editor-card-top"><h2>${esc(c.title)}</h2>${removeButton('courses', i)}</div><div class="form-grid">${field('Название', `courses.${i}.title`)}${select('Направление', `courses.${i}.category`, [['pottery','Гончарное дело'],['kids','Для детей'],['art','Живопись'],['guest','Приглашённые мастера']])}${field('Подзаголовок', `courses.${i}.subtitle`)}${field('Стоимость (например, 2 000 ₽)', `courses.${i}.price`)}${field('Длительность', `courses.${i}.duration`)}${field('Возраст участников', `courses.${i}.age`)}${field('Краткое описание', `courses.${i}.description`, 'textarea')}${field('Подробности и условия', `courses.${i}.details`, 'textarea')}${select('Временный эскиз', `courses.${i}.art`, [['wheel','Кувшин'],['cup','Кружка'],['pair','Два изделия'],['brush','Живопись']])}${imageField('Фото занятия', `courses.${i}.image`)}</div></section>`).join('');
  } else if (activeTab === 'sessions') {
    const courses = data.courses.map(c => [c.id, c.title]);
    target.innerHTML = scheduleEditor(data,field,addButton,removeButton) + '<details><summary>Отдельные занятия с датой (дополнительно)</summary><p class="request-count">Время местное (UTC+8). Прошедшие занятия не показываются посетителям. Пустое расписание отображается без выдуманных дат.</p>' + addButton('sessions', 'Добавить занятие в расписание') + (data.sessions.length ? data.sessions.map((s, i) => `<section class="editor-section"><div class="editor-card-top"><h2>Занятие ${i + 1}</h2>${removeButton('sessions', i)}</div><div class="form-grid">${select('Направление', `sessions.${i}.courseId`, courses)}${field('Дата', `sessions.${i}.date`, 'date')}${field('Время', `sessions.${i}.time`, 'time')}${field('Примечание', `sessions.${i}.note`)}</div></section>`).join('') : '<p class="empty-editor">В расписании пока нет занятий. Добавьте первую подтверждённую дату.</p>') + '</details>';
  } else if (activeTab === 'gallery') {
    target.innerHTML = addButton('gallery', 'Добавить фотографию') + (data.gallery.length ? data.gallery.map((g, i) => `<section class="editor-section"><div class="editor-card-top"><h2>Фотография ${i + 1}</h2>${removeButton('gallery', i)}</div>${field('Подпись (также описание для незрячих посетителей)', `gallery.${i}.caption`)}${imageField('Изображение', `gallery.${i}.image`)}</section>`).join('') : '<p class="empty-editor">Пока вместо фотографий на сайте показаны эскизы. После загрузки фотографии заменят их.</p>');
  } else if (activeTab === 'masters') {
    target.innerHTML = addButton('masters', 'Добавить мастера') + data.masters.map((m, i) => `<section class="editor-section"><div class="editor-card-top"><h2>${esc(m.name || 'Новый мастер')}</h2>${removeButton('masters', i)}</div>${field('Имя мастера', `masters.${i}.name`)}${field('Направление и описание встречи', `masters.${i}.description`, 'textarea')}${imageField('Фото мастера', `masters.${i}.image`)}</section>`).join('');
  } else if (activeTab === 'faq') {
    target.innerHTML = addButton('faq', 'Добавить вопрос') + data.faq.map((f, i) => `<section class="editor-section"><div class="editor-card-top"><h2>Вопрос ${i + 1}</h2>${removeButton('faq', i)}</div>${field('Вопрос', `faq.${i}.question`)}${field('Ответ', `faq.${i}.answer`, 'textarea')}</section>`).join('');
  } else if (activeTab === 'requests') {
    target.innerHTML = '<p class="empty-editor">Загружаем заявки…</p>';
    try {
      const requests = await api('/api/admin/requests'); if (activeTab !== 'requests') return;
      target.innerHTML = '<button class="button button-outline editor-add" id="refresh-requests">Обновить заявки</button>' + (requests.length ? `<p class="request-count">Всего заявок: ${requests.length}. Свяжитесь с посетителем для подтверждения записи.</p>${requests.toReversed().map(r => `<article class="request-card"><div class="request-top"><h2>${esc(r.name)}</h2><small>${esc(new Intl.DateTimeFormat('ru', { dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Irkutsk' }).format(new Date(r.createdAt)))}</small></div><p><a href="tel:${esc(r.phone.replace(/[^+\d]/g,''))}">${esc(r.phone)}</a></p><p>${esc(r.course)} · ${esc(r.session)}</p>${r.comment ? `<p>${esc(r.comment)}</p>` : ''}<button class="delete-button" data-delete-request="${esc(r.id)}">Удалить заявку и персональные данные</button></article>`).join('')}` : '<p class="empty-editor">Заявок пока нет.</p>');
    } catch(e) { if (activeTab === 'requests') target.innerHTML = `<p class="error-banner">${esc(e.message)}</p>`; }
  }
}

async function openEditor() {
  if (!dirty) data = await api('/api/content');
  data.copy = {...copyDefaults,...data.copy};
  data.siteSettings = {...siteSettings,...data.siteSettings};
  data.novemberSchedule ??= [];
  data.telegramUrl ??= ''; data.maxUrl ??= ''; data.bookingBotUrl ??= '';
  $('#login-panel').hidden = true; $('#editor').hidden = false; $('#password').value = ''; await render();
}
$('#login-form').addEventListener('submit', async e => {
  e.preventDefault(); const button = e.target.querySelector('button'); button.disabled = true;
  try { await api('/api/admin/login', { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('#password').value}) }); $('#login-message').textContent = ''; await openEditor(); }
  catch(e) { $('#login-message').textContent = e.message; $('#login-message').className = 'form-message error'; }
  finally { button.disabled = false; }
});
$('.editor-tabs').addEventListener('click', e => {
  const button = e.target.closest('[data-tab]'); if (!button || uploading) return;
  activeTab = button.dataset.tab;
  for (const tab of document.querySelectorAll('[data-tab]')) { tab.classList.toggle('active', tab === button); tab.setAttribute('aria-pressed', String(tab === button)); }
  render();
});
$('#editor-content').addEventListener('input', e => { if (e.target.dataset.key) set(e.target.dataset.key, e.target.type === 'checkbox' ? e.target.checked : e.target.value); });
$('#editor-content').addEventListener('change', async e => {
  if(e.target.matches('select[data-key]') && /(?:Image|\.image)$/.test(e.target.dataset.key)) { set(e.target.dataset.key,e.target.value); await render(); return; }
  const key = e.target.dataset.upload; if (!key || !e.target.files.length) return;
  if (uploading) { e.target.value=''; message('Дождитесь загрузки предыдущего изображения.',true); return; }
  const file = e.target.files[0];
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 6 * 1024 * 1024) { message('Нужен JPG, PNG или WebP до 6 МБ.', true); e.target.value = ''; return; }
  uploading = true; $('#save-content').disabled = true; message('Загружаем фотографию…');
  try { const result = await api('/api/admin/upload', { method:'POST',headers:{'Content-Type':file.type},body:file }); set(key, result.image); await render(); message('Фото загружено. Сохраните изменения, чтобы показать его на сайте.'); }
  catch(e) { message(e.message, true); }
  finally { uploading = false; $('#save-content').disabled = false; }
});
$('#editor-content').addEventListener('click', async e => {
  const button = e.target.closest('button'); if (!button || uploading) return;
  if (button.dataset.removeImage) { set(button.dataset.removeImage, ''); render(); }
  if (button.dataset.add) {
    const list = button.dataset.add; const id = crypto.randomUUID();
    if (list === 'novemberSchedule') data.novemberSchedule.push({day:'Новый день',dates:'',events:[]});
    if (list.endsWith('.events')) get(list).push(['12:00','Новое занятие','']);
    if (list === 'courses') data.courses.push({id,title:'Новое занятие',category:'pottery',subtitle:'',description:'',details:'',price:'',duration:'',age:'',image:'',art:'wheel'});
    if (list === 'sessions') { if (!data.courses.length) { message('Сначала добавьте направление в разделе «Занятия».', true); return; } data.sessions.push({id,courseId:data.courses[0].id,date:'',time:'12:00',note:''}); }
    if (list === 'gallery') data.gallery.push({image:'',caption:''});
    if (list === 'masters') data.masters.push({name:'',description:'',image:''});
    if (list === 'faq') data.faq.push({question:'',answer:''});
    markDirty(); await render(); $('#editor-content').lastElementChild?.scrollIntoView({behavior:'smooth',block:'center'});
  }
  if (button.dataset.remove) {
    const list = button.dataset.remove; const index = Number(button.dataset.index);
    if (!confirm(list === 'courses' ? 'Удалить направление и связанные с ним даты из расписания?' : 'Удалить этот элемент? Изменение вступит в силу после сохранения.')) return;
    if (list === 'courses') { const removed=data.courses[index].id; data.sessions = data.sessions.filter(s => s.courseId !== removed); data.weeklySchedule=(data.weeklySchedule||[]).filter(s=>s.courseId!==removed); }
    get(list).splice(index,1); markDirty(); render();
  }
  if (button.id === 'refresh-requests') render();
  if (button.dataset.deleteRequest && confirm('Удалить эту заявку и её персональные данные без возможности восстановления?')) {
    try { await api('/api/admin/requests',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:button.dataset.deleteRequest})}); render(); } catch(e) { message(e.message,true); }
  }
});
$('#save-content').addEventListener('click', async () => {
  const button = $('#save-content'); button.disabled = true; $('#save-status').textContent = 'Сохраняем…';
  const savedRevision = revision;
  try { await api('/api/admin/content',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); dirty = revision !== savedRevision; $('#save-status').textContent = dirty ? 'Есть более новые несохранённые изменения' : 'Все изменения сохранены'; message(dirty ? 'Предыдущие изменения сохранены. Сохраните новые правки ещё раз.' : 'Сайт обновлён. Откройте или обновите вкладку сайта.'); }
  catch(e) { $('#save-status').textContent = 'Изменения не сохранены'; message(e.message,true); }
  finally { button.disabled = false; }
});
$('#logout').addEventListener('click', async () => { if (dirty && !confirm('Выйти без сохранения изменений?')) return; try { await api('/api/admin/logout',{method:'POST'}); dirty = false; data = null; $('#editor').hidden = true; $('#login-panel').hidden = false; $('#save-status').textContent = 'Изменений нет'; } catch(e) { message(e.message,true); } });
window.addEventListener('beforeunload', e => { if (dirty || uploading) { e.preventDefault(); e.returnValue = ''; } });
api('/api/admin/session').then(openEditor).catch(() => {});
