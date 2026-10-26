const crypto=require('node:crypto');
const {handlerFactory,issueToken}=require('./credit-application');
const schema=require('../lib/credit-fields.json');
module.exports=async (req,res)=>{
 res.setHeader('Cache-Control','no-store');
 const expected=process.env.CREDIT_DELIVERY_TEST_TOKEN;
 const supplied=req.headers.authorization?.replace(/^Bearer /,'');
 if(req.method!=='POST'||!expected||!supplied||supplied.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return res.status(404).json({message:'Not found'});
 const values={consent:'on'};
 for(const item of schema){
  if(!item.required||item.joint)continue;
  values[item.name]=item.type==='date'?'2000-01-01':item.type==='number'?'0':item.type==='email'?'test@example.invalid':item.name.endsWith('_ssn')?'000-00-0000':item.name.endsWith('_residence')?'Rent':'TEST ONLY - NOT A REAL APPLICATION';
 }
 const password=(process.env.GMAIL_APP_PASSWORD||'').replace(/\s/g,'');
 if(!process.env.GMAIL_USER || !/^[a-zA-Z0-9]{16}$/.test(password))return res.status(503).json({gmailUserConfigured:!!process.env.GMAIL_USER,passwordConfigured:!!password,normalizedPasswordLength:password.length,passwordFormatValid:/^[a-zA-Z0-9]{16}$/.test(password)});
 req.method='POST';req.headers.origin='https://triplecauto-motorsports.com';req.headers['content-type']='application/json';
 req.body={token:issueToken(password,Date.now()-5000),values};
 return handlerFactory({env:{...process.env,CREDIT_APPLICATION_ENABLED:'true'}})(req,res);
};
