const crypto=require('node:crypto');
const nodemailer=require('nodemailer');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 const expected=process.env.CREDIT_DELIVERY_TEST_TOKEN;
 const supplied=req.headers.authorization?.replace(/^Bearer /,'');
 if(req.method!=='POST'||!expected||!supplied||supplied.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return res.status(404).json({message:'Not found'});
 const transport=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,auth:{user:process.env.GMAIL_USER,pass:(process.env.GMAIL_APP_PASSWORD||'').replace(/\s/g,'')},tls:{minVersion:'TLSv1.2',rejectUnauthorized:true},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,logger:false,debug:false});
 try {await transport.verify();console.info('gmail_delivery_check AUTH_OK');return res.status(200).json({ok:true});}
 catch(error){
 const code=['EAUTH','ETIMEDOUT','ECONNECTION','ESOCKET'].includes(error.code)?error.code:'OTHER';
 const smtp=[421,450,454,530,534,535].includes(error.responseCode)?error.responseCode:0;
 const response=typeof error.response==='string'?error.response:'';
 const reason=/BadCredentials/i.test(response)?'BAD_CREDENTIALS':/InvalidSecondFactor/i.test(response)?'INVALID_SECOND_FACTOR':/WebLoginRequired/i.test(response)?'WEB_LOGIN_REQUIRED':/application.specific password|required.*app password/i.test(response)?'APP_PASSWORD_REQUIRED':'UNCLASSIFIED';
 console.error('gmail_delivery_check',code,smtp,reason);
 return res.status(502).json({ok:false});
 }finally{transport.close();}
};