import 'server-only';
import {menuActiveSql} from './menu-model';
import {database} from './db';
import {initialSettings,initialProducts,type Settings,type Product} from './puna';
import type {RowDataPacket} from 'mysql2';
export async function catalogue(){
 const [products]=await database().execute<RowDataPacket[]>(`SELECT p.id,p.name,p.description,p.price_cents,p.available,p.kind,m.category,u.ingredients,u.allergens,u.photo_id,u.photo_crop,u.photo_alt,u.variation_label,u.weekly,u.oven_eligible FROM products p LEFT JOIN commerce_products m ON m.product_id=p.id LEFT JOIN product_menu u ON u.product_id=p.id WHERE (m.product_id IS NULL OR (m.publication='staging' AND m.category<>'ingredient')) AND ${menuActiveSql} ORDER BY p.kind,p.id`);
 const [settings]=await database().execute<RowDataPacket[]>("SELECT value,version FROM website_settings WHERE id='business'");
 const order=initialProducts.map(p=>p.id);
 products.sort((a,b)=>(order.includes(a.id)?order.indexOf(a.id):999)-(order.includes(b.id)?order.indexOf(b.id):999));
 return {products:products.map(p=>({id:p.id,name:p.name,description:p.description,price:Number(p.price_cents),available:p.kind==='fresh'&&!!p.available,kind:p.kind,category:p.category||'empanada',ingredients:p.ingredients||'',allergens:p.allergens||'',photoId:p.photo_id,photoCrop:p.photo_crop,photoAlt:p.photo_alt,variationLabel:p.variation_label,weekly:!!p.weekly,ovenEligible:p.oven_eligible!==0})) as Product[],settings:settings[0]?{...initialSettings,...JSON.parse(settings[0].value)} as Settings:initialSettings,version:settings[0]?.version??0};
}
