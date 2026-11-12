import { copyDefaults } from './copy-defaults.js';
import { renderWorkshopInfo } from './workshop-info.js';
const $ = s => document.querySelector(s);
const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = name => `<svg aria-hidden="true"><use href="./assets/ornaments.svg#${name}"/></svg>`;
const artwork = c => c.image || `/assets/${c.art === 'wheel' ? 'pottery' : c.art}.svg`;
const courseDialog = $('#course-dialog');
let content;
let category = 'all';
const localNow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Irkutsk', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
let month = new Date(`${localNow.slice(0, 7)}-01T12:00:00`);
let weekStart = startOfWeek(new Date(`${localNow}T12:00:00`));
let scheduleView = 'week';
let heroIndex = 0;
let heroSlides = [];
let galleryIndex = 0;
let galleryItems = [];
function startOfWeek(date) { const d = new Date(date); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d; }
function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

function showDialog(dialog) { dialog.showModal(); document.body.classList.add('modal-open'); }
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => document.body.classList.remove('modal-open'));
  dialog.addEventListener('click', event => { const r = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close(); });
}
const menu = $('.menu-toggle');
function closeMenu() { menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', 'Открыть меню'); $('#mobile-nav').hidden = true; }
menu.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню'); $('#mobile-nav').hidden = !open; });
$('#mobile-nav').addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
matchMedia('(min-width: 621px)').addEventListener('change', e => { if (e.matches) closeMenu(); });

function renderCourses() {
  const courses = content.courses.filter(c => category === 'all' || c.category === category);
  $('#course-grid').innerHTML = courses.length ? courses.map(c => `<article class="course-card ${category === 'all' && c.category !== 'pottery' ? 'course-card-secondary' : ''}">
    <button class="course-image-button" data-course="${escape(c.id)}" aria-label="Подробнее: ${escape(c.title)}"><img src="${escape(artwork(c))}" data-art="${escape(c.art)}" alt="${c.image ? escape(c.title) : 'Графический эскиз керамики'}" width="640" height="520" loading="lazy">${!c.image ? '<span class="course-art-label">Эскиз направления</span>' : ''}</button>
    <p class="course-subtitle">${escape(c.subtitle)}</p><h3 class="course-title">${escape(c.title)}</h3><p class="course-description">${escape(c.description)}</p>${c.duration || c.age ? `<p class="course-meta">${escape([c.duration, c.age].filter(Boolean).join(' · '))}</p>` : ''}
    <div class="course-bottom"><span class="course-price ${c.price ? '' : 'unset'}">${escape(c.price || 'Стоимость уточняется')}</span><button class="course-detail" data-course="${escape(c.id)}">Подробнее ${icon('arrow')}</button></div></article>`).join('') : '<p class="error-banner">В этом направлении занятия пока не опубликованы.</p>';
}
$('.filters').addEventListener('click', e => {
  const button = e.target.closest('[data-filter]'); if (!button || !content) return;
  selectCategory(button.dataset.filter);
});
function selectCategory(value) {
  category = value;
  for (const b of document.querySelectorAll('[data-filter]')) { const active = b.dataset.filter === category; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); }
  renderCourses();
}
document.addEventListener('click', event => {
  const link = event.target.closest('[data-catalog]'); if (link && content) selectCategory(link.dataset.catalog);
  const catalogLink = event.target.closest('a[href="#classes"]');
  if (catalogLink && !catalogLink.hasAttribute('data-catalog') && !catalogLink.hasAttribute('data-course') && content) selectCategory('all');
  const scheduleLink = event.target.closest('[data-schedule-category]');
  if (scheduleLink && content) { $('#schedule-filter').value = scheduleLink.dataset.scheduleCategory; renderSchedule(); }
});

