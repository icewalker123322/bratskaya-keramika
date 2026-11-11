import {getClient,content,safeURL,validateImage,BUCKET} from '../cms-client.js';
import {OWNER_LOGIN,resolveLogin} from './auth-config.js';
const $=s=>document.querySelector(s);
const create=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
let db, rows=[], media=[], view='home', editing, busy=false, dirty=false, filter='', query='';
const titles={home:'Обзор',pages:'Страницы',photos:'Фотографии',settings:'Настройки'};
let noticeTimer;
function notify(message,error=false){clearTimeout(noticeTimer);$('#notice').textContent=message;$('#notice').className=error?'error':'';noticeTimer=setTimeout(()=>$('#notice').textContent='',error?15000:5000);}
async function run(fn){if(busy)return;busy=true;document.body.setAttribute('aria-busy','true');const buttons=[...document.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);try{await fn();}catch(e){notify(e.message||'Не удалось выполнить операцию.',true);}finally{busy=false;document.body.removeAttribute('aria-busy');buttons.forEach(b=>b.disabled=false);}}
function button(text,fn,cls='secondary'){const b=create('button',cls,text);b.type='button';b.onclick=()=>run(fn);return b;}
function check(result){if(result.error)throw result.error;return result.data;}
async function refresh(){rows=await content(db);media=check(await db.storage.from(BUCKET).list('',{limit:1000,sortBy:{column:'created_at',order:'desc'}}))||[];}
async function authorized(){const {data,error}=await db.auth.getUser();if(error)throw error;if(!data.user)throw new Error('Войдите в аккаунт.');const admin=check(await db.from('site_admins').select('user_id').eq('user_id',data.user.id).maybeSingle());if(!admin){await db.auth.signOut();throw new Error('Этот аккаунт не включён в список администраторов.');}return data.user;}
async function enter(){await authorized();await refresh();$('#account').textContent=OWNER_LOGIN;$('#login').hidden=true;$('#workspace').hidden=false;render();}
function lock(){rows=[];media=[];$('#editor').close();dirty=false;$('#workspace').hidden=true;$('#login').hidden=false;$('#view').replaceChildren();$('#fields').replaceChildren();}
$('#login-form').onsubmit=e=>{e.preventDefault();run(async()=>{const f=new FormData(e.target);const email=resolveLogin(f.get('login'));db=await getClient();const result=await db.auth.signInWithPassword({email,password:f.get('password')});if(result.error){if(result.error.status===400)throw new Error('Неверный логин или пароль.');throw result.error;}e.target.reset();await enter();});};
$('#logout').onclick=()=>run(async()=>{check(await db.auth.signOut());lock();notify('Вы вышли из аккаунта.');});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;filter='';query='';render();});
function switchView(next){view=next;render();}
function render(){
  $('#view-title').textContent=titles[view];document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  const host=$('#view');host.replaceChildren();
  if(view==='home'){
    const welcome=create('div','welcome');welcome.append(create('h2','','Пусть сайт живёт вместе с мастерской'),create('p','','Обновляйте истории, добавляйте работы и делитесь тем, что создаёте. Сохранённые изменения видны посетителям после обновления страницы.'),button('Редактировать страницы →',()=>switchView('pages')));host.append(welcome);
    const stats=create('div','stats');for(const [label,count]of [['Текстов',rows.filter(r=>r.kind==='text').length],['Работ в галерее',rows.filter(r=>r.kind==='gallery'&&r.published).length],['Загруженных фото',media.length]]){const card=create('div','stat');card.append(create('strong','',count),create('span','',label));stats.append(card);}host.append(stats);
    const p=create('div','panel');p.append(create('h3','','Быстрые действия'),create('p','muted','Новые фотографии можно использовать в карточках, галерее и основных разделах.'),button('Добавить фотографию',()=>switchView('photos')),button('Настройки сайта',()=>switchView('settings')));host.append(p);return;
  }
  if(view==='photos'){renderPhotos(host);return;}
  if(view==='settings'){const row=rows.find(r=>r.id==='settings');host.append(create('p','muted','Название вкладки и описание страницы для поисковых систем.'));if(row)host.append(rowCard(row));return;}
  const toolbar=create('div','toolbar');const select=create('select');select.setAttribute('aria-label','Раздел');
  for(const section of ['',...new Set(rows.filter(r=>r.kind!=='settings').map(r=>r.section))]){const opt=create('option','',section||'Все разделы');opt.value=section;select.append(opt);}select.value=filter;select.onchange=()=>{filter=select.value;render();};
  const search=create('input');search.placeholder='Поиск по содержимому';search.setAttribute('aria-label','Поиск');search.value=query;search.onchange=()=>{query=search.value;render();};toolbar.append(select,search);
  for(const [kind,label]of [['class','Мастер-класс'],['gallery','Работа'],['benefit','Преимущество'],['faq','Вопрос']])toolbar.append(button('+ '+label,()=>openNew(kind)));
  host.append(toolbar);const list=create('div','list');rows.filter(r=>r.kind!=='settings'&&(!filter||r.section===filter)&&JSON.stringify(r).toLowerCase().includes(query.toLowerCase())).forEach(r=>list.append(rowCard(r)));if(!list.children.length)list.append(create('p','empty','Ничего не найдено.'));host.append(list);
}
const collectionKinds=['class','gallery','benefit','faq'];
function rowCard(row){const card=create('article','row');if(row.data.image){const img=create('img');img.src=safeURL(row.data.image,true);img.alt=row.data.alt||'';card.append(img);}const copy=create('div','copy');copy.append(create('h3','',row.data.title||row.data.text||row.label),create('p','',row.section+' · '+(row.published?'Опубликовано':'Скрыто')));card.append(copy);const actions=create('div','actions');actions.append(button('Изменить',()=>openEditor(row)));
  if(collectionKinds.includes(row.kind)){
    actions.append(button(row.published?'Скрыть':'Опубликовать',async()=>{check(await db.from('site_content').update({published:!row.published}).eq('id',row.id));await refresh();render();notify('Видимость обновлена.');}));
    for(const [direction,label]of [[-1,'↑'],[1,'↓']])actions.append(button(label,async()=>{check(await db.rpc('move_site_content',{item_id:row.id,direction}));await refresh();render();}));
    actions.append(button('Удалить',async()=>{if(!confirm('Удалить «'+(row.data.title||row.label)+'»? Это действие нельзя отменить.'))return;check(await db.from('site_content').delete().eq('id',row.id));await refresh();render();notify('Элемент удалён.');},'danger'));
  }card.append(actions);return card;
}
const labels={text:'Текст',title:'Заголовок',description:'Описание',image:'Фотография',alt:'Описание фото для доступности',caption:'Подпись в просмотре фото',category:'Направление',meta1:'Формат занятия',meta2:'Дополнительная подпись',shape:'Размер в галерее',href:'Адрес ссылки'};
function openNew(kind){const definitions={class:['Мастер-классы',{title:'Новый мастер-класс',description:'',image:'assets/workshop.jpg',alt:'',category:'pottery',meta1:'Ручная лепка',meta2:''}],gallery:['Галерея',{title:'Новая работа',caption:'',image:'assets/workshop.jpg',alt:'',shape:''}],benefit:['Развитие',{title:'Новое преимущество',description:''}],faq:['Вопросы',{title:'Новый вопрос',description:''}]};const [section,data]=definitions[kind];openEditor({id:crypto.randomUUID(),section,label:data.title,kind,data,position:Math.max(-1,...rows.filter(r=>r.kind===kind).map(r=>r.position))+1,published:false},true);}
function field(name,value){const label=create('label','',labels[name]||name);let input;
  if(name==='category'||name==='shape'){input=create('select');const options=name==='category'?{pottery:'Посуда',figures:'Фигурки',painting:'Роспись'}:{'':'Обычный',tall:'Высокий',wide:'Широкий'};for(const [v,t]of Object.entries(options)){const o=create('option','',t);o.value=v;input.append(o);}}
  else {input=create(['description','text'].includes(name)?'textarea':'input');input.maxLength=10000;}
  input.name=name;input.value=value||'';if(['title','text','image','href'].includes(name))input.required=true;label.append(input);return label;
}
function openEditor(row,isNew=false){editing={...structuredClone(row),isNew};dirty=false;$('#edit-title').textContent=isNew?'Добавить элемент':'Редактирование';const fields=$('#fields');fields.replaceChildren();for(const [key,value]of Object.entries(row.data))fields.append(field(key,value));
  if('image'in row.data){const preview=create('img');preview.alt='Предпросмотр';preview.src=safeURL(row.data.image,true);fields.append(preview);const input=fields.querySelector('[name=image]');input.addEventListener('input',()=>preview.src=safeURL(input.value,true));
    const choose=create('select');choose.setAttribute('aria-label','Выбрать фотографию');const opt=create('option','','Выбрать из фотографий…');opt.value='';choose.append(opt);for(const url of imageURLs()){const o=create('option','',url.split('/').pop());o.value=url;choose.append(o);}choose.onchange=()=>{if(choose.value){input.value=choose.value;preview.src=safeURL(choose.value,true);dirty=true;}};fields.append(choose);
    const upload=create('input');upload.type='file';upload.accept='image/jpeg,image/png,image/webp';const label=create('label','','Загрузить новую фотографию (до 5 МБ)');label.append(upload);fields.append(label);upload.onchange=()=>run(async()=>{if(!upload.files[0])return;const url=await uploadFile(upload.files[0]);input.value=url;preview.src=url;dirty=true;notify('Фото загружено. Сохраните изменения элемента.');});
  }
  if(collectionKinds.includes(row.kind)){const label=create('label','','Опубликовать на сайте');const box=create('input');box.type='checkbox';box.name='published';box.checked=row.published;label.prepend(box);fields.append(label);}
  $('#editor').showModal();
}
function imageURLs(){return [...new Set([...rows.map(r=>r.data.image).filter(Boolean),...media.map(f=>db.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl)])];}
$('#edit-form').oninput=()=>dirty=true;
function closeEditor(){if(dirty&&!confirm('Закрыть без сохранения изменений?'))return;$('#editor').close();dirty=false;}
$('#cancel').onclick=closeEditor;$('#close-editor').onclick=closeEditor;$('#editor').addEventListener('cancel',e=>{e.preventDefault();if(!busy)closeEditor();});
$('#edit-form').onsubmit=e=>{e.preventDefault();run(async()=>{await authorized();const f=new FormData(e.target),data={};for(const key of Object.keys(editing.data)){data[key]=String(f.get(key)||'');if(data[key].length>10000)throw new Error('Слишком длинный текст.');}if(data.image&&!safeURL(data.image,true))throw new Error('Укажите HTTPS-адрес фото или выберите фото из библиотеки.');if(data.href&&!safeURL(data.href))throw new Error('Разрешены ссылки HTTPS, tel и mailto.');const row={id:editing.id,section:editing.section,label:(data.title||data.text||editing.label).slice(0,200),kind:editing.kind,data,position:editing.position,published:collectionKinds.includes(editing.kind)?f.has('published'):true};
  if(editing.isNew)check(await db.from('site_content').insert(row));else{const changed=check(await db.from('site_content').update(row).eq('id',row.id).eq('updated_at',editing.updated_at).select('id'));if(!changed.length)throw new Error('Элемент изменён в другой вкладке. Закройте форму и обновите страницу.');}
  dirty=false;$('#editor').close();await refresh();render();notify('Изменения сохранены.');});};
