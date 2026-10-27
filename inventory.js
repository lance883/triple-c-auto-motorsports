'use strict';
const category=document.body.dataset.category;
const el=id=>document.getElementById(id);
const fields=['query','make','type','year','price','sort'];
let inventory=[];
const money=value=>Number.isFinite(value)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value):'Call for price';
const title=item=>[item.year,item.make,item.model].filter(Boolean).join(' ');
function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function safePhoto(url){if(typeof url!=='string')return null;try{const u=new URL(url,location.href);return u.protocol==='https:'||u.origin===location.origin?u.href:null;}catch{return null;}}
function photos(item){return (Array.isArray(item.photos)?item.photos:[]).map(safePhoto).filter(Boolean);}
function image(url,alt){const img=node('img');img.src=url;img.alt=alt;img.loading='lazy';img.addEventListener('error',()=>img.replaceWith(node('div','Photo coming soon','photo-placeholder')),{once:true});return img;}
function specLine(item){const parts=[];if(Number.isFinite(item.mileage))parts.push(`${item.mileage.toLocaleString()} miles`);if(Number.isFinite(item.hours))parts.push(`${item.hours.toLocaleString()} hours`);if(item.transmission)parts.push(item.transmission);return parts.join(' • ')||item.type||'';}
function showDetails(item){
 el('detail-title').textContent=title(item);const content=el('detail-content');content.replaceChildren();
 const gallery=node('div',undefined,'gallery');for(const url of photos(item))gallery.append(image(url,title(item)));if(gallery.childElementCount)content.append(gallery);
 content.append(node('p',money(item.price),'price'));const specs=node('dl',undefined,'detail-specs');
 for(const [key,label] of [['year','Year'],['make','Make'],['model','Model'],['type','Type'],['mileage','Mileage'],['hours','Hours'],['transmission','Transmission'],['stockNumber','Stock #'],['vin','VIN']])if(item[key]!==undefined&&item[key]!==null&&item[key]!==''){const row=node('div');row.append(node('dt',label),node('dd',String(item[key])));specs.append(row);}
 content.append(specs);if(item.description)content.append(node('p',item.description,'description'));
 const actions=node('div',undefined,'detail-actions');for(const [label,href] of [['Call about this vehicle','tel:+18702919233'],['Email about this vehicle',`mailto:Sales@triplecauto-motorsports.com?subject=${encodeURIComponent('Inquiry: '+title(item)+(item.stockNumber?' — Stock '+item.stockNumber:''))}`],['Apply for financing','credit-application.html']]){const a=node('a',label,'button');a.href=href;actions.append(a);}content.append(actions);el('details').showModal();
}
function render(){
 const filters=Object.fromEntries(fields.map(id=>[id,el(id).value]));filters.category=category;
 const matches=searchInventory(inventory,filters);const available=searchInventory(inventory,{category});
 const params=new URLSearchParams();for(const key of fields)if(filters[key]&&!(key==='sort'&&filters[key]==='newest'))params.set(key,filters[key]);history.replaceState(null,'',location.pathname+(params.size?'?'+params.toString():''));
 el('count').textContent=`${matches.length} ${matches.length===1?'vehicle':'vehicles'}`;el('listings').replaceChildren();
 for(const item of matches){const card=node('article',undefined,'listing');const urls=photos(item);card.append(urls.length?image(urls[0],title(item)):node('div','Photo coming soon','photo-placeholder'));const body=node('div',undefined,'listing-body');body.append(node('h2',title(item)),node('p',money(item.price),'price'),node('p',specLine(item),'specs'));const button=node('button','View Details');button.type='button';button.setAttribute('aria-label','View details for '+title(item));button.addEventListener('click',()=>showDetails(item));body.append(button);card.append(body);el('listings').append(card);}
 el('empty').hidden=matches.length>0;el('empty-title').textContent=available.length?'No matching vehicles':'Inventory coming soon';el('empty-copy').textContent=available.length?'Try a different search or reset the filters. You can also contact us for help finding the right vehicle.':`We’re preparing our ${category==='auto'?'preowned auto':'motorsports'} inventory. Check back for new listings, or contact us to tell us what you’re looking for.`;
}
async function start(){
 try{const response=await fetch('inventory-data.json',{cache:'no-cache'});if(!response.ok)throw Error('Inventory unavailable');const data=await response.json();if(!Array.isArray(data))throw Error('Invalid inventory');inventory=data.filter(item=>item&&typeof item==='object');
 const available=searchInventory(inventory,{category});for(const key of ['make','type','year']){const values=[...new Set(available.map(item=>item[key]).filter(v=>v!==undefined&&v!==null&&v!==''))].sort((a,b)=>key==='year'?Number(b)-Number(a):String(a).localeCompare(String(b)));for(const value of values){const option=node('option',String(value));option.value=value;el(key).append(option);}}
 const params=new URLSearchParams(location.search);for(const key of fields)if(params.has(key)){el(key).value=params.get(key);if(key==='sort'&&!el(key).value)el(key).value='newest';}
 el('search-form').addEventListener('submit',event=>{event.preventDefault();render();});el('query').addEventListener('input',render);for(const key of fields.filter(k=>k!=='query'))el(key).addEventListener('change',render);el('reset').addEventListener('click',()=>{for(const key of fields)el(key).value=key==='sort'?'newest':'';render();});render();
 }catch{el('count').textContent='Inventory unavailable';el('empty').hidden=false;el('empty-title').textContent='We couldn’t load inventory';el('empty-copy').textContent='Please refresh the page or contact us for current availability.';}
}
el('close-details').addEventListener('click',()=>el('details').close());start();
