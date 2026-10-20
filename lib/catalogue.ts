import 'server-only';
import {database} from './db';
import {initialSettings,initialProducts,type Settings,type Product} from './puna';
import type {RowDataPacket} from 'mysql2';
export async function catalogue(){
 const [products]=await database().execute<RowDataPacket[]>('SELECT id,name,description,price_cents,available,kind FROM products ORDER BY kind,id');
 const [settings]=await database().execute<RowDataPacket[]>("SELECT value,version FROM website_settings WHERE id='business'");
 const order=initialProducts.map(p=>p.id);
 products.sort((a,b)=>(order.includes(a.id)?order.indexOf(a.id):999)-(order.includes(b.id)?order.indexOf(b.id):999));
 return {products:products.map(p=>({id:p.id,name:p.name,description:p.description,price:Number(p.price_cents),available:p.kind==='fresh'&&!!p.available,kind:p.kind})) as Product[],settings:settings[0]?JSON.parse(settings[0].value) as Settings:initialSettings,version:settings[0]?.version??0};
}