function prepareHero() {
  heroSlides = [{label:'Мастерская', title:content.heroTitle, text:content.heroText, eyebrow:content.tagline, image:content.heroImage || './assets/pottery.svg', photo:Boolean(content.heroImage), cta:'Выбрать мастер-класс', href:'#classes'}];
  const hand = content.courses.find(c => c.id === 'handbuilding');
  const date = content.courses.find(c => c.id === 'date');
  const kids = content.courses.find(c => c.category === 'kids');
  for (const [c, label, cta, href] of [[hand,'Ручная лепка','Подробнее о лепке','#classes'],[date,'Для двоих','Выбрать свидание','#together'],[kids,'Детские курсы','Выбрать детский курс','#children']]) {
    if (c) heroSlides.push({label,title:c.title,text:c.description,eyebrow:c.subtitle,image:artwork(c),photo:Boolean(c.image),cta,href,courseId:c === kids ? '' : c.id});
  }
  $('#hero-topics').innerHTML = heroSlides.map((s,i) => `<button data-hero-slide="${i}" aria-pressed="${i===0}" class="${i===0 ? 'active' : ''}"><span>0${i+1}</span>${escape(s.label)}<span aria-hidden="true">↗</span></button>`).join('');
  showHero(0, false);
}
function showHero(index, announce = true) {
  if (!heroSlides.length) return;
  heroIndex = (index + heroSlides.length) % heroSlides.length;
  const slide = heroSlides[heroIndex];
  const lines = slide.title.split('\n');
  $('#hero-title').innerHTML = lines.map((line,i) => i === lines.length-1 ? `<span>${escape(line)}</span>` : escape(line)).join('<br>');
  $('#tagline').textContent = slide.eyebrow;
  $('#hero-description').textContent = slide.text;
  $('#hero-image').src = slide.image;
  $('#hero-image').alt = slide.photo ? slide.title.replaceAll('\n',' ') : `Графический эскиз: ${slide.label.toLowerCase()}`;
  $('#hero-caption').firstElementChild.textContent = `${String(heroIndex+1).padStart(2,'0')} / ${slide.label}`;
  $('#hero-caption').lastElementChild.textContent = slide.photo ? 'В нашей мастерской' : 'Эскиз до появления фотографий';
  const action = $('#hero-action');
  action.innerHTML = `${escape(slide.cta)} ${icon('arrow')}`;
  action.href = slide.href;
  if (slide.courseId) action.dataset.course = slide.courseId; else delete action.dataset.course;
  $('#hero-count').textContent = `${String(heroIndex+1).padStart(2,'0')} / ${String(heroSlides.length).padStart(2,'0')}`;
  for (const b of document.querySelectorAll('[data-hero-slide]')) { const active = Number(b.dataset.heroSlide) === heroIndex; b.classList.toggle('active',active); b.setAttribute('aria-pressed',String(active)); }
  if (announce) $('#hero-announcement').textContent = `Предложение ${heroIndex+1} из ${heroSlides.length}: ${slide.label}`;
}
$('#hero-prev').addEventListener('click',()=>showHero(heroIndex-1));
$('#hero-next').addEventListener('click',()=>showHero(heroIndex+1));
$('#hero-topics').addEventListener('click',e=>{const b=e.target.closest('[data-hero-slide]');if(b)showHero(Number(b.dataset.heroSlide));});
$('.hero-controls').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();showHero(heroIndex+(e.key==='ArrowRight'?1:-1));}});

function renderFeatures() {
  for (const link of document.querySelectorAll('a[data-course]')) link.hidden = !content.courses.some(c=>c.id===link.dataset.course);
  const date = content.courses.find(c=>c.id==='date');
  if ($('#together')) $('#together').hidden = !date;
  for(const link of document.querySelectorAll('a[href="#together"]'))link.hidden=!date;
  if(date && $('#together')){
    $('#together-title').textContent=date.title;
    $('#together-description').textContent=date.description;
    $('#together-image').src=artwork(date);
    $('#together-image').alt=date.image?date.title:'Эскиз двух глиняных изделий';
    $('#together-price').textContent=date.price||'Стоимость уточняется';
    $('#together-duration').textContent=date.duration;
    $('#together-caption').textContent=date.image?'Время, которое принадлежит вам двоим':'Время для двоих · эскиз направления';
    $('#together-action').dataset.course=date.id;
  }
  const kids=content.courses.filter(c=>c.category==='kids');
  $('#children').hidden=!kids.length;
  for(const link of document.querySelectorAll('a[href="#children"]'))link.hidden=!kids.length;
  $('#kids-courses').innerHTML=kids.map(c=>`<article class="kids-course"><div class="kids-photo-frame"><img src="${escape(artwork(c))}" alt="${escape(c.image?c.title:'Эскиз детского курса')}" width="150" height="170" loading="lazy"></div><div><p class="course-subtitle">${escape(c.subtitle)}</p><h3>${escape(c.title)}</h3><p>${escape(c.description)}</p><div class="kids-course-bottom"><span>${escape([c.price||'Стоимость уточняется',c.age].filter(Boolean).join(' · '))}</span><button class="course-detail" data-course="${escape(c.id)}">О курсе ${icon('arrow')}</button></div></div></article>`).join('');
}

