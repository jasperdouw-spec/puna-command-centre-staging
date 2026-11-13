import {createHash} from 'node:crypto';
import type {TaxRule} from './commerce-model';

// Provider JSON is kept as evidence, never accepted as instructions or website HTML.
export type CatalogObject={id:string;type:string;version:number;is_deleted?:boolean;updated_at?:string;present_at_all_locations?:boolean;present_at_location_ids?:string[];absent_at_location_ids?:string[];item_data?:any;item_variation_data?:any;tax_data?:any;category_data?:any;modifier_list_data?:any};
export type CatalogVariation={id:string;itemId:string;name:string;variationName:string;version:number;updatedAt:string|null;priceCents:number|null;currency:string|null;status:string;taxes:TaxRule[]|null;taxEvidence:unknown[];taxWarning:string|null;modifierIds:string[];categories:string[];commercialHash:string;configurationHash:string};
export const catalogHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)).digest('hex');
export const CATALOG_TYPES=['ITEM','ITEM_VARIATION','TAX','CATEGORY','MODIFIER_LIST'];
export const CATALOG_MAX_AGE_MS=30*60*1000;
export const CATALOG_POLL_MS=5*60*1000;
export function atLocation(o:CatalogObject,location:string){return o.present_at_all_locations===false?!!o.present_at_location_ids?.includes(location):!o.absent_at_location_ids?.includes(location);}
export function flattenCatalog(input:CatalogObject[]){
 const out=new Map<string,CatalogObject>();
 for(const o of input){
  if(!o||typeof o.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(o.id)||!CATALOG_TYPES.includes(o.type)||!Number.isSafeInteger(o.version)||o.version<0)throw Error('SQUARE_CATALOG_INVALID');
  const prior=out.get(o.id);if(prior&&prior.version===o.version&&catalogHash(prior)!==catalogHash(o))throw Error('SQUARE_OBJECT_VERSION_CONFLICT');
  if(!prior||prior.version<o.version)out.set(o.id,o);
  if(o.type==='ITEM'&&!o.is_deleted)for(const v of flattenCatalog(o.item_data?.variations||[])){
   if(v.item_variation_data?.item_id!==o.id)throw Error('SQUARE_VARIATION_PARENT_MISMATCH');
   const old=out.get(v.id);if(!old||old.version<v.version)out.set(v.id,v);
   else if(old.version===v.version&&catalogHash(old)!==catalogHash(v))throw Error('SQUARE_OBJECT_VERSION_CONFLICT');
  }
 }
 return [...out.values()];
}
export function catalogVariations(objects:CatalogObject[],location:string):CatalogVariation[]{
 const all=new Map(objects.map(o=>[o.id,o]));
 return objects.filter(o=>o.type==='ITEM_VARIATION').map(v=>{
  const d=v.item_variation_data||{},item=all.get(d.item_id),i=item?.item_data||{},override=(d.location_overrides||[]).find((l:any)=>l.location_id===location);
  const pricing=override?.pricing_type??d.pricing_type,money=override?.price_money??d.price_money;
  const validPrice=Number.isSafeInteger(money?.amount)&&money.amount>=0&&money.amount<=100000;
  let status=!item||item.is_deleted||v.is_deleted?'deleted':i.is_archived?'archived':!location?'location_unverified':!atLocation(item,location)||!atLocation(v,location)?'wrong_location':pricing!=='FIXED_PRICING'?'variable_price':money?.currency!=='CAD'?'currency_unverified':!validPrice?'price_missing':d.measurement_unit_id||d.stockable_conversion?'unit_model_unsupported':'verified';
  const taxEvidence=(i.tax_ids||[]).map((id:string)=>all.get(id)||{id,missing:true});let taxes:TaxRule[]|null=[],taxWarning:string|null=null;
  for(const tax of taxEvidence){const t=tax as CatalogObject,data=t.tax_data;
   if(t.is_deleted||!data){taxWarning='tax_missing';break;}
   if(data.enabled===false||!atLocation(t,location))continue;
   if(data.enabled!==true||data.applies_to_product_set_id){taxWarning='tax_model_unsupported';break;}
   // The existing quote engine supports additive, subtotal taxes only.
   const percent=String(data.percentage??'');
   if(data.inclusion_type!=='ADDITIVE'||data.calculation_phase!=='TAX_SUBTOTAL_PHASE'||!/^\d{1,3}(\.\d{1,2})?$/.test(percent)||Number(percent)>100||typeof data.name!=='string'||data.name.length>40){taxWarning='tax_model_unsupported';break;}
   taxes.push({name:data.name,basis_points:Math.round(Number(percent)*100)});
  }
  if(taxes.length>5)taxWarning='tax_model_unsupported';if(taxWarning)taxes=null;
  const modifierIds=(i.modifier_list_info||[]).filter((m:any)=>m.enabled!==false).map((m:any)=>String(m.modifier_list_id));
  const priceCents=pricing==='FIXED_PRICING'&&money?.currency==='CAD'&&validPrice?money.amount:null;
  const configurationHash=catalogHash({item:item?.id,variation:v.id,location,taxEvidence,modifierIds,modifiers:modifierIds.map((id:string)=>all.get(id)||{id,missing:true})});
  const commercialHash=catalogHash({configurationHash,status,priceCents});
  return {id:v.id,itemId:d.item_id||'',name:i.name||'Deleted item',variationName:d.name||'',version:v.version,updatedAt:v.updated_at||null,priceCents,currency:money?.currency||null,status,taxes,taxEvidence,taxWarning,modifierIds,categories:(i.categories||[]).map((c:any)=>all.get(c.id)?.category_data?.name||c.id),commercialHash,configurationHash};
 }).sort((a,b)=>(a.name+' '+a.variationName).localeCompare(b.name+' '+b.variationName));
}
// Historical aliases suggest a review; they NEVER establish a provider mapping.
export const productAliases:Record<string,string[]>={
 carne:['Empanada Carne','Empanada Beef'],chicken:['Empanada Chicken'],eggplant:['Empanada Roasted Eggplant','Empanada Roated Eggplant','Empanada Veggie'],ham:['Empanada Ham and Cheese'],strudel:['Empanada Apple'],chimichurri:['Chimichurri','Chimicup'],
 'sanpellegrino-aranciata':['San Pellegrino Aranciata','Sanpelligrini Aranciata'],
 'sanpellegrino-aranciata-rossa':['San Pellegrino Aranciata Rossa','Sanpellegino Aranciata Rossa'],
 'sanpellegrino-limonata':['San Pellegrino Limonata'],'sanpellegrino-pompelmo':['San Pellegrino Pompelmo']
};
export const normalizeAlias=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
export function suggestedVariations(id:string,name:string,variants:CatalogVariation[]){const names=[name,...productAliases[id]||[]].map(normalizeAlias);return variants.filter(v=>names.includes(normalizeAlias(v.name))).map(v=>v.id);}
export function priceIssue(link:any,state:any,now:number){
 if(!link)return 'Square mapping required';
 if(!state?.location_verified_at||link.location_id!==state.location_id||link.merchant_id!==state.merchant_id)return 'Square POS location mapping needs verification';
 if(link.status!=='verified')return 'Square price unavailable: '+link.status;
 if(!link.verified_at||now-new Date(link.verified_at).getTime()>CATALOG_MAX_AGE_MS||state.failure_code)return 'Square synchronization needs attention';
 return null;
}
export function commercialIssue(link:any,state:any,now:number){
 const price=priceIssue(link,state,now);if(price)return price;
 if(!state.pickup_address_matches)return 'Square location address needs correction; pickup is Ucluelet only';
 if(!link.review_hash||link.review_hash!==link.configuration_hash||link.deposit_cents===null||link.tax_snapshot===null)return 'Review Square taxes, deposits and modifiers';
 return null;
}
