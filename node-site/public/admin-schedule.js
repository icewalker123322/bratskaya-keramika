export function scheduleEditor(data,field,addButton,removeButton) {
 return '<section class="editor-section"><h2>Расписание, которое видно на сайте</h2><p>Редактируйте дни, даты, время, названия и цены. Для нового месяца измените также заголовок в «Текстах разделов». Строка времени допускает «По записи».</p></section>'+addButton('novemberSchedule','Добавить день')+(data.novemberSchedule||[]).map((day,i)=>{
 const path=`novemberSchedule.${i}`;
 return `<section class="editor-section"><div class="editor-card-top"><h2>${i+1}. День расписания</h2>${removeButton('novemberSchedule',i)}</div><div class="form-grid">${field('Название дня',path+'.day')}${field('Даты / дополнительная подпись',path+'.dates')}</div>${(day.events||[]).map((event,j)=>`<div class="schedule-edit-row"><div class="editor-card-top"><h3>Занятие ${j+1}</h3>${removeButton(path+'.events',j)}</div><div class="form-grid">${field('Время или дата и время',path+'.events.'+j+'.0')}${field('Название, группа, примечание',path+'.events.'+j+'.1')}${field('Стоимость',path+'.events.'+j+'.2')}</div></div>`).join('')}${addButton(path+'.events','Добавить занятие')}</section>`;
 }).join('');
}

