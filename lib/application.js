const PDFDocument = require('pdfkit');
const schema = require('./credit-fields.json');
const AUTHORIZATION = `I/We certify that all information provided in this application is true, complete, and accurate to the best of my/our knowledge. I/We authorize Triple C Auto & Motorsports, its employees and agents, and potential financing sources to verify information contained in this application, including employment, income, residence, and other information reasonably necessary to evaluate this application. I/We also authorize the dealership and potential financing sources to obtain and review consumer credit reports in connection with this bona fide application for credit.\n\nI/We authorize the dealership to submit this application and related information to one or more banks, credit unions, finance companies, or other potential financing sources for the purpose of arranging financing. I/We understand that submitting this application does not guarantee approval or require the dealership or any financing source to extend credit.`;
function validate(values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Please complete the application.');
  if (values.joint !== undefined && values.joint !== 'yes') throw new Error('Invalid application type.');
  const joint = values.joint === 'yes';
  if (values.consent !== 'on') throw new Error('Please accept the certification and credit authorization.');
  const clean = { joint, consent: true };
  for (const item of schema) {
    if (item.joint && !joint) continue;
    const raw = values[item.name] ?? '';
    if (typeof raw !== 'string' || raw.length > 200 || /[\x00-\x1f\x7f]/.test(raw)) throw new Error(`Check ${item.label}.`);
    const value = raw.trim();
    if (item.required && !value) throw new Error(`Please complete ${item.label}.`);
    if (value) {
      if (item.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('Enter a valid email address.');
      if (item.type === 'number' && (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) > 100000000)) throw new Error(`Check ${item.label}.`);
      if (item.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value || value > new Date().toISOString().slice(0,10))) throw new Error(`Check ${item.label}.`);
      if (item.name.endsWith('_ssn') && !/^\d{3}-?\d{2}-?\d{4}$/.test(value)) throw new Error('Enter a 9-digit Social Security number.');
      if (item.type === 'checkbox' && value !== 'on') throw new Error('Confirm the joint credit intent.');
      if (item.name.endsWith('_residence') && !['Own','Rent','Family / Other'].includes(value)) throw new Error('Choose a residence type.');
      if (item.name.endsWith('_account_type') && !['Checking','Savings','Both'].includes(value)) throw new Error('Choose an account type.');
    }
    clean[item.name] = value;
  }
  return clean;
}
function lines(values) {
  return schema.filter(item => !item.joint || values.joint).map(item => {
    const prefix = item.name.startsWith('coapplicant_') ? 'Co-applicant — ' : item.name.startsWith('applicant_') ? 'Applicant — ' : '';
    return `${prefix}${item.label}: ${values[item.name] || 'Not provided'}`;
  });
}
async function makePdf(values, reference, receivedAt) {
  const doc = new PDFDocument({ size: 'LETTER', margin: 46, bufferPages: true, info: { Title: 'Triple C Credit Application', Author: 'Triple C Auto & Motorsports' } });
  const chunks = [];
  const done = new Promise((resolve,reject) => { doc.on('data', chunk => chunks.push(chunk)); doc.on('end',()=>resolve(Buffer.concat(chunks))); doc.on('error',reject); });
  const font = require.resolve('@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff');
  doc.font(font);
  doc.fontSize(20).fillColor('#b40810').text('TRIPLE C AUTO & MOTORSPORTS');
  doc.fontSize(11).fillColor('#222222').text('Consumer Credit Application');
  doc.fontSize(9).text('901 E Main St | Melbourne, AR 72556 | (870) 291-9233');
  doc.moveDown().text(`Reference: ${reference}\nReceived (UTC): ${receivedAt}\nApplication type: ${values.joint ? 'Joint credit' : 'Individual credit'}`);
  doc.moveDown();
  for (const line of lines(values)) { doc.fontSize(10).text(line, { paragraphGap: 6 }); }
  doc.moveDown().fontSize(12).text('Certification & credit authorization');
  doc.fontSize(9).text(AUTHORIZATION);
  doc.moveDown().text('Electronic signature consent: Accepted. Applicant(s) agreed to the certification and credit authorization, intended the typed signature(s) as electronic signature(s), and agreed to email delivery to the dealership.');
  const range = doc.bufferedPageRange();
  for (let i=0;i<range.count;i++) {
    doc.switchToPage(i);
    doc.fontSize(8).fillColor('#555555').text(`CONFIDENTIAL | ${reference} | Page ${i+1} of ${range.count}`,46,750,{lineBreak:false});
  }
  doc.end();
  return done;
}
module.exports = { validate, makePdf, lines, AUTHORIZATION };
