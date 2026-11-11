// Local browser checks only; does not simulate successful Supabase operations.
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
const root=process.cwd();
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
 let seq=0;const pending=new Map();const errors=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(Error(m.error.message));else p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 await call('Runtime.enable');await call('Page.enable');
 const assert=(ok,name)=>{if(!ok)throw Error(name);console.log('PASS '+name);};
 const navigate=async pathname=>{await call('Page.navigate',{url:'http://127.0.0.1:8087/'+pathname});await sleep(600);};
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await navigate('');
 assert(await evaluate('document.querySelectorAll(".gallery-item").length===5 && document.querySelectorAll(".class-card").length===3'),'original fallback content');
 await evaluate('document.querySelector("[data-filter=figures]").click()');
 assert(await evaluate('[...document.querySelectorAll(".class-card")].filter(e=>!e.hidden).length===1'),'original filters');
 await evaluate('document.querySelector(".gallery-item").click()');assert(await evaluate('document.querySelector("#lightbox").open'),'original gallery');await evaluate('document.querySelector("#lightbox").close()');
 await evaluate(`(async()=>{const {applyContent}=await import('./cms-render.js');const rows=await (await fetch('./cms-seed.json')).json();rows.find(r=>r.kind==='text').data.text='<img src=x onerror=alert(1)>';rows.push({...rows.find(r=>r.kind==='gallery'),id:'qa-new',data:{...rows.find(r=>r.kind==='gallery').data,title:'QA photo'}});applyContent(rows);})()`);
 assert(await evaluate('document.querySelectorAll(".gallery-item").length===6'),'dynamic collection addition');
 assert(await evaluate('document.querySelector("[data-cms-text]").textContent.includes("<img") && !document.querySelector("[data-cms-text] img")'),'XSS text escaping');
 await evaluate('document.querySelectorAll(".gallery-item")[5].click()');assert(await evaluate('document.querySelector("#lightbox").open && document.querySelector("#lightbox figcaption").textContent.includes("6 / 6")'),'dynamic gallery lightbox');await evaluate('document.querySelector("#lightbox").close()');
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await navigate('');
 assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'public mobile width');
 await evaluate('document.querySelector(".menu").click()');assert(await evaluate('document.querySelector(".header nav").classList.contains("open")'),'mobile menu');
 await writeFile('qa-artifacts/public-mobile.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await navigate('admin/');assert(await evaluate('!document.querySelector("#login").hidden && document.querySelector("#workspace").hidden'),'admin protected by login');
 assert(await evaluate('document.querySelector("#connection").textContent.includes("cms-config.js")'),'missing configuration message');assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'login mobile width');
 await writeFile('qa-artifacts/admin-mobile.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
 // Inspect panel layout only; deliberately no auth/network mock and no claim of successful login.
 await evaluate('document.querySelector("#login").hidden=true;document.querySelector("#workspace").hidden=false');assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'panel shell mobile width');
 const checks=await evaluate(`(async()=>{const m=await import('../cms-client.js');const results=[m.safeURL('javascript:alert(1)')==='',m.safeURL('data:text/html,x',true)==='',m.safeURL('https://example.org/photo.jpg',true)!==''];for(const f of [new File(['<svg/>'],'bad.png',{type:'image/png'}),new File([new Uint8Array(5242881)],'big.jpg',{type:'image/jpeg'})]){try{await m.validateImage(f);results.push(false);}catch{results.push(true);}}return results.every(Boolean);})()`);assert(checks,'unsafe URLs, forged image and oversize upload rejected');
 assert(errors.length===0,'no uncaught browser exceptions');
 await writeFile('qa-artifacts/result.txt','All local browser checks passed. Live Supabase checks not performed.\n');
 await call('Browser.close').catch(()=>{});
}finally{if(ws)ws.close();server.kill();chrome.kill();}