async function uploadFile(file){const type=await validateImage(file);await authorized();const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[type];const path=crypto.randomUUID()+'.'+ext;check(await db.storage.from(BUCKET).upload(path,file,{contentType:type,upsert:false,cacheControl:'3600'}));await refresh();return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;}
function renderPhotos(host){const intro=create('div','panel');intro.append(create('h2','','Фотографии мастерской'),create('p','muted','JPG, PNG или WebP, до 5 МБ. Загрузите фото, затем выберите его при редактировании страницы.'));const upload=create('input');upload.type='file';upload.accept='image/jpeg,image/png,image/webp';const label=create('label','','Добавить фотографию');label.append(upload);intro.append(label);host.append(intro);upload.onchange=()=>run(async()=>{if(!upload.files[0])return;await uploadFile(upload.files[0]);render();notify('Фотография загружена.');});
  const grid=create('div','photo-grid');for(const url of imageURLs()){const card=create('article','photo-card');const img=create('img');img.src=safeURL(url,true);img.alt='Фотография мастерской';img.loading='lazy';card.append(img,create('p','',url.split('/').pop()));const refs=rows.filter(r=>r.data.image===url||safeURL(r.data.image,true)===url);card.append(create('p','muted',refs.length?'Используется: '+refs.length:'Можно использовать на странице'));
    const file=media.find(f=>db.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl===url);
    if(file)card.append(button('Удалить файл',async()=>{await refresh();if(rows.some(r=>r.data.image===url))throw new Error('Сначала замените фото во всех элементах, включая скрытые.');if(!confirm('Удалить фотографию из хранилища?'))return;check(await db.storage.from(BUCKET).remove([file.name]));await refresh();render();notify('Файл удалён.');},'danger'));else card.append(create('p','muted','Исходное фото сайта — заменяется в разделе «Страницы».'));grid.append(card);}host.append(grid);
}
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
try{db=await getClient();$('#connection').textContent='Вход доступен только владельцу сайта.';db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')lock();});const {data,error}=await db.auth.getSession();if(error)throw error;if(data.session)await run(enter);}catch(e){$('#connection').textContent=e.message;notify(e.message,true);}
