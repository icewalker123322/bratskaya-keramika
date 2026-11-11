// Local browser checks only; does not simulate successful Supabase operations.
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
const root=process.cwd();
let password;
if(process.argv.includes('--auth')){
 if(process.stdin.isTTY)process.stdin.setRawMode(true);
 console.log('Ready for password JSON on stdin (input hidden).');
 password=await new Promise(resolve=>{let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>{input+=chunk;if(/[\r\n]/.test(input)){process.stdin.pause();resolve(JSON.parse(input.trim()).password);}});});
}
await mkdir('qa-artifacts',{recursive:true});
const server=spawn('python',['-m','http.server','8087','--bind','127.0.0.1'],{cwd:root,windowsHide:true,stdio:'ignore'});
const chrome=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9337','--user-data-dir='+path.join(root,'qa-artifacts','chrome-profile'),'about:blank'],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws;
const get=url=>new Promise((resolve,reject)=>{const req=http.get(url,r=>{let data='';r.on('data',b=>data+=b);r.on('end',()=>resolve({ok:r.statusCode===200,json:()=>JSON.parse(data)}));});req.setTimeout(2000,()=>req.destroy(Error('Request timeout')));req.on('error',reject);});
async function waitURL(url){for(let i=0;i<60;i++){try{const r=await get(url);if(r.ok)return r;}catch{}await sleep(250);}throw Error('Unavailable: '+url);}
try{
 await waitURL('http://127.0.0.1:8087/');
 const targets=await (await waitURL('http://127.0.0.1:9337/json')).json();
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let seq=0;const pending=new Map();const errors=[];let confirmTestAction=false;
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(Error(m.error.message));else p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);if(m.method==='Page.javascriptDialogOpening'&&confirmTestAction)call('Page.handleJavaScriptDialog',{accept:true});};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 await call('Runtime.enable');await call('Page.enable');await call('Network.enable');
 await call('Page.addScriptToEvaluateOnNewDocument',{source:"document.addEventListener('cms:updated',()=>window.__cmsLoaded=true);"});
 const assert=(ok,name)=>{if(!ok)throw Error(name);console.log('PASS '+name);};
 const base=process.env.QA_SITE_URL||'http://127.0.0.1:8087/';
 const navigate=async pathname=>{await call('Page.navigate',{url:new URL(pathname,base).href});await sleep(1000);};
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await navigate('');
 for(let i=0;i<48&&!await evaluate('window.__cmsLoaded===true');i++)await sleep(250);
 assert(await evaluate('window.__cmsLoaded===true'),'real public Supabase content loaded');
 assert(await evaluate('!performance.getEntriesByType("resource").some(r=>new URL(r.name).hostname==="esm.sh")'),'public page does not load auth CDN');
 assert(await evaluate('Object.keys(sessionStorage).length===0 && document.cookie===""'),'public page has no app session or cookies');
 const brokenImages=await evaluate(`Promise.all([...document.images].filter(i=>!i.closest('dialog')).map(async i=>{i.loading='eager';try{await Promise.race([i.decode(),new Promise((_,reject)=>setTimeout(()=>reject(Error('timeout')),15000))]);return null;}catch{return i.src;}})).then(images=>images.filter(Boolean))`);
 assert(brokenImages.length===0,'public images loaded'+(brokenImages.length?': '+brokenImages.join(', '):''));
 assert(await evaluate('document.querySelectorAll(".brand-logo").length===2 && !document.querySelector(".brand-mark")'),'client logo replaces both old marks');
 assert(await evaluate('document.querySelector(".social-bot").href==="https://t.me/BratMasterBot" && document.querySelector(".social-bot").textContent.includes("@BratMasterBot")'),'Telegram bot contact survives CMS load');
 for(const width of [360,390,768,1440]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<800});
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),`logo and contacts width ${width}`);
  if(width===390){await evaluate('scrollTo(0,0)');await writeFile('qa-artifacts/logo-mobile-header.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));await evaluate('document.querySelector(".social-bot").scrollIntoView({block:"center",behavior:"instant"})');await writeFile('qa-artifacts/logo-mobile-contacts.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));}
 }
 await evaluate('scrollTo(0,0)');await writeFile('qa-artifacts/logo-desktop.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
 assert(await evaluate('document.querySelectorAll(".gallery-item").length===5 && document.querySelectorAll(".class-card").length===3'),'original fallback content');
 await evaluate('document.querySelector("[data-filter=figures]").click()');
 assert(await evaluate('[...document.querySelectorAll(".class-card")].filter(e=>!e.hidden).length===1'),'original filters');
 await evaluate('document.querySelector(".gallery-item").click()');assert(await evaluate('document.querySelector("#lightbox").open'),'original gallery');await evaluate('document.querySelector("#lightbox").close()');
 await evaluate(`(async()=>{const {applyContent}=await import('./cms-render.js');const rows=await (await fetch('./cms-seed.json')).json();rows.find(r=>r.id===document.querySelector('[data-cms-text]').dataset.cmsText).data.text='<img src=x onerror=alert(1)>';rows.push({...rows.find(r=>r.kind==='gallery'),id:'qa-new',data:{...rows.find(r=>r.kind==='gallery').data,title:'QA photo'}});applyContent(rows);})()`);
 assert(await evaluate('document.querySelectorAll(".gallery-item").length===6'),'dynamic collection addition');
 assert(await evaluate('document.querySelector("[data-cms-text]").textContent.includes("<img") && !document.querySelector("[data-cms-text] img")'),'XSS text escaping');
 await evaluate('document.querySelectorAll(".gallery-item")[5].click()');assert(await evaluate('document.querySelector("#lightbox").open && document.querySelector("#lightbox figcaption").textContent.includes("6 / 6")'),'dynamic gallery lightbox');await evaluate('document.querySelector("#lightbox").close()');
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await navigate('');
 assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'public mobile width');
 await evaluate('document.querySelector(".menu").click()');assert(await evaluate('document.querySelector(".header nav").classList.contains("open")'),'mobile menu');
 await writeFile('qa-artifacts/public-mobile.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await navigate('admin/');assert(await evaluate('!document.querySelector("#login").hidden && document.querySelector("#workspace").hidden'),'admin protected by login');
 assert(await evaluate('document.querySelector("[name=login]").type==="text" && !document.querySelector("[type=email]")'),'username login field');assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'login mobile width');
 await writeFile('qa-artifacts/admin-mobile.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
 if(password){
  await evaluate(`document.querySelector('[name=login]').value='glinamaster';document.querySelector('[name=password]').value=${JSON.stringify(password)};document.querySelector('#login-form').requestSubmit();`);password=undefined;
  for(let i=0;i<100&&await evaluate('document.querySelector("#workspace").hidden');i++)await sleep(250);
  assert(await evaluate('!document.querySelector("#workspace").hidden'),'real admin UI sign-in');
  for(const width of [360,390,768,1440]){
   await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<800});
   for(const tab of ['home','pages','photos','settings']){await evaluate(`document.querySelector('[data-view=${tab}]').click()`);await sleep(50);assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),`admin ${tab} width ${width}`);}
  }
  await evaluate('document.querySelector("[data-view=pages]").click();[...document.querySelectorAll(".row")].find(r=>r.textContent.includes("Контакты")).querySelector("button").click()');
  assert(await evaluate('document.querySelector("#editor").open'),'real content edit form opens');await evaluate('document.querySelector("#cancel").click()');
  await evaluate(`[...document.querySelectorAll('.toolbar button')].find(b=>b.textContent.includes('Вопрос')).click()`);await sleep(100);
  await evaluate(`document.querySelector('#fields [name=title]').value='QA временная проверка';document.querySelector('#fields [name=description]').value='Скрытый тест';document.querySelector('#edit-form').requestSubmit();`);
  for(let i=0;i<60&&!await evaluate('[...document.querySelectorAll(".row")].some(r=>r.textContent.includes("QA временная проверка"))');i++)await sleep(250);
  assert(await evaluate('[...document.querySelectorAll(".row")].some(r=>r.textContent.includes("QA временная проверка")&&r.textContent.includes("Скрыто"))'),'real UI saves hidden FAQ');
  confirmTestAction=true;
  await evaluate(`void [...document.querySelectorAll('.row')].find(r=>r.textContent.includes('QA временная проверка')).querySelector('.danger').click()`);
  for(let i=0;i<60&&await evaluate('[...document.querySelectorAll(".row")].some(r=>r.textContent.includes("QA временная проверка"))');i++)await sleep(250);
  assert(await evaluate('![...document.querySelectorAll(".row")].some(r=>r.textContent.includes("QA временная проверка"))'),'real UI deletes test FAQ');
  await evaluate('document.querySelector("[data-view=photos]").click()');
  const beforePhotos=await evaluate('document.querySelectorAll(".photo-card").length');
  const dom=await call('DOM.getDocument');const fileInput=await call('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#view input[type=file]'});
  await call('DOM.setFileInputFiles',{nodeId:fileInput.nodeId,files:[path.join(root,'assets','koi-bowl.jpg')]});
  for(let i=0;i<80&&await evaluate('document.querySelectorAll(".photo-card").length')===beforePhotos;i++)await sleep(250);
  assert(await evaluate('document.querySelectorAll(".photo-card").length')===beforePhotos+1,'real UI uploads image from device');
  await evaluate(`void [...document.querySelectorAll('.photo-card')].find(c=>c.querySelector('.danger')&&c.textContent.includes('Можно использовать')).querySelector('.danger').click()`);
  for(let i=0;i<60&&await evaluate('document.querySelectorAll(".photo-card").length')!==beforePhotos;i++)await sleep(250);
  assert(await evaluate('document.querySelectorAll(".photo-card").length')===beforePhotos,'real UI deletes unused test image');confirmTestAction=false;
  await evaluate('document.querySelector("#logout").click()');
  for(let i=0;i<40&&await evaluate('document.querySelector("#login").hidden');i++)await sleep(250);
  assert(await evaluate('!document.querySelector("#login").hidden && document.querySelector("#workspace").hidden'),'real admin UI sign-out');
 }
 const checks=await evaluate(`(async()=>{const m=await import('../cms-client.js');const results=[m.safeURL('javascript:alert(1)')==='',m.safeURL('data:text/html,x',true)==='',m.safeURL('https://example.org/photo.jpg',true)!==''];for(const f of [new File(['<svg/>'],'bad.png',{type:'image/png'}),new File([new Uint8Array(5242881)],'big.jpg',{type:'image/jpeg'})]){try{await m.validateImage(f);results.push(false);}catch{results.push(true);}}return results.every(Boolean);})()`);assert(checks,'unsafe URLs, forged image and oversize upload rejected');
 assert(errors.length===0,'no uncaught browser exceptions');
 await writeFile('qa-artifacts/result.txt','Browser checks passed against '+base+'. Real public Supabase read verified. Auth UI tested only with --auth.\n');
 await call('Browser.close').catch(()=>{});
}finally{if(ws)ws.close();server.kill();chrome.kill();}
