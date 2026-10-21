import 'server-only';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import type {RowDataPacket} from 'mysql2';
import {transaction,audit,digest} from './commerce';
import {CommerceError,taxRules} from './commerce-model';
import {balance} from './operations';
export const sourceProduct=z.object({sourceKey:z.string().min(1).max(160),sourceReference:z.string().url().max(500),sourceHash:z.string().regex(/^[a-f0-9]{64}$/),id:z.string().min(1).max(64),canonicalId:z.string().min(1).max(80),name:z.string().min(1).max(120),description:z.string().max(10000),priceCents:z.number().int().min(0).max(100000),kind:z.enum(['fresh','frozen']),category:z.enum(['empanada','sauce','drink','ingredient']),priceConfirmed:z.boolean()}).strict();
export async function importProducts(actor:number,rows:z.infer<typeof sourceProduct>[]){
 return transaction(async c=>{let inserted=0,updated=0,unchanged=0;for(const p of rows){
 const [mapped]=await c.execute<RowDataPacket[]>('SELECT * FROM source_imports WHERE source_key=? FOR UPDATE',[p.sourceKey]);
 const [existing]=await c.execute<RowDataPacket[]>('SELECT id,version FROM products WHERE id=? FOR UPDATE',[p.id]);
 const [canonical]=await c.execute<RowDataPacket[]>('SELECT product_id FROM commerce_products WHERE canonical_id=?',[p.canonicalId]);
 if(canonical.length&&canonical[0].product_id!==p.id)throw new CommerceError('CANONICAL_MAPPING_CONFLICT');
 if(mapped.length){
  const m=mapped[0];if(m.target_type!=='product'||m.target_id!==p.id)throw new CommerceError('SOURCE_MAPPING_CONFLICT');
  if(m.source_hash===p.sourceHash){unchanged++;continue;}
  if(!existing.length||Number(existing[0].version)!==Number(m.target_version))throw new CommerceError('OWNER_EDIT_CONFLICT');
 }else if(existing.length)throw new CommerceError('EXISTING_RECORD_REQUIRES_MAPPING');
 if(existing.length){await c.execute('UPDATE products SET name=?,description=?,price_cents=?,kind=?,available=0,source_status=\'initial\',version=version+1 WHERE id=?',[p.name,p.description,p.priceCents,p.kind,p.id]);updated++;}
 else{await c.execute('INSERT INTO products(id,name,description,price_cents,kind,available,source_status) VALUES(?,?,?,?,?,0,\'initial\')',[p.id,p.name,p.description,p.priceCents,p.kind]);inserted++;}
 const targetVersion=existing.length?Number(existing[0].version)+1:1;
 await c.execute("INSERT INTO commerce_products(product_id,canonical_id,category,price_confirmed,oven_units,source_reference,source_hash) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE publication='draft',price_confirmed=VALUES(price_confirmed),ingredients_confirmed=0,tax_rules=NULL,deposit_cents=NULL,packing_seconds=NULL,source_reference=VALUES(source_reference),source_hash=VALUES(source_hash),version=version+1",[p.id,p.canonicalId,p.category,p.priceConfirmed?1:0,p.category==='empanada'?1:0,p.sourceReference,p.sourceHash]);
 await c.execute('INSERT INTO source_imports(source_key,source_hash,target_type,target_id,target_version,actor_id) VALUES(?,?,\'product\',?,?,?) ON DUPLICATE KEY UPDATE source_hash=VALUES(source_hash),target_version=VALUES(target_version),actor_id=VALUES(actor_id),imported_at=CURRENT_TIMESTAMP',[p.sourceKey,p.sourceHash,p.id,targetVersion,actor]);
 await audit(c,actor,'source:import','product',p.id);
 }return {inserted,updated,unchanged};});
}
export const commerceFields=z.object({id:z.string().max(64),version:z.number().int().positive(),publication:z.enum(['draft','staging']),priceConfirmed:z.boolean(),ingredientsConfirmed:z.boolean(),taxRules:taxRules.nullable(),depositCents:z.number().int().min(0).max(10000).nullable(),packingSeconds:z.number().int().min(0).max(3600).nullable()}).strict();
export async function saveCommerce(actor:number,p:z.infer<typeof commerceFields>){
 return transaction(async c=>{const [r]=await c.execute('UPDATE commerce_products SET publication=?,price_confirmed=?,ingredients_confirmed=?,tax_rules=?,deposit_cents=?,packing_seconds=?,version=version+1 WHERE product_id=? AND version=?',[p.publication,p.priceConfirmed,p.ingredientsConfirmed,p.taxRules===null?null:JSON.stringify(p.taxRules),p.depositCents,p.packingSeconds,p.id,p.version]);if(!(r as {affectedRows:number}).affectedRows)throw new CommerceError('PRODUCT_CHANGED');await audit(c,actor,'commerce:configure','product',p.id);return {version:p.version+1};});
}
export const recipeInput=z.object({id:z.string().max(64),baseVersion:z.number().int().min(0),name:z.string().min(1).max(120),yieldUnits:z.number().int().positive().nullable(),ingredients:z.array(z.object({id:z.string().max(64),quantity:z.number().positive(),unit:z.enum(['g','ml','each']),sourceValue:z.string().max(500)}).strict()).max(100),labourMinutes:z.number().nonnegative().nullable(),labourRateCents:z.number().int().nonnegative().nullable(),packagingCents:z.number().int().nonnegative().nullable(),sourceReference:z.string().url().max(500),sourceHash:z.string().regex(/^[a-f0-9]{64}$/),verified:z.boolean()}).strict();
export async function saveRecipe(actor:number,p:z.infer<typeof recipeInput>){
 return transaction(async c=>{const [versions]=await c.execute<RowDataPacket[]>('SELECT COALESCE(MAX(version),0) AS v FROM recipe_versions WHERE product_id=?',[p.id]);if(Number(versions[0].v)!==p.baseVersion)throw new CommerceError('RECIPE_CHANGED');
 if(p.verified&&(!p.yieldUnits||!p.ingredients.length||new Set(p.ingredients.map(i=>i.id)).size!==p.ingredients.length))throw new CommerceError('RECIPE_INCOMPLETE');
 const id=randomUUID();await c.execute('INSERT INTO recipe_versions(id,product_id,version,name,yield_units,ingredients,labour_minutes,labour_rate_cents,packaging_cents,source_reference,source_hash,verification,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,p.id,p.baseVersion+1,p.name,p.yieldUnits,JSON.stringify(p.ingredients),p.labourMinutes,p.labourRateCents,p.packagingCents,p.sourceReference,p.sourceHash,p.verified?'verified':'incomplete',actor]);await audit(c,actor,'recipe:version','recipe',id);return {id,version:p.baseVersion+1};});
}
export async function produce(actor:number,p:{key:string;recipeId:string;batches:number;output:number;waste:number}){
 return transaction(async c=>{
 const [old]=await c.execute<RowDataPacket[]>('SELECT * FROM production_runs WHERE operation_key=?',[p.key]);
 if(old.length){if(old[0].recipe_id!==p.recipeId||Number(old[0].output_units)!==p.output||Number(old[0].waste_units)!==p.waste||Number(old[0].batch_count)!==p.batches)throw new CommerceError('OPERATION_CONFLICT');return {duplicate:true};}
 const [recipes]=await c.execute<RowDataPacket[]>('SELECT * FROM recipe_versions WHERE id=?',[p.recipeId]);const r=recipes[0];
 if(!r||r.verification!=='verified'||!r.yield_units||p.output+p.waste>Number(r.yield_units)*p.batches)throw new CommerceError('RECIPE_OR_YIELD_UNVERIFIED');
 const ingredients=JSON.parse(r.ingredients) as Array<{id:string;quantity:number;unit:string}>;
 if(!ingredients.length)throw new CommerceError('RECIPE_INCOMPLETE');
 const run=randomUUID();
 for(const i of ingredients){
 const [costs]=await c.execute<RowDataPacket[]>('SELECT base_unit FROM ingredient_costs WHERE product_id=?',[i.id]);
 const units=i.quantity*p.batches;if(!Number.isSafeInteger(units)||!costs[0]||costs[0].base_unit!==i.unit)throw new CommerceError('INGREDIENT_UNIT_UNVERIFIED');
 const b=await balance(c,i.id,'factory','ingredient');if(!b.known||Number(b.physical_units)-Number(b.committed_units)<units)throw new CommerceError('INGREDIENT_STOCK_SHORTAGE');
 await c.execute("UPDATE inventory_balances SET physical_units=physical_units-?,version=version+1 WHERE product_id=? AND location='factory' AND stage='ingredient'",[units,i.id]);
 await c.execute("INSERT INTO inventory_movements(id,operation_key,product_id,from_location,from_stage,quantity,kind,reason,actor_id,reference_id) VALUES(?,?,?,'factory','ingredient',?,'production','Ingredient consumed for recorded production',?,?)",[randomUUID(),p.key+':'+i.id,i.id,units,actor,run]);
 }
 const output=await balance(c,r.product_id,'factory','frozen');if(!output.known)throw new CommerceError('OUTPUT_OPENING_COUNT_REQUIRED');
 await c.execute("UPDATE inventory_balances SET physical_units=physical_units+?,version=version+1 WHERE product_id=? AND location='factory' AND stage='frozen'",[p.output,r.product_id]);
 await c.execute('INSERT INTO production_runs(id,operation_key,recipe_id,batch_count,output_units,waste_units,actor_id) VALUES(?,?,?,?,?,?,?)',[run,p.key,p.recipeId,p.batches,p.output,p.waste,actor]);
 await c.execute("INSERT INTO inventory_movements(id,operation_key,product_id,to_location,to_stage,quantity,kind,reason,actor_id,reference_id) VALUES(?,?,?,'factory','frozen',?,'production','Verified recipe yield; waste recorded separately',?,?)",[randomUUID(),p.key+':output',r.product_id,p.output,actor,run]);
 await audit(c,actor,'production:record','production',run);return {id:run};
 });
}
