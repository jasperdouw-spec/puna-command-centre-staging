export type PosLine={catalog_object_id?:string;quantity?:string};
export type PosOrder={id:string;version:number;location_id:string;state:string;created_at:string;updated_at?:string;reference_id?:string;line_items?:PosLine[]};
export type PosMapping={variationId:string;productId:string;units:number};
// Use gross completed line quantities. A money refund is never proof food was returned.
export function posQuantities(order:PosOrder,mappings:PosMapping[]){
 if(order.state!=='COMPLETED')throw Error('ORDER_NOT_COMPLETED');
 if(!Number.isSafeInteger(order.version)||order.version<1)throw Error('INVALID_ORDER_VERSION');
 const result:Record<string,number>={};
 for(const line of order.line_items||[]){
  const map=mappings.find(m=>m.variationId===line.catalog_object_id);
  if(!map)throw Error('UNMAPPED_VARIATION');
  if(!/^\d+(?:\.0+)?$/.test(line.quantity||''))throw Error('NON_INTEGER_QUANTITY');
  const n=Number(line.quantity)*map.units;
  if(!Number.isSafeInteger(n)||n<1||n>1000||!Number.isSafeInteger(map.units)||map.units<1)throw Error('INVALID_QUANTITY');
  result[map.productId]=(result[map.productId]||0)+n;
  if(result[map.productId]>1000)throw Error('INVALID_QUANTITY');
 }
 if(!Object.keys(result).length)throw Error('NO_MAPPED_ITEMS');
 return result;
}
export function posDelta(current:Record<string,number>,previous:Record<string,number>){
 const remove:Record<string,number>={};let review=false;
 for(const id of new Set([...Object.keys(current),...Object.keys(previous)])){
  const n=(current[id]||0)-(previous[id]||0);
  if(n>0)remove[id]=n;
  if(n<0)review=true; // Do not automatically restock cancelled/refunded/edited food.
 }
 return {remove,review};
}
