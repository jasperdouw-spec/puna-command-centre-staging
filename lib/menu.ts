import 'server-only';
import {randomUUID} from 'node:crypto';
import type {PoolConnection,RowDataPacket} from 'mysql2/promise';
import {database} from './db';
import {transaction,audit,digest,sqlDate} from './commerce';
import {CommerceError} from './commerce-model';
import {cropKey,menuDraftSchema,type MenuDraft} from './menu-model';
const iso=(v:unknown)=>v?new Date(v as string).toISOString():null;
const select=`SELECT p.*,m.category,m.publication,m.price_confirmed,m.ingredients_confirmed,m.source_reference,m.version commerce_version,u.draft,u.ingredients,u.allergens,u.photo_id,u.photo_crop,u.photo_alt,u.variation_label,u.weekly,u.oven_eligible,u.starts_at,u.ends_at,u.archived,u.square_candidate FROM products p LEFT JOIN commerce_products m ON m.product_id=p.id LEFT JOIN product_menu u ON u.product_id=p.id`;
export function draftFromRow(p:RowDataPacket):MenuDraft{return {name:p.name,description:p.description,ingredients:p.ingredients||'',allergens:p.allergens||'',priceCents:Number(p.price_cents),category:p.category||'empanada',variationLabel:p.variation_label||'',weekly:!!p.weekly,ovenEligible:p.category!=='sauce'&&p.category!=='drink'&&p.category!=='ingredient'&&p.oven_eligible!==0,startsAt:iso(p.starts_at),endsAt:iso(p.ends_at),photoId:p.photo_id||null,crop:(()=>{const [x,y,zoom]=(p.photo_crop||'50-50-100').split('-').map(Number);return{x,y,zoom};})(),photoAlt:p.photo_alt||'',squareCandidate:p.square_candidate||''};}
export async function priceLocked(c:PoolConnection,id:string){
 const [r]=await c.execute<RowDataPacket[]>("SELECT square_candidate,source_reference FROM products p LEFT JOIN product_menu u ON u.product_id=p.id LEFT JOIN commerce_products m ON m.product_id=p.id WHERE p.id=?",[id]);
 if(r[0]?.square_candidate||/squareup|square:/i.test(r[0]?.source_reference||''))return true;
 const [t]=await c.query<RowDataPacket[]>("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='kitchen_square_mappings'");
 if(t.length){const [m]=await c.execute<RowDataPacket[]>('SELECT product_id FROM kitchen_square_mappings WHERE product_id=? LIMIT 1',[id]);if(m.length)return true;}
 return false;
}
export async function menuHistory(c:PoolConnection,id:string,actor:number|null,action:string,now:number){const [r]=await c.execute<RowDataPacket[]>(select+' WHERE p.id=?',[id]);if(r[0])await c.execute('INSERT INTO product_menu_history(product_id,actor_id,action,snapshot,created_at) VALUES(?,?,?,?,?)',[id,actor,action,JSON.stringify({details:draftFromRow(r[0]),publication:r[0].publication||'draft',available:!!r[0].available,version:Number(r[0].version),draft:r[0].draft?JSON.parse(r[0].draft):null}),sqlDate(now)]);}
export async function ownerMenu(){const [rows]=await database().query<RowDataPacket[]>(select+' ORDER BY p.kind,p.name');const [history]=await database().query<RowDataPacket[]>('SELECT id,product_id,action,snapshot,created_at FROM product_menu_history ORDER BY id DESC LIMIT 400');return {products:rows.map(p=>({id:p.id,version:Number(p.version),kind:p.kind,publication:p.publication||'draft',archived:!!p.archived,priceConfirmed:!!p.price_confirmed,ingredientsConfirmed:!!p.ingredients_confirmed,sourceReference:p.source_reference,details:draftFromRow(p),draft:p.draft?JSON.parse(p.draft):null})),history:history.map(h=>({...h,snapshot:JSON.parse(h.snapshot),created_at:iso(h.created_at)}))};}
export type MenuCommand={action:'create'|'save'|'publish'|'unpublish'|'archive'|'restore'|'clone';key:string;id?:string;version?:number;draft?:MenuDraft;revision?:number;confirmed?:boolean};
export async function changeMenu(actor:number,p:MenuCommand){return transaction(async(c,now)=>{
 const hash=digest(JSON.stringify(p));const [old]=await c.execute<RowDataPacket[]>('SELECT * FROM menu_operations WHERE operation_key=?',[p.key]);if(old[0]){if(Number(old[0].actor_id)!==actor||old[0].request_hash!==hash)throw new CommerceError('ACTION_CONFLICT');return JSON.parse(old[0].result);}
 let id=p.id||'',version=1;let draft=p.draft;
 if(p.action==='create'||p.action==='clone'){
  if(p.action==='clone'){const [r]=await c.execute<RowDataPacket[]>(select+' WHERE p.id=?',[id]);if(!r[0])throw new CommerceError('PRODUCT_NOT_FOUND',404);draft={...draftFromRow(r[0]),name:r[0].name+' — new special',weekly:true,category:'empanada',ovenEligible:true,startsAt:null,endsAt:null,squareCandidate:''};}
  if(!draft)throw new CommerceError('PRODUCT_DETAILS_REQUIRED',400);draft=menuDraftSchema.parse(draft);id='menu-'+randomUUID();
  await c.execute("INSERT INTO products(id,name,description,price_cents,kind,available,source_status) VALUES(?,?,?,?,'fresh',0,'initial')",[id,draft.name,draft.description,draft.priceCents??0]);
  await c.execute("INSERT INTO commerce_products(product_id,canonical_id,category,oven_units) VALUES(?,?,?,?)",[id,id,draft.category,draft.ovenEligible?1:0]);
  await c.execute('INSERT INTO product_menu(product_id,draft,weekly,oven_eligible) VALUES(?,?,?,?)',[id,JSON.stringify(draft),draft.weekly,draft.ovenEligible]);
 }else{
  const [r]=await c.execute<RowDataPacket[]>(select+' WHERE p.id=? FOR UPDATE',[id]);const prior=r[0];if(!prior)throw new CommerceError('PRODUCT_NOT_FOUND',404);if(Number(prior.version)!==p.version)throw new CommerceError('Product changed. Reload before saving.');
  await menuHistory(c,id!,actor,'before '+p.action,now);
  await c.execute('INSERT IGNORE INTO product_menu(product_id,oven_eligible) VALUES(?,?)',[id,prior.category==='empanada']);
  if(p.action==='restore'){const [h]=await c.execute<RowDataPacket[]>('SELECT snapshot FROM product_menu_history WHERE id=? AND product_id=?',[p.revision||0,id]);if(!h[0])throw new CommerceError('HISTORY_NOT_FOUND',404);draft=JSON.parse(h[0].snapshot).draft||JSON.parse(h[0].snapshot).details;}
  if(['save','publish','restore'].includes(p.action)){
   draft=menuDraftSchema.parse(draft||JSON.parse(prior.draft||'null'));
   if(prior.square_candidate&&draft.squareCandidate!==prior.square_candidate)throw new CommerceError('Square reference requires provider reconciliation before replacement.');
   if(draft.priceCents!==Number(prior.price_cents)&&await priceLocked(c,id!))throw new CommerceError('Square-linked price is locked until the provider price is verified.');
   if(draft.category!==(prior.category||'empanada')){const [used]=await c.execute<RowDataPacket[]>('SELECT (SELECT COUNT(*) FROM kitchen_lots WHERE product_id=?)+(SELECT COUNT(*) FROM pickup_order_lines WHERE product_id=?) n',[id,id]);if(Number(used[0].n))throw new CommerceError('Products with stock or orders keep their category. Create a new product.');}
   await c.execute('UPDATE product_menu SET draft=? WHERE product_id=?',[JSON.stringify(draft),id]);
   if(p.action==='publish'){
    if(!p.confirmed||draft.priceCents===null||!draft.description||!draft.ingredients||draft.photoId&&!draft.photoAlt)throw new CommerceError('Confirm the price, description, ingredients and photo description before publishing.');
    if(draft.squareCandidate&&(draft.squareCandidate!==prior.square_candidate||draft.priceCents!==Number(prior.price_cents)))throw new CommerceError('Square mapping is a draft. Provider verification is required before publishing it.');
    if(draft.weekly&&(!draft.startsAt||draft.endsAt&&Date.parse(draft.endsAt)<=now))throw new CommerceError('Choose a current or future schedule for this special.');
    if(draft.photoId){const [f]=await c.execute<RowDataPacket[]>('SELECT variant FROM menu_media_files WHERE media_id=? AND variant=?',[draft.photoId,cropKey(draft.crop)+'-640.webp']);if(!f[0])throw new CommerceError('Apply this photo crop before publishing.');await c.execute("UPDATE menu_media_files SET public_at=COALESCE(public_at,?) WHERE media_id=? AND variant LIKE ? AND variant<>'original'",[sqlDate(now),draft.photoId,cropKey(draft.crop)+'-%']);}
    await c.execute("UPDATE products SET name=?,description=?,price_cents=?,available=1,source_status='confirmed' WHERE id=?",[draft.name,draft.description,draft.priceCents,id]);
    await c.execute("INSERT INTO commerce_products(product_id,canonical_id,category,publication,price_confirmed,ingredients_confirmed,oven_units) VALUES(?,?,?,'staging',1,1,?) ON DUPLICATE KEY UPDATE category=VALUES(category),publication='staging',price_confirmed=1,ingredients_confirmed=1,oven_units=VALUES(oven_units),version=version+1",[id,id,draft.category,draft.ovenEligible?1:0]);
    await c.execute('UPDATE product_menu SET draft=NULL,ingredients=?,allergens=?,photo_id=?,photo_crop=?,photo_alt=?,variation_label=?,weekly=?,oven_eligible=?,starts_at=?,ends_at=?,archived=0,square_candidate=? WHERE product_id=?',[draft.ingredients,draft.allergens,draft.photoId,cropKey(draft.crop),draft.photoAlt,draft.variationLabel,draft.weekly,draft.ovenEligible,draft.startsAt?sqlDate(draft.startsAt):null,draft.endsAt?sqlDate(draft.endsAt):null,draft.squareCandidate,id]);
   }
  }else{await c.execute("UPDATE commerce_products SET publication='draft',version=version+1 WHERE product_id=?",[id]);if(p.action==='archive')await c.execute('UPDATE product_menu SET archived=1 WHERE product_id=?',[id]);}
  await c.execute('UPDATE products SET version=version+1 WHERE id=?',[id]);version=Number(prior.version)+1;
 }
 await menuHistory(c,id!,actor,p.action,now);await audit(c,actor,'menu:'+p.action,'product',id!);
 const result={id,version,ok:true};await c.execute('INSERT INTO menu_operations(operation_key,actor_id,request_hash,result) VALUES(?,?,?,?)',[p.key,actor,hash,JSON.stringify(result)]);return result;
});}
