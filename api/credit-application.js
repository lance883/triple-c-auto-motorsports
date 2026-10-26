const crypto = require('node:crypto');
const nodemailer = require('nodemailer');
const { validate, makePdf, lines, AUTHORIZATION } = require('../lib/application');
const RECIPIENT = 'lance@triplecauto-motorsports.com';
const ALLOWED = new Set(['https://triplecauto-motorsports.com', 'https://www.triplecauto-motorsports.com']);
const MAX_BYTES = 32768;
// Defense in depth only: instance-local limits are not a distributed quota.
// Keep Vercel's managed firewall enabled. Recipient and subject are fixed.
const attempts = new Map();
const used = new Map();
function rateLimit(key, now) {
  for (const [k,v] of attempts) if (now-v.start>3600000) attempts.delete(k);
  for (const [k,v] of used) if (now-v.time>7200000) used.delete(k);
  if (attempts.size>5000 || used.size>5000) return false;
  const record=attempts.get(key)||{start:now,count:0};
  record.count++; attempts.set(key,record);
  return record.count<=5;
}
function sign(payload, secret) { return crypto.createHmac('sha256', secret).update(payload).digest('base64url'); }
function issueToken(secret, now=Date.now()) {
  const payload=Buffer.from(JSON.stringify({at:now,id:crypto.randomUUID()})).toString('base64url');
  return `${payload}.${sign(payload,secret)}`;
}
function verifyToken(token, secret, now=Date.now()) {
  if (typeof token!=='string' || token.length>500) return null;
  const [payload,signature,...rest]=token.split('.');
  if (!payload||!signature||rest.length) return null;
  const expected=sign(payload,secret);
  if(signature.length!==expected.length || !crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected))) return null;
  try { const data=JSON.parse(Buffer.from(payload,'base64url').toString());return typeof data.id==='string' && Number.isFinite(data.at) && now-data.at>=3000 && now-data.at<=7200000 ? data : null; } catch { return null; }
}
function handlerFactory(overrides={}) {
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store, max-age=0');
    res.setHeader('X-Content-Type-Options','nosniff');
    const send=(status,data)=>res.status(status).json(data);
    if (!['GET','POST'].includes(req.method)) { res.setHeader('Allow','GET, POST');return send(405,{message:'Method not allowed.'}); }
    const env=overrides.env||process.env;
    const password=(env.GMAIL_APP_PASSWORD||'').replace(/\s/g,'');
    const ready=env.CREDIT_APPLICATION_ENABLED==='true' && /^[a-zA-Z0-9]{16}$/.test(password) && !!env.GMAIL_USER;
    if (!ready) return send(503,{ready:false,message:'Online applications are unavailable. Please call (870) 291-9233.'});
    if(req.method==='GET') return send(200,{ready:true,token:issueToken(password)});
    const origin=req.headers.origin;
    if(!ALLOWED.has(origin)) return send(403,{message:'Please submit from the Triple C website.'});
    if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||'')) return send(415,{message:'Invalid submission format.'});
    const now=Date.now();
    const ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0];
    if(!rateLimit(ip,now)) return send(429,{message:'Too many attempts. Please wait an hour or call (870) 291-9233.'});
    let body;
    try {
      const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);
      if(!raw||Buffer.byteLength(raw)>MAX_BYTES) return send(413,{message:'Application is too large.'});
      body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    } catch { return send(400,{message:'Invalid submission format.'}); }
    if(!body || typeof body!=='object' || body.values?.website) return send(400,{message:'Invalid submission.'});
    const token=verifyToken(body.token,password);
    if(!token) return send(400,{code:'EXPIRED',message:'Your session expired. Reload the form before trying again.'});
    const previous=used.get(token.id);
    if(previous?.status==='sent') return send(200,{reference:previous.reference});
    if(previous) return send(409,{message:'This application may already be processing. Please call (870) 291-9233 before submitting again.'});
    let values;
    try { values=validate(body.values); } catch(error) { return send(400,{message:error.message}); }
    const reference='TC-'+crypto.randomBytes(6).toString('hex').toUpperCase();
    used.set(token.id,{status:'pending',time:now,reference});
    let transport;
    let phase = "PDF";
    try {
      const pdf=await (overrides.makePdf||makePdf)(values,reference,new Date(now).toISOString());
      phase = "EMAIL";
      transport=(overrides.createTransport||nodemailer.createTransport)({
        host:'smtp.gmail.com', port:465, secure:true,
        auth:{user:env.GMAIL_USER,pass:password},
        tls:{minVersion:'TLSv1.2',rejectUnauthorized:true},
        connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,
        logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true
      });
      const result=await transport.sendMail({
        from:{name:'Triple C Credit Applications',address:env.GMAIL_USER},
        to:RECIPIENT,
        subject:`New credit application | ${reference}`,
        text:`CONFIDENTIAL — CREDIT APPLICATION\nReference: ${reference}\nReceived (UTC): ${new Date(now).toISOString()}\nApplication type: ${values.joint?'Joint':'Individual'}\n\n${lines(values).join('\n')}\n\n${AUTHORIZATION}\n\nElectronic signature and email delivery consent: Accepted.\n\nA PDF copy is attached.`,
        attachments:[{filename:`${reference}.pdf`,content:pdf,contentType:'application/pdf'}]
      });
      if(!result.accepted?.some(address=>String(address).toLowerCase()===RECIPIENT)) throw new Error('NOT_ACCEPTED');
      used.set(token.id,{status:'sent',time:now,reference});
      return send(200,{reference});
    } catch (error) {
      // Never log request bodies, SMTP error payloads, names, SSNs, or credentials.
      const category = phase === 'PDF' ? 'PDF_GENERATION_FAILED' : ['EAUTH','ETIMEDOUT','ECONNECTION','ESOCKET','ENOENT'].includes(error.code) ? error.code : 'EMAIL_FAILED';
      console.error('credit_application_delivery_unconfirmed', category);
      return send(502,{message:'We could not confirm delivery. Please call (870) 291-9233 before submitting again.'});
    } finally { transport?.close(); }
  };
}
module.exports=handlerFactory();
module.exports.handlerFactory=handlerFactory;
module.exports.issueToken=issueToken;
module.exports.verifyToken=verifyToken;
