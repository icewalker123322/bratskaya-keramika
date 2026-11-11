// Live Auth/RLS smoke check. Password enters only via hidden stdin, not files/arguments.
import https from 'node:https';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {OWNER_LOGIN,resolveLogin} from './admin/auth-config.js';
const sandbox={window:{}};vm.runInNewContext(await readFile(new URL('./cms-config.js',import.meta.url),'utf8'),sandbox);
const config=sandbox.window.CMS_CONFIG;
const request=(pathname,method='GET',body,token,type='application/json')=>new Promise((resolve,reject)=>{
 const payload=body===undefined?undefined:Buffer.isBuffer(body)?body:Buffer.from(JSON.stringify(body));
 const req=https.request(new URL(pathname,config.url),{method,headers:{apikey:config.publishableKey,...(payload?{'Content-Type':type,'Content-Length':payload.length}:{}),...(token?{Authorization:'Bearer '+token}:{}),Prefer:'return=representation'}},r=>{let text='';r.on('data',b=>text+=b);r.on('end',()=>{let data;try{data=JSON.parse(text);}catch{data=null;}resolve({status:r.statusCode,data});});});
 req.on('error',reject);req.setTimeout(20000,()=>req.destroy(Error('Request timeout')));req.end(payload);
});
function assert(ok,label){if(!ok)throw Error(label);console.log('PASS '+label);}
if(process.stdin.isTTY)process.stdin.setRawMode(true);
console.log('Ready for password JSON on stdin (input hidden).');
let input='';process.stdin.setEncoding('utf8');
process.stdin.on('data',async chunk=>{input+=chunk;if(!/[\r\n]/.test(input))return;process.stdin.pause();let token,id,fileName,exitCode=0;
 try{
  const {password,cleanup=[]}=JSON.parse(input.trim());input='';
  const login=await request('/auth/v1/token?grant_type=password','POST',{email:resolveLogin(OWNER_LOGIN),password});
  assert(login.status===200&&login.data?.access_token,'real password sign-in');token=login.data.access_token;
  if(cleanup.length){const result=await request('/storage/v1/object/site-images','DELETE',{prefixes:cleanup},token);assert(result.status===200&&result.data.length===cleanup.length,'previous verification images removed');}
  const membership=await request('/rest/v1/site_admins?select=user_id','GET',undefined,token);assert(membership.status===200&&membership.data.length===1,'owner membership under RLS');
  const visible=await request('/rest/v1/site_content?select=id');assert(visible.status===200&&visible.data.some(row=>row.id==='settings'),'public reads published content');
  const forbidden=await request('/rest/v1/site_content','POST',{id:'qa-denied',section:'QA',label:'QA',kind:'faq',data:{title:'QA'},published:false});assert(forbidden.status>=400,'anonymous write denied');
  id='qa-'+crypto.randomUUID();const created=await request('/rest/v1/site_content','POST',{id,section:'QA',label:'QA',kind:'faq',data:{title:'Temporary verification'},published:false},token);assert(created.status===201,'owner creates hidden content');
  const hidden=await request('/rest/v1/site_content?id=eq.'+id+'&select=id');assert(hidden.status===200&&hidden.data.length===0,'hidden content excluded from public API');
  const changed=await request('/rest/v1/site_content?id=eq.'+id,'PATCH',{data:{title:'Updated verification'}},token);assert(changed.status===200&&changed.data[0]?.data.title==='Updated verification','owner saves content');
  const files=await request('/storage/v1/object/list/site-images','POST',{prefix:'',limit:1},token);console.log('Storage listing HTTP '+files.status+' (bucket setup checked separately).');
  if(process.argv.includes('--storage')){
   fileName=crypto.randomUUID()+'.jpg';const bytes=await readFile(new URL('./assets/koi-bowl.jpg',import.meta.url));
   const denied=await request('/storage/v1/object/site-images/'+fileName,'POST',bytes,undefined,'image/jpeg');assert(denied.status>=400,'anonymous image upload denied');
   const upload=await request('/storage/v1/object/site-images/'+fileName,'POST',bytes,token,'image/jpeg');assert(upload.status===200,'real owner image upload');
   const publicURL=config.url+'/storage/v1/object/public/site-images/'+fileName;
   const referenced=await request('/rest/v1/site_content?id=eq.'+id,'PATCH',{data:{title:'Storage verification',image:publicURL}},token);assert(referenced.status===200,'photo replacement saved in hidden item');
   const publicFile=await request('/storage/v1/object/public/site-images/'+fileName+'?qa='+Date.now());assert(publicFile.status===200,'uploaded image publicly available');
   const blocked=await request('/storage/v1/object/site-images','DELETE',{prefixes:[fileName]},token);assert(blocked.status>=400||Array.isArray(blocked.data)&&blocked.data.length===0,'used image deletion blocked by RLS');
   await request('/rest/v1/site_content?id=eq.'+id,'PATCH',{data:{title:'Storage verification'}},token);
   const removedFile=await request('/storage/v1/object/site-images','DELETE',{prefixes:[fileName]},token);if(!(removedFile.status===200&&Array.isArray(removedFile.data)&&removedFile.data.length===1))throw Error('Unused image deletion: '+JSON.stringify(removedFile));console.log('PASS unused image deletion succeeds');fileName=undefined;
   const svg=await request('/storage/v1/object/site-images/'+crypto.randomUUID()+'.png','POST',Buffer.from('<svg/>'),token,'image/svg+xml');assert(svg.status>=400,'server rejects forbidden MIME');
   const big=await request('/storage/v1/object/site-images/'+crypto.randomUUID()+'.jpg','POST',Buffer.alloc(5242881),token,'image/jpeg');assert(big.status>=400,'server rejects image over 5 MB');
  }
 }catch(e){exitCode=1;console.error('FAIL '+e.message);}finally{
  if(id&&token){const removed=await request('/rest/v1/site_content?id=eq.'+id,'DELETE',undefined,token);if(removed.status!==200){console.error('FAIL verification row cleanup');exitCode=1;}else console.log('PASS verification row removed');}
  if(fileName&&token)await request('/storage/v1/object/site-images','DELETE',{prefixes:[fileName]},token);
  if(token){const logout=await request('/auth/v1/logout','POST',undefined,token);if(logout.status!==204){console.error('FAIL sign-out');exitCode=1;}else console.log('PASS real sign-out');}
  process.exit(exitCode);
 }
});
