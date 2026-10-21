import {CommerceError} from './commerce-model';
export type RecipeIngredient={productId:string;quantity:number;unit:'g'|'ml'|'each';sourceReference:string;costPerBaseUnitCents:number|null;verified:boolean};
export type CostInput={yieldUnits:number|null;ingredients:RecipeIngredient[];labourMinutes:number|null;labourRateCents:number|null;packagingCents:number|null;includesLabour:boolean};
export function recipeCost(input:CostInput){
 const missing:string[]=[];
 if(!input.yieldUnits||input.yieldUnits<=0)missing.push('Verified yield');
 if(!input.ingredients.length||input.ingredients.some(i=>!i.verified||i.quantity<=0||i.costPerBaseUnitCents===null||i.costPerBaseUnitCents<0))missing.push('Verified ingredients, units and costs');
 if(input.labourMinutes===null||input.labourRateCents===null)missing.push('Labour time and rate');
 if(input.packagingCents===null)missing.push('Packaging allocation');
 if(missing.length)return {complete:false,missing,ingredientCents:null,labourCents:null,unitCents:null};
 const ingredientCents=input.ingredients.reduce((s,i)=>s+i.quantity*i.costPerBaseUnitCents!,0),labourCents=input.includesLabour?0:input.labourMinutes!*input.labourRateCents!/60;
 return {complete:true,missing,ingredientCents:Math.round(ingredientCents),labourCents:Math.round(labourCents),unitCents:Math.round((ingredientCents+labourCents)/input.yieldUnits!+input.packagingCents!)};
}
export function margin(priceCents:number,cost:ReturnType<typeof recipeCost>){return !cost.complete?{complete:false,contributionCents:null}:{complete:true,contributionCents:priceCents-cost.unitCents!};}
export function reconcileExpenseSum(lines:number[],statedTotal:number){if(lines.some(n=>!Number.isSafeInteger(n)))throw new CommerceError('INVALID_COST',400);const sum=lines.reduce((s,n)=>s+n,0);return {sum,statedTotal,difference:statedTotal-sum,agrees:sum===statedTotal};}
