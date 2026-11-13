import 'server-only';
import type {PoolConnection,RowDataPacket} from 'mysql2/promise';
import {commercialIssue,priceIssue} from './square-catalog-model';
import {CommerceError} from './commerce-model';
// This is the existing isolated fixture boundary, never a hosted launch switch.
export function disposableCatalog(){return process.env.PUNA_DISPOSABLE_LOCAL_TESTS==='true'&&process.env.DB_HOST==='127.0.0.1'&&process.env.DB_NAME==='puna_ci_synthetic'&&process.env.DB_USER==='puna_ci'&&/^[a-f0-9]{32}$/.test(process.env.PUNA_TEST_RUN_ID||'');}
export async function catalogIssues(c:PoolConnection,ids:string[],now:number){
 if(!ids.length)return new Map<string,string|null>();
 const [links]=await c.query<RowDataPacket[]>('SELECT * FROM square_catalog_links WHERE product_id IN (?)',[ids]);
 const [state]=await c.query<RowDataPacket[]>('SELECT * FROM square_catalog_state WHERE id=1');
 return new Map(ids.map(id=>[id,commercialIssue(links.find(l=>l.product_id===id),state[0],now)]));
}
export async function requireCatalogProduct(c:PoolConnection,id:string,now:number){if(disposableCatalog())return;const [links]=await c.execute<RowDataPacket[]>('SELECT * FROM square_catalog_links WHERE product_id=?',[id]);const [states]=await c.query<RowDataPacket[]>('SELECT * FROM square_catalog_state WHERE id=1');const issue=priceIssue(links[0],states[0],now);if(issue)throw new CommerceError(issue);}
