(function(root){
  function searchInventory(items,filters={}){
    const terms=(filters.query||'').toLowerCase().trim().split(/\s+/).filter(Boolean);
    let result=items.filter(item=>{
      if(item.status && item.status!=='available')return false;
      if(filters.category&&item.category!==filters.category)return false;
      if(filters.make&&item.make!==filters.make)return false;
      if(filters.type&&item.type!==filters.type)return false;
      if(filters.year&&String(item.year)!==String(filters.year))return false;
      if(filters.price&&(!Number.isFinite(item.price)||item.price>Number(filters.price)))return false;
      const haystack=[item.year,item.make,item.model,item.type,item.stockNumber,item.description].join(' ').toLowerCase();
      return terms.every(term=>haystack.includes(term));
    });
    return result.slice().sort((a,b)=>{
      if(filters.sort==='price-low')return (a.price??Infinity)-(b.price??Infinity);
      if(filters.sort==='price-high')return (b.price??-Infinity)-(a.price??-Infinity);
      if(filters.sort==='year')return (b.year||0)-(a.year||0);
      return (Date.parse(b.addedAt)||0)-(Date.parse(a.addedAt)||0);
    });
  }
  if(typeof module!=='undefined')module.exports={searchInventory};else root.searchInventory=searchInventory;
})(typeof window!=='undefined'?window:globalThis);
