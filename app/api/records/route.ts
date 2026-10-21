import {z} from 'zod';
import type {RowDataPacket} from 'mysql2';
import {database} from '@/lib/db';
import {checkOrigin,requireRole} from '@/lib/auth';
import {json,failure} from '@/lib/http';
import {CommerceError} from '@/lib/commerce-model';
import {transaction,audit} from '@/lib/commerce';
import {sourceProduct,importProducts,commerceFields,saveCommerce,recipeInput,saveRecipe,produce} from '@/lib/records';
import {recipeCost} from '@/lib/costing';
export const runtime='nodejs';
export async function GET(){try{
 await requireRole(['owner']);
 const [products]=await database().query('SELECT p.id,p.name,p.version AS product_version,m.* FROM products p LEFT JOIN commerce_products m ON m.product_id=p.id ORDER BY p.name');
 const [costs]=await database().query<RowDataPacket[]>('SELECT * FROM ingredient_costs');
 const [recipes]=await database().query<RowDataPacket[]>('SELECT * FROM recipe_versions ORDER BY name,version DESC');
 const calculated=recipes.map(r=>({...r,ingredients:JSON.parse(r.ingredients),costing:recipeCost({yieldUnits:r.yield_units===null?null:Number(r.yield_units),ingredients:JSON.parse(r.ingredients).map((i:{id:string;quantity:number;unit:string})=>{const c=costs.find(c=>c.product_id===i.id);return {productId:i.id,sourceReference:r.source_reference,quantity:i.quantity,unit:i.unit,costPerBaseUnitCents:c&&c.verified&&c.base_unit===i.unit&&Number(c.package_quantity)>0&&c.package_cost_cents!==null?Number(c.package_cost_cents)/Number(c.package_quantity):null,verified:!!c?.verified};}),labourMinutes:r.labour_minutes===null?null:Number(r.labour_minutes),labourRateCents:r.labour_rate_cents,packagingCents:r.packaging_cents,includesLabour:false})}));
 const [historical]=await database().query("SELECT COUNT(*) records,MIN(sold_at) period_start,MAX(sold_at) period_end,COALESCE(SUM(gross_cents),0) gross_cents,COALESCE(SUM(discount_cents),0) discount_cents,COALESCE(SUM(refund_cents),0) refund_cents,COALESCE(SUM(tax_cents),0) tax_cents,COALESCE(SUM(tip_cents),0) tip_cents FROM historical_sales WHERE is_test=0");
 const [production]=await database().query('SELECT id,recipe_id,batch_count,output_units,waste_units,created_at FROM production_runs ORDER BY created_at DESC LIMIT 100');
 return json({products,recipes:calculated,costs,historical,production});
 }catch(e){return failure(e)}}
const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('import-products'),rows:z.array(sourceProduct).min(1).max(100)}).strict(),
 z.object({action:z.literal('commerce'),product:commerceFields}).strict(),
 z.object({action:z.literal('recipe'),recipe:recipeInput}).strict(),
 z.object({action:z.literal('produce'),key:z.string().uuid(),recipeId:z.string().uuid(),batches:z.number().int().positive().max(1000),output:z.number().int().positive().max(100000),waste:z.number().int().min(0).max(100000)}).strict(),
 z.object({action:z.literal('ingredient'),id:z.string().max(64),supplier:z.string().max(160),packageQuantity:z.number().positive().nullable(),baseUnit:z.enum(['g','ml','each']),packageCostCents:z.number().int().nonnegative().nullable(),sourceReference:z.string().url().max(500),rawSource:z.string().max(10000),verified:z.boolean()}).strict()
]);
export async function POST(req:Request){if(!checkOrigin(req))return json({error:'Invalid origin'},403);
 try{const u=await requireRole(['owner']);const raw=await req.text();if(raw.length>200000)return json({error:'Request too large'},413);const parsed=input.safeParse(JSON.parse(raw));if(!parsed.success)return json({error:'Invalid record fields'},400);const p=parsed.data;
 if(p.action==='import-products')return json(await importProducts(u.id,p.rows));
 if(p.action==='commerce')return json(await saveCommerce(u.id,p.product));
 if(p.action==='recipe')return json(await saveRecipe(u.id,p.recipe));
 if(p.action==='produce')return json(await produce(u.id,p));
 return json(await transaction(async c=>{const [exists]=await c.execute<RowDataPacket[]>('SELECT product_id FROM ingredient_costs WHERE product_id=?',[p.id]);if(exists.length)throw new CommerceError('EXISTING_COST_REQUIRES_REVIEW');await c.execute('INSERT INTO ingredient_costs(product_id,supplier,package_quantity,base_unit,package_cost_cents,source_reference,raw_source,verified) VALUES(?,?,?,?,?,?,?,?)',[p.id,p.supplier,p.packageQuantity,p.baseUnit,p.packageCostCents,p.sourceReference,p.rawSource,p.verified]);await audit(c,u.id,'ingredient:import','product',p.id);return {saved:true};}));
 }catch(e){if(e instanceof SyntaxError)return json({error:'Invalid JSON'},400);return e instanceof CommerceError?json({error:e.code},e.status):failure(e);}
}
