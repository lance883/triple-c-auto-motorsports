const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validate,makePdf}=require('../lib/application');
const {handlerFactory,issueToken,verifyToken}=require('../api/credit-application');
const schema=require('../lib/credit-fields.json');
function fixture(joint=false) {
 const values={consent:'on'};
 if(joint)values.joint='yes';
 for(const item of schema){
  if(!item.required || (item.joint&&!joint))continue;
  let value='TEST ONLY';
  if(item.type==='date')value='2000-01-01';
  if(item.type==='number')value='1000';
  if(item.type==='email')value='test@example.invalid';
  if(item.type==='checkbox')value='on';
  if(item.name.endsWith('_ssn'))value='000-00-0000';
  if(item.name.endsWith('_residence'))value='Rent';
  values[item.name]=value;
 }
 return values;
}
const env={GMAIL_USER:'lance@triplecauto-motorsports.com',GMAIL_APP_PASSWORD:'abcdefghijklmnop',CREDIT_APPLICATION_ENABLED:'true'};
let seq=0;
async function request(handler,body,opts={}){
 const req={method:opts.method||'POST',headers:{origin:'https://triplecauto-motorsports.com','content-type':'application/json','x-forwarded-for':`192.0.2.${++seq}`,...opts.headers},body};
 let status,payload;
 await handler(req,{setHeader(){},status(s){status=s;return this},json(p){payload=p;return this}});
 return {status,payload};
}
const token=()=>issueToken(env.GMAIL_APP_PASSWORD,Date.now()-5000);
test('individual and joint applications retain required data',()=>{
 assert.equal(validate(fixture()).joint,false);
 assert.equal(validate(fixture(true)).joint,true);
 assert.throws(()=>validate({...fixture(),consent:''}));
 assert.throws(()=>validate({...fixture(),applicant_ssn:'123'}));
 assert.throws(()=>validate({...fixture(),applicant_date_of_birth:'2025-02-30'}));
 assert.throws(()=>validate({...fixture(),applicant_gross_monthly_income:'-12'}));
 assert.throws(()=>validate({...fixture(true),joint_intent:''}));
 assert.equal(validate({...fixture(),coapplicant_ssn:'discard'}).coapplicant_ssn,undefined);
});
test('tokens reject tampering, immediate use and expiry',()=>{
 assert.ok(verifyToken(token(),env.GMAIL_APP_PASSWORD));
 assert.equal(verifyToken(token()+'a',env.GMAIL_APP_PASSWORD),null);
 assert.equal(verifyToken(issueToken(env.GMAIL_APP_PASSWORD),env.GMAIL_APP_PASSWORD),null);
 assert.equal(verifyToken(issueToken(env.GMAIL_APP_PASSWORD,Date.now()-7200001),env.GMAIL_APP_PASSWORD),null);
});
test('missing credentials and disabled feature fail closed',async()=>{
 for(const config of [{},{...env,CREDIT_APPLICATION_ENABLED:'false'},{...env,GMAIL_APP_PASSWORD:''}]) {
  assert.equal((await request(handlerFactory({env:config}),{}, {method:'GET'})).status,503);
 }
});
test('bad origins, malformed bodies, honeypots and invalid apps cannot send',async()=>{
 let sent=0;
 const h=handlerFactory({env,createTransport:()=>{sent++;throw Error('Should not send')}});
 assert.equal((await request(h,{}, {headers:{origin:'https://other.invalid'}})).status,403);
 assert.equal((await request(h,'{')).status,400);
 assert.equal((await request(h,{token:token(),values:{website:'spam'}})).status,400);
 assert.equal((await request(h,{token:token(),values:{consent:'on'}})).status,400);
 assert.equal((await request(h,'x'.repeat(33000))).status,413);
 assert.equal(sent,0);
});
test('accepted SMTP delivery uses fixed recipient, TLS and PDF; duplicate token sends once',async()=>{
 let count=0,mail;
 const h=handlerFactory({env,makePdf:async()=>Buffer.from('%PDF-test'),createTransport:config=>{
  assert.equal(config.secure,true);assert.equal(config.tls.rejectUnauthorized,true);
  return {async sendMail(message){count++;mail=message;return {accepted:['lance@triplecauto-motorsports.com']}},close(){}};
 }});
 const data={token:token(),values:{...fixture(),to:'attacker@example.invalid'}};
 const result=await request(h,data);
 assert.equal(result.status,200);
 assert.equal(mail.to,'lance@triplecauto-motorsports.com');
 assert.equal(mail.attachments[0].contentType,'application/pdf');
 assert.ok(mail.text.includes('000-00-0000'));
 assert.equal((await request(h,data)).payload.reference,result.payload.reference);
 assert.equal(count,1);
});
test('SMTP errors never claim success or return sensitive error text',async()=>{
 const original=console.error;console.error=()=>{};
 try{
 const h=handlerFactory({env,makePdf:async()=>Buffer.from('pdf'),createTransport:()=>({async sendMail(){throw Error('SECRET')},close(){}})});
 const result=await request(h,{token:token(),values:fixture()});
 assert.equal(result.status,502);assert.ok(!JSON.stringify(result).includes('SECRET'));
 }finally{console.error=original;}
});
test('rate limiter rejects sixth attempt from same IP',async()=>{
 const h=handlerFactory({env});let result;
 for(let i=0;i<6;i++) result=await request(h,{}, {headers:{'x-forwarded-for':'192.0.2.200'}});
 assert.equal(result.status,429);
});
test('PDF output supports a long joint application',async()=>{
 const values=validate(fixture(true));
 for(const item of schema)if(item.type==='text')values[item.name]='TEST ONLY '+('Long test value '.repeat(10));
 const bytes=await makePdf(values,'TC-TEST-ONLY',new Date().toISOString());
 assert.equal(bytes.subarray(0,4).toString(),'%PDF');
 require('node:fs').writeFileSync('/tmp/triple-c-test-application.pdf',bytes);
});
