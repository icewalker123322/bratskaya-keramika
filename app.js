const $=(s)=>document.querySelector(s);
$('#year').textContent=new Date().getFullYear();
$('.menu').addEventListener('click',()=>{const open=$('.menu').getAttribute('aria-expanded')!=='true';$('.menu').setAttribute('aria-expanded',String(open));$('.header nav').classList.toggle('open',open)});
document.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',()=>{$('.header nav').classList.remove('open');$('.menu').setAttribute('aria-expanded','false')}));
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button))});document.querySelectorAll('.class-card').forEach(card=>card.hidden=button.dataset.filter!=='all'&&card.dataset.category!==button.dataset.filter)}));
const gallery=()=>[...document.querySelectorAll('[data-image]')];let imageIndex=0;
function showImage(i){const items=gallery();if(!items.length)return;imageIndex=(i+items.length)%items.length;const item=items[imageIndex];$('#lightbox img').src=item.dataset.image;$('#lightbox img').alt=item.querySelector('img').alt;$('#lightbox figcaption').textContent=`${item.dataset.caption} · ${imageIndex+1} / ${items.length}`}
document.querySelector('.gallery').addEventListener('click',e=>{const item=e.target.closest('[data-image]');if(!item)return;showImage(gallery().indexOf(item));$('#lightbox').showModal()});
document.addEventListener('cms:updated',()=>document.querySelector('[data-filter].active')?.click());
$('.lightbox-prev').addEventListener('click',()=>showImage(imageIndex-1));$('.lightbox-next').addEventListener('click',()=>showImage(imageIndex+1));
$('#lightbox').addEventListener('keydown',e=>{if(e.key==='ArrowLeft')showImage(imageIndex-1);if(e.key==='ArrowRight')showImage(imageIndex+1)});
document.querySelectorAll('dialog').forEach(dialog=>{dialog.querySelector('.close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}})});
