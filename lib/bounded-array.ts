import {z} from 'zod';

export const COLLECTION_NODE_LIMIT=25000;
export const COLLECTION_DEPTH_LIMIT=16;
function withinBudget(value:unknown){
 const pending:Array<{value:unknown;depth:number}>=[{value,depth:0}];let nodes=0;
 while(pending.length){
  const item=pending.pop()!;if(++nodes>COLLECTION_NODE_LIMIT||item.depth>COLLECTION_DEPTH_LIMIT)return false;
  if(item.value===null||typeof item.value!=='object')continue;
  const keys=Object.keys(item.value);
  if(nodes+pending.length+keys.length>COLLECTION_NODE_LIMIT)return false;
  for(const key of keys)pending.push({value:(item.value as Record<string,unknown>)[key],depth:item.depth+1});
 }
 return true;
}

// Zod 3 records .max() failures but still parses every element. Reject the
// collection before entering that parser, including nested/stored collections.
// This bounds validation amplification; it does not replace HTTP body limits.
export function boundedArray<T extends z.ZodTypeAny>(element:T,max:number,min=0){
 if(!Number.isSafeInteger(max)||!Number.isSafeInteger(min)||min<0||max<min)throw new Error('INVALID_ARRAY_BOUND');
 return z.unknown().superRefine((value,ctx)=>{
  if(!Array.isArray(value))return;
  if(value.length>max){ctx.addIssue({code:z.ZodIssueCode.too_big,type:'array',maximum:max,inclusive:true,exact:false,fatal:true});return;}
  // A bounded outer array can still contain many nested collections. Limit the
  // aggregate traversal before Zod allocates element/union error objects.
  if(!withinBudget(value))ctx.addIssue({code:z.ZodIssueCode.custom,message:'Collection validation budget exceeded',fatal:true});
 }).pipe(z.array(element).min(min).max(max));
}