function renderMasters() {
  if (!$('#masters-list')) return;
  const guests=content.courses.filter(c=>c.category==='guest');
  $('[data-filter="guest"]').hidden=!guests.length;
  $('#schedule-filter option[value="guest"]').hidden=!guests.length;
  const profiles=content.masters.length ? `<div class="masters-grid">${content.masters.map(m=>`<article class="master">${m.image?`<img src="${escape(m.image)}" alt="${escape(m.name)}" loading="lazy">`:''}<h3>${escape(m.name)}</h3><p>${escape(m.description)}</p></article>`).join('')}</div>` : '';
  const courses=guests.length ? `<div class="guest-courses">${guests.map(c=>`<article class="guest-course"><h3>${escape(c.title)}</h3><p>${escape(c.description)}</p><div class="course-bottom"><span class="course-price">${escape(c.price||'Стоимость уточняется')}</span><button class="course-detail" data-course="${escape(c.id)}">Подробнее ${icon('arrow')}</button></div></article>`).join('')}</div>` : '';
  $('#masters-list').innerHTML=profiles+courses || `<div class="masters-empty">${icon('flower')}<div><h3>${escape(content.copy.mastersEmptyTitle)}</h3><p>${escape(content.copy.mastersEmptyText)}</p></div></div>`;
}

