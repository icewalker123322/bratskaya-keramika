// Live Auth/RLS smoke check. Password enters only via hidden stdin, not files/arguments.
import https from 'node:https';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {OWNER_LOGIN,resolveLogin} from './admin/auth-config.js';
const sandbox={window:{}};vm.runInNewContext(await readFile(new URL('./cms-config.js',import.meta.url),'utf8'),sandbox);
const config=sandbox.window.CMS_CONFIG;
const request=(pathname,method='GET',body,token)=>new Promise((resolve,reject)=>{
 const req=https.request(new URL(pathname,config.url),{method,headers:{apikey:config.publishableKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),Prefer:'return=representation'}},r=>{let text='';r.on('data',b=>text+=b);r.on('end',()=>{let data;try{data=JSON.parse(text);}catch{data=null;}resolve({status:r.statusCode,data});});});
 req.on('error',reject);req.setTimeout(20000,()=>req.destroy(Error('Request timeout')));req.end(body===undefined?undefined:JSON.stringify(body));
});
function assert(ok,label){if(!ok)throw Error(label);console.log('PASS '+label);}
if(process.stdin.isTTY)process.stdin.setRawMode(true);
console.log('Ready for password JSON on stdin (input hidden).');
let input='';process.stdin.setEncoding('utf8');
process.stdin.on('data',async chunk=>{input+=chunk;if(!/[\r\n]/.test(input))return;process.stdin.pause();let token,id,exitCode=0;
 try{
  const {password}=JSON.parse(input.trim());input='';
  const login=await request('/auth/v1/token?grant_type=password','POST',{email:resolveLogin(OWNER_LOGIN),password});
  assert(login.status===200&&login.data?.access_token,'real password sign-in');token=login.data.access_token;
  const membership=await request('/rest/v1/site_admins?select=user_id','GET',undefined,token);assert(membership.status===200&&membership.data.length===1,'owner membership under RLS');
  const visible=await request('/rest/v1/site_content?select=id');assert(visible.status===200&&visible.data.length===96,'public reads original content');
  const forbidden=await request('/rest/v1/site_content','POST',{id:'qa-denied',section:'QA',label:'QA',kind:'faq',data:{title:'QA'},published:false});assert(forbidden.status>=400,'anonymous write denied');
  id='qa-'+crypto.randomUUID();const created=await request('/rest/v1/site_content','POST',{id,section:'QA',label:'QA',kind:'faq',data:{title:'Temporary verification'},published:false},token);assert(created.status===201,'owner creates hidden content');
  const hidden=await request('/rest/v1/site_content?id=eq.'+id+'&select=id');assert(hidden.status===200&&hidden.data.length===0,'hidden content excluded from public API');
  const changed=await request('/rest/v1/site_content?id=eq.'+id,'PATCH',{data:{title:'Updated verification'}},token);assert(changed.status===200&&changed.data[0]?.data.title==='Updated verification','owner saves content');
  const files=await request('/storage/v1/object/list/site-images','POST',{prefix:'',limit:1},token);console.log('Storage listing HTTP '+files.status+' (bucket setup checked separately).');
 }catch(e){exitCode=1;console.error('FAIL '+e.message);}finally{
  if(id&&token){const removed=await request('/rest/v1/site_content?id=eq.'+id,'DELETE',undefined,token);if(removed.status!==200){console.error('FAIL verification row cleanup');exitCode=1;}else console.log('PASS verification row removed');}
  if(token){const logout=await request('/auth/v1/logout','POST',undefined,token);if(logout.status!==204){console.error('FAIL sign-out');exitCode=1;}else console.log('PASS real sign-out');}
  process.exit(exitCode);
 }
});
