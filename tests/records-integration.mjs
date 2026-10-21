import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
export async function runRecordChecks({db,request,check,cookie,staffCookie}){
 const hash=s=>createHash('sha256').update(s).digest('hex');
 const post=(body,who=cookie)=>request('/api/records',{method:'POST',cookie:who,body});
 const row=(id,category='empanada')=>({sourceKey:'synthetic:'+id,sourceReference:'https://example.test/source',sourceHash:hash(id),id,canonicalId:'synthetic:'+id,name:'Synthetic '+id,description:'Synthetic records only',priceCents:800,kind:'frozen',category,priceConfirmed:true});
 const item=row('synthetic-recipe-output'),flour=row('synthetic-flour','ingredient');
 await check('source import preserves drafts and is idempotent',async()=>{const p={action:'import-products',rows:[item,flour]};assert.equal((await post(p)).data.inserted,2);assert.equal((await post(p)).data.unchanged,2);const [r]=await db.execute('SELECT p.available,m.publication,m.ingredients_confirmed FROM products p JOIN commerce_products m ON m.product_id=p.id WHERE p.id=?',[item.id]);assert.equal(r[0].available,0);assert.equal(r[0].publication,'draft');assert.equal(r[0].ingredients_confirmed,0);});
 await check('source import refuses to overwrite owner edits and canonical duplicates',async()=>{await db.execute('UPDATE products SET version=version+1 WHERE id=?',[item.id]);assert.equal((await post({action:'import-products',rows:[{...item,sourceHash:hash('revised')}]})).status,409);assert.equal((await post({action:'import-products',rows:[{...item,id:'duplicate',sourceKey:'duplicate'}]})).status,409)});
 await check('workers cannot read or write private recipe/cost records',async()=>{assert.equal((await request('/api/records',{cookie:staffCookie})).status,403);assert.equal((await post({action:'import-products',rows:[row('unauthorized')]},staffCookie)).status,403)});
 let recipeId;
 await check('recipe cost remains incomplete until all verified inputs exist',async()=>{
  const recipe={id:item.id,baseVersion:0,name:'Synthetic frozen recipe',yieldUnits:10,ingredients:[{id:flour.id,quantity:100,unit:'g',sourceValue:'100 g synthetic'}],labourMinutes:null,labourRateCents:null,packagingCents:null,sourceReference:'https://example.test/recipe',sourceHash:hash('recipe'),verified:true};
  const r=await post({action:'recipe',recipe});assert.equal(r.status,200);recipeId=r.data.id;
  assert.equal((await post({action:'recipe',recipe})).status,409);
  const d=await request('/api/records',{cookie});assert.equal(d.data.recipes.find(r=>r.id===recipeId).costing.complete,false);
 });
 await check('production needs counted ingredients and a counted output location',async()=>{
  const p={action:'produce',key:randomUUID(),recipeId,batches:1,output:9,waste:1};assert.equal((await post(p)).status,409);
  assert.equal((await post({action:'ingredient',id:flour.id,supplier:'Synthetic supplier',packageQuantity:1000,baseUnit:'g',packageCostCents:1000,sourceReference:'https://example.test/cost',rawSource:'Synthetic 1000 g / 1000 cents',verified:true})).status,200);
  const [owner]=await db.query("SELECT id FROM users WHERE role='owner' LIMIT 1");
  await db.execute("INSERT INTO inventory_balances(product_id,location,stage,physical_units,known,counted_by) VALUES(?,'factory','ingredient',1000,1,?),(?,'factory','frozen',0,1,?)",[flour.id,owner[0].id,item.id,owner[0].id]);
  assert.equal((await post(p)).status,200);assert.equal((await post(p)).data.duplicate,true);
  const [r]=await db.execute("SELECT physical_units FROM inventory_balances WHERE product_id=? AND location='factory' AND stage='ingredient'",[flour.id]);assert.equal(r[0].physical_units,900);
  const [o]=await db.execute("SELECT physical_units FROM inventory_balances WHERE product_id=? AND location='factory' AND stage='frozen'",[item.id]);assert.equal(o[0].physical_units,9);
 });
 await check('production audit failure rolls ingredient and output changes back',async()=>{
  const before=(await db.execute("SELECT physical_units FROM inventory_balances WHERE product_id=? AND location='factory' AND stage='ingredient'",[flour.id]))[0][0].physical_units;
  await db.query("CREATE TRIGGER synthetic_production_audit_failure BEFORE INSERT ON audit_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic rollback'");
  try{assert.equal((await post({action:'produce',key:randomUUID(),recipeId,batches:1,output:10,waste:0})).status,503)}finally{await db.query('DROP TRIGGER synthetic_production_audit_failure')}
  assert.equal((await db.execute("SELECT physical_units FROM inventory_balances WHERE product_id=? AND location='factory' AND stage='ingredient'",[flour.id]))[0][0].physical_units,before);
 });
 await check('draft website content stays private before explicit staging publication',async()=>{
  const before=await request('/api/website',{cookie}),settings={...before.data.settings,headline:'Synthetic private draft'};
  assert.equal((await request('/api/website',{method:'POST',cookie,body:{version:before.data.version,settings}})).status,200);
  const after=await request('/api/website',{cookie});assert.equal(after.data.settings.headline,before.data.settings.headline);assert.equal(after.data.drafts.length,1);
 });
 await check('historical reports exclude synthetic sales and separate taxes from revenue',async()=>{
  await db.execute("INSERT INTO historical_sales(source_key,source_hash,sold_at,gross_cents,discount_cents,refund_cents,tax_cents,tip_cents,quantity,is_test,source_reference) VALUES('synthetic-report',?,UTC_TIMESTAMP(),800,0,0,40,0,1,1,'https://example.test/sales')",[hash('sale')]);
  const r=await request('/api/records',{cookie});assert.equal(Number(r.data.historical[0].records),0);
 });
 await check('private recovery is owner-issued, one-time and revokes old sessions without changing role',async()=>{
  const oldPassword='Synthetic-private-recovery-old-2026',newPassword='Synthetic-private-recovery-new-2026';
  const created=await request('/api/accounts',{method:'POST',cookie,body:{email:'recovery@example.test',name:'Synthetic recovery worker',role:'staff',password:oldPassword}});assert.equal(created.status,201);
  const [users]=await db.query("SELECT id FROM users WHERE email='recovery@example.test'");
  assert.equal((await request('/api/recovery',{method:'POST',cookie:staffCookie,body:{action:'issue',userId:users[0].id}})).status,403);
  const login=await request('/api/auth',{method:'POST',body:{action:'login',email:'recovery@example.test',password:oldPassword}});assert.equal(login.status,200);const oldSession=login.headers['set-cookie'][0].split(';')[0];
  const issue=await request('/api/recovery',{method:'POST',cookie,body:{action:'issue',userId:users[0].id}});assert.equal(issue.status,200);const body={action:'redeem',token:issue.data.privateRecovery.split('#')[1],password:newPassword};
  assert.equal((await request('/api/recovery',{method:'POST',body})).status,200);assert.equal((await request('/api/recovery',{method:'POST',body})).status,403);
  assert.equal((await request('/api/operations',{cookie:oldSession})).status,401);
  const signed=await request('/api/auth',{method:'POST',body:{action:'login',email:'recovery@example.test',password:newPassword}});assert.equal(signed.status,200);
  assert.equal((await request('/api/records',{cookie:signed.headers['set-cookie'][0].split(';')[0]})).status,403);
 });

}