function prepareGallery() {
  galleryItems = content.gallery.length ? content.gallery : [
    {image:'./assets/pair.svg',caption:'У каждой вещи свой характер · эскиз'},
    {image:'./assets/pottery.svg',caption:'Всё начинается с глины · эскиз'},
    {image:'./assets/cup.svg',caption:'Тепло, которое можно держать · эскиз'}
  ];
  $('#gallery-note').textContent=content.gallery.length?content.copy.galleryIntro:'Скоро здесь появятся фотографии занятий и первых работ. Пока — эскизы будущей галереи.';
  $('#gallery-grid').innerHTML=`<div class="gallery-stage"><button class="gallery-feature" data-gallery="0" aria-label="Открыть изображение"><img id="gallery-feature-image" alt="" width="900" height="600" loading="lazy"><span class="gallery-expand" aria-hidden="true">Рассмотреть ↗</span></button><div class="gallery-browser-controls"><button class="icon-button" id="gallery-prev" aria-label="Предыдущее изображение">←</button><span id="gallery-position"></span><button class="icon-button" id="gallery-next" aria-label="Следующее изображение">→</button></div></div><div class="gallery-aside"><svg class="small-sun" aria-hidden="true"><use href="./assets/ornaments.svg#sun"/></svg><h3 id="gallery-feature-caption"></h3><p>${content.gallery.length?'Взгляните на мастерскую поближе. Здесь каждый предмет хранит след прикосновения.':'Здесь будут настоящие моменты мастерской: знакомство с глиной, работа за кругом и вещи, сделанные с душой.'}</p><div class="gallery-thumbs" role="group" aria-label="Выбрать изображение">${galleryItems.map((g,i)=>`<button data-gallery-select="${i}" aria-label="Изображение ${i+1}: ${escape(g.caption)}" aria-pressed="false"><img src="${escape(g.image)}" alt="" width="100" height="100" loading="lazy"></button>`).join('')}</div></div>`;
  $('#gallery-prev').addEventListener('click',()=>showGallery(galleryIndex-1));
  $('#gallery-next').addEventListener('click',()=>showGallery(galleryIndex+1));
  showGallery(0);
}
function showGallery(index) {
  if(!galleryItems.length)return;
  galleryIndex=(index+galleryItems.length)%galleryItems.length;
  const item=galleryItems[galleryIndex];
  $('#gallery-feature-image').src=item.image;$('#gallery-feature-image').alt=item.caption;
  $('.gallery-feature').dataset.gallery=String(galleryIndex);
  $('.gallery-feature').setAttribute('aria-label',`Открыть изображение: ${item.caption}`);
  $('#gallery-feature-caption').textContent=item.caption;
  $('#gallery-position').textContent=`${String(galleryIndex+1).padStart(2,'0')} / ${String(galleryItems.length).padStart(2,'0')}`;
  for(const button of document.querySelectorAll('[data-gallery-select]')){const active=Number(button.dataset.gallerySelect)===galleryIndex;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
  $('#gallery-prev').disabled=galleryItems.length<2;$('#gallery-next').disabled=galleryItems.length<2;
}

function contactLinks() {
  return `${content.phone ? `<a class="contact-link" href="tel:${escape(content.phone.replace(/[^+\d]/g, ''))}">${escape(content.phone)}</a>` : ''}${content.email ? `<a class="contact-link" href="mailto:${escape(content.email)}">${escape(content.email)}</a>` : ''}`;
}

function openCourse(id, sessionId = '') {
  const course = content.courses.find(c => c.id === id); if (!course) return;
  const options = content.sessions.filter(s => s.courseId === id && new Date(`${s.date}T${s.time}:00+08:00`) >= new Date()).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  $('#dialog-content').innerHTML = `<div class="dialog-intro"><div class="dialog-photo-frame"><img src="${escape(artwork(course))}" alt="${escape(course.image ? course.title : 'Эскиз направления')}"></div><div><p>${escape(course.subtitle)}</p><h2 id="dialog-title">${escape(course.title)}</h2><p class="course-meta">${escape([course.price || 'Стоимость уточняется', course.duration, course.age].filter(Boolean).join(' · '))}</p></div></div><p class="dialog-description">${escape(course.details)}</p>${content.bookingEnabled ? `
    <form id="booking-form" class="booking-form"><h3>Давайте познакомимся</h3><div class="form-grid"><label class="field">Ваше имя<input name="name" autocomplete="given-name" required minlength="2" maxlength="100"></label><label class="field">Телефон<input type="tel" name="phone" autocomplete="tel" required maxlength="30" minlength="7" placeholder="+7 …"></label><label class="field full">Удобное занятие<select name="sessionId"><option value="">Согласовать дату с мастерской</option>${options.map(s => `<option value="${escape(s.id)}" ${s.id === sessionId ? 'selected' : ''}>${escape(new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long' }).format(new Date(`${s.date}T12:00:00`)))} · ${escape(s.time)}</option>`).join('')}</select></label><label class="field full">Пожелания <span>(необязательно)</span><textarea name="comment" maxlength="1500" placeholder="Например, хотим прийти всей семьёй"></textarea></label></div><label class="honeypot" aria-hidden="true">Сайт<input name="website" tabindex="-1" autocomplete="off"></label><label class="consent"><input type="checkbox" name="consent" required><span>Согласен на использование имени, телефона и пожеланий мастерской для ответа на эту заявку. Заявку можно удалить, обратившись в мастерскую по указанным контактам. Данные не используются для рассылок.</span></label><button class="button" type="submit">Отправить заявку ${icon('arrow')}</button><p class="form-message" id="booking-message" role="status"></p></form>` : `<div class="booking-notice"><h3>${escape(content.copy.closedBookingTitle)}</h3><p>${escape(content.copy.closedBookingText)}</p>${contactLinks()}<a class="text-link" href="#schedule" id="dialog-schedule">Посмотреть расписание <span aria-hidden="true">↗</span></a></div>`}`;
  showDialog(courseDialog);
  if (content.bookingBotUrl && /^https:\/\//i.test(content.bookingBotUrl)) {
    const bookingLink = document.createElement('a');
    bookingLink.className = 'button booking-bot-link';
    bookingLink.href = content.bookingBotUrl;
    bookingLink.target = '_blank';
    bookingLink.rel = 'noopener noreferrer';
    bookingLink.textContent = 'Записаться через Telegram-бота ↗';
    const notice = $('#dialog-content .booking-notice');
    if (notice) notice.querySelector('p').after(bookingLink);
    else $('#booking-form').before(bookingLink);
  }
  $('#dialog-schedule')?.addEventListener('click', () => courseDialog.close());
  const form = $('#booking-form'); if (!form) return;
  const requestId = crypto.randomUUID();
  form.addEventListener('submit', async event => {
    event.preventDefault(); const button = form.querySelector('button[type="submit"]'); const message = $('#booking-message'); const values = Object.fromEntries(new FormData(form));
    if (values.phone.replace(/\D/g, '').length < 7) { message.className = 'form-message error'; message.textContent = 'Укажите телефон, по которому с вами можно связаться.'; return; }
    button.disabled = true; message.className = 'form-message'; message.textContent = 'Сохраняем заявку…';
    try {
      const response = await fetch('./api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...values, consent: values.consent === 'on', courseId: id, requestId }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error);
      form.innerHTML = `<h3>Заявка получена</h3><p class="form-message success" role="status">Она сохранена для мастерской. Дождитесь ответа, чтобы подтвердить дату и время.</p>${contactLinks()}`;
    } catch (e) { message.className = 'form-message error'; message.textContent = e.message || 'Не удалось отправить заявку. Попробуйте ещё раз.'; button.disabled = false; }
  });
}
document.addEventListener('click', event => { const button = event.target.closest('[data-course]'); if (button && content) { event.preventDefault(); openCourse(button.dataset.course, button.dataset.session || ''); } });

function renderSchedule() {
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate()+6);
  const formatter = new Intl.DateTimeFormat('ru', { day:'numeric', month:'long' });
  $('#schedule-month').textContent = scheduleView==='week' ? `${formatter.formatRange(weekStart,weekEnd)} ${weekEnd.getFullYear()}` : new Intl.DateTimeFormat('ru', { month: 'long', year: 'numeric' }).format(month).replace(' г.', '');
  $('#prev-month').setAttribute('aria-label',scheduleView==='week'?'Предыдущая неделя':'Предыдущий месяц');
  $('#next-month').setAttribute('aria-label',scheduleView==='week'?'Следующая неделя':'Следующий месяц');
  $('#schedule-today').textContent=scheduleView==='week'?'Текущая неделя ↗':'Текущий месяц ↗';
  if (!content) return;
  const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const filter = $('#schedule-filter').value;
  const items = content.sessions.filter(s => (scheduleView==='week' ? s.date>=dateKey(weekStart)&&s.date<=dateKey(weekEnd) : s.date.startsWith(prefix)) && new Date(`${s.date}T${s.time}:00+08:00`) >= new Date() && (filter === 'all' || content.courses.find(c => c.id === s.courseId)?.category === filter)).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  $('#schedule-list').innerHTML = items.length ? items.map(s => {
    const course = content.courses.find(c => c.id === s.courseId); const d = new Date(`${s.date}T12:00:00`);
    return `<article class="session-row"><div class="session-date">${d.getDate()}<span>${escape(new Intl.DateTimeFormat('ru', { weekday: 'long' }).format(d))}</span></div><time class="session-time" datetime="${escape(s.date)}T${escape(s.time)}">${escape(s.time)}</time><div class="session-info"><h3 class="session-title">${escape(course.title)}</h3><p class="session-note">${escape([s.note, course.price].filter(Boolean).join(' · '))}</p></div><button class="button button-small" data-course="${escape(course.id)}" data-session="${escape(s.id)}">${content.bookingEnabled ? 'Записаться' : 'Подробнее'} ${icon('arrow')}</button></article>`;
  }).join('') : `<div class="empty-schedule">${icon('sun')}<h3>${content.sessions.length ? 'Пока нет занятий' : 'Новые встречи впереди'}</h3><p>${content.sessions.length ? `На ${scheduleView==='week'?'эту неделю':'этот месяц'} по выбранному направлению нет предстоящих занятий. Попробуйте другой период или направление.` : 'Готовим расписание мастерской. Как только даты будут подтверждены, они появятся здесь.'}</p><a class="text-link" href="#classes">А пока выберите своё ремесло <span aria-hidden="true">↗</span></a></div>`;
}
function moveSchedule(direction){if(scheduleView==='week')weekStart.setDate(weekStart.getDate()+7*direction);else month.setMonth(month.getMonth()+direction);renderSchedule();}
$('#prev-month').addEventListener('click', () => moveSchedule(-1));
$('#next-month').addEventListener('click', () => moveSchedule(1));
$('#schedule-filter').addEventListener('change', renderSchedule);
$('.schedule-views').addEventListener('click',e=>{const b=e.target.closest('[data-schedule-view]');if(!b)return;scheduleView=b.dataset.scheduleView;for(const tab of document.querySelectorAll('[data-schedule-view]')){const active=tab===b;tab.classList.toggle('active',active);tab.setAttribute('aria-pressed',String(active));}renderSchedule();});
$('#schedule-today').addEventListener('click',()=>{month=new Date(`${localNow.slice(0,7)}-01T12:00:00`);weekStart=startOfWeek(new Date(`${localNow}T12:00:00`));renderSchedule();});

function render() {
  document.title = `${content.name} — живое ремесло`;
  for(const element of document.querySelectorAll('[data-copy]'))element.textContent=content.copy[element.dataset.copy]??'';
  for (const b of document.querySelectorAll('[data-brand]')) {
    b.textContent = content.name;
    b.parentElement.setAttribute('aria-label', `${content.name} — на главную`);
    b.parentElement.querySelector('svg').toggleAttribute('hidden', Boolean(content.logoImage));
    if (content.logoImage === './assets/brand/logo-poster.png' && b.closest('.site-header')) {
      b.innerHTML = `<img class="brand-logo brand-logo-linen" src="./assets/brand/logo-linen.png" alt="${escape(content.name)}" width="1952" height="832">`;
    } else if (content.logoImage === './assets/brand/logo-poster.png') {
      b.innerHTML = `<span class="footer-logo-transparent"><img src="./assets/brand/logo-linen.png" alt="${escape(content.name)}" width="1952" height="832"><img class="footer-logo-lettering" src="./assets/brand/logo-linen.png" alt="" aria-hidden="true" width="1952" height="832"></span>`;
    } else if (content.logoImage) {
      b.innerHTML = `<img class="brand-logo" src="${escape(content.logoImage)}" alt="${escape(content.name)}">`;
    }
  }
  prepareHero();
  $('#about-title').textContent = content.aboutTitle; $('#about-description').textContent = content.aboutText;
  if (content.aboutImage) { $('#about-image').src = content.aboutImage; $('#about-image').alt = 'В нашей мастерской'; }
  selectCategory(category); renderFeatures(); renderSchedule();
  renderMasters();
  prepareGallery();
  $('#faq-list').innerHTML = content.faq.map(f => `<details><summary>${escape(f.question)}</summary><p>${escape(f.answer)}</p></details>`).join('');
  $('#contact-info').innerHTML = `${content.address ? `<p>${escape(content.address)}</p>` : ''}${content.hours ? `<p>${escape(content.hours)}</p>` : ''}${contactLinks()}${content.socialUrl ? `<a class="contact-link" href="${escape(content.socialUrl)}" target="_blank" rel="noopener noreferrer">Мы в социальных сетях ↗</a>` : ''}${!content.address && !content.phone && !content.email ? '<p>Адрес и контакты мастерской<br>скоро появятся здесь.</p>' : ''}`;
  $('#copyright').textContent = `${new Date().getFullYear()} · ${content.name}`;
  renderWorkshopInfo(content);
}
$('#gallery-grid').addEventListener('click', e => {
  const thumbnail=e.target.closest('[data-gallery-select]');if(thumbnail){showGallery(Number(thumbnail.dataset.gallerySelect));return;}
  const button = e.target.closest('[data-gallery]'); if (!button) return;
  const item = galleryItems[Number(button.dataset.gallery)]; $('#lightbox-image').src = item.image; $('#lightbox-image').alt = item.caption; $('#lightbox-caption').textContent = item.caption; showDialog($('#lightbox'));
});
$('#lightbox').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();showGallery(galleryIndex+(e.key==='ArrowRight'?1:-1));const item=galleryItems[galleryIndex];$('#lightbox-image').src=item.image;$('#lightbox-image').alt=item.caption;$('#lightbox-caption').textContent=item.caption;}});
async function load() {
  try { const r = await fetch('./api/content'); if (!r.ok) throw new Error(); content = await r.json(); content.copy={...copyDefaults,...content.copy}; render(); }
  catch { $('#course-grid').innerHTML = '<div class="error-banner">Не удалось загрузить занятия. Проверьте соединение и <button id="retry-load" class="text-link">попробуйте ещё раз</button>.</div>'; $('#retry-load').addEventListener('click', load); }
}
renderSchedule(); load();

