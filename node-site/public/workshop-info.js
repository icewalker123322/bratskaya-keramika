import {siteSettings} from './site-settings.js';
export function renderWorkshopInfo(content) {
  const settings={...siteSettings,...content.siteSettings};
  const contacts=document.querySelector('#contact-info');
  const links=[['ВКонтакте',content.socialUrl],['Telegram',content.telegramUrl],['МАКС',content.maxUrl],['Записаться на МК — Telegram-бот',content.bookingBotUrl]];
  contacts.querySelector('a[target="_blank"]')?.remove();
  for(const [label,url] of links){
    if(!url)continue;
    try{if(new URL(url).protocol!=='https:')continue;}catch{continue;}
    const a=document.createElement('a');a.className='contact-link';a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=label+' ↗';contacts.append(a);
  }
  document.querySelector('#group-discount')?.remove();
  const discount=document.createElement('p');discount.id='group-discount';discount.className='group-discount';discount.textContent='Для групп: более 5 человек — скидка 5%, более 10 человек — 10%. Бронирование мастер-класса — предоплата 200 ₽ с человека.';
  discount.textContent=settings.discountText;
  document.querySelector('#course-grid').before(discount);
  if(!content.weeklySchedule?.length)return;
  document.querySelector('#regular-courses')?.remove();
  const section=document.createElement('div');section.id='regular-courses';section.className='regular-courses';
  const intro=document.createElement('p');intro.className='regular-intro';intro.textContent='Погрузитесь в мир керамики — открыт набор детей на курсы';section.append(intro);
  for(const item of content.weeklySchedule){
    const course=content.courses.find(c=>c.id===item.courseId);if(!course)continue;
    const row=document.createElement('div');row.className='regular-course';
    const title=document.createElement('h3');title.textContent=course.title;
    const age=document.createElement('span');age.textContent='Дети '+course.age;
    const time=document.createElement('p');time.textContent=(item.weekday===0?'По воскресеньям':'По вторникам')+' · '+item.time;
    const count=document.createElement('span');count.textContent=course.duration;
    const action=document.createElement('button');action.className='course-detail';action.dataset.course=course.id;action.textContent='О курсе ↗';
    row.append(title,age,time,count,action);section.append(row);
  }
  const note=document.createElement('p');note.className='regular-note';note.textContent='Стоимость курса и дату первого занятия уточните по телефону 8 (904) 113-11-99 или в сообщениях мастерской.';section.append(note);
  document.querySelector('#schedule-list').before(section);
  if(!content.sessions.length){
    document.querySelector('#schedule-list').hidden=true;
    document.querySelector('.schedule-controls').hidden=true;
    document.querySelector('.schedule-view-bar').hidden=true;
  }
  if(Array.isArray(content.novemberSchedule)){
    section.replaceChildren();section.classList.add('november-timetable');
    for(const day of content.novemberSchedule){
      const block=document.createElement('article');block.className='november-day';
      const head=document.createElement('div');head.className='november-day-heading';
      const title=document.createElement('h3');title.textContent=day.day;
      const dates=document.createElement('p');dates.textContent=day.dates;head.append(title,dates);block.append(head);
      const events=document.createElement('div');events.className='november-events';
      for(const [when,what,price] of day.events){
        const row=document.createElement('div');row.className='november-event';
        const time=document.createElement('span');time.textContent=when;
        const description=document.createElement('p');description.textContent=what;
        row.append(time,description);
        if(price){const value=document.createElement('span');value.className='schedule-event-price';value.textContent=price;row.append(value);}
        events.append(row);
      }
      block.append(events);section.append(block);
    }
    const contact=document.createElement('p');contact.className='regular-note';contact.textContent='Вопросы по курсам и запись на мастер-классы: ';
    const phone=document.createElement('a');phone.href='tel:'+content.phone.replace(/[^+\d]/g,'');phone.textContent=content.phone;contact.append(phone);section.append(contact);
  }
  if(content.courses.some(c=>c.category==='guest'))document.querySelector('[data-filter="guest"]')?.removeAttribute('hidden');
  if(!document.querySelector('#booking-terms')){
    const terms=document.createElement('div');terms.id='booking-terms';terms.className='booking-terms';
    terms.innerHTML='<h3>Запись и условия участия</h3><p>В стоимость керамических мастер-классов входят роспись ангобами, глазуровка, обжиг и работа преподавателя. Изделия обжигаются в течение 3–4 недель — готовность уточняйте у мастерской.</p><p>Дни рождения, девичники и семейные мастер-классы: стоимость зависит от количества и возраста участников и ваших пожеланий. Дополнительные услуги обсуждаем индивидуально.</p>';
    document.querySelector('#course-grid').after(terms);
  }
  if(document.querySelector('#course-benefits'))return;
  const benefits=document.createElement('section');benefits.id='course-benefits';benefits.className='course-benefits wrap';
  benefits.innerHTML='<h2>Что дают занятия с глиной</h2><p class="benefits-intro">Курсы совмещают тренировку мелкой моторики, арт-терапию и знакомство с законами физики и геометрии.</p><div class="benefits-grid"><article><h3>Мышление в объёме</h3><p>Дети учатся переводить плоский рисунок в трёхмерный объект, понимать симметрию, баланс, объём и пропорции.</p></article><article><h3>Смелость пробовать</h3><p>Глина пластична: если что-то не получилось, форму можно смять и начать заново. Это помогает спокойнее относиться к неудачам и пробовать снова.</p></article><article><h3>Внимание к процессу</h3><p>Гончарное дело и ручная лепка требуют времени и фокуса. Занятия помогают ребёнку дольше удерживать внимание на одном процессе и отвлечься от гаджетов.</p></article></div>';
  document.querySelector('#children').after(benefits);
  const put=(selector,value)=>{const el=document.querySelector(selector);if(el)el.textContent=value;};
  put('#booking-terms h3',settings.termsTitle);put('#booking-terms p',settings.termsText);put('#booking-terms p+p',settings.celebrationText);
  put('#course-benefits h2',settings.benefitsTitle);put('.benefits-intro',settings.benefitsIntro);
  for(let i=1;i<=3;i++){put(`.benefits-grid article:nth-child(${i}) h3`,settings[`benefit${i}Title`]);put(`.benefits-grid article:nth-child(${i}) p`,settings[`benefit${i}Text`]);}
  put('.about-art figcaption',settings.aboutCaption);put('#together-caption',settings.togetherCaption);put('.gallery-aside>p',settings.galleryText);put('.schedule-footnote',settings.scheduleFootnote);
}
