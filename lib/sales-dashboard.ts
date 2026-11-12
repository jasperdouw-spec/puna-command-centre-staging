import 'server-only';
import type {RowDataPacket} from 'mysql2';
import {database} from './db';
import {reportingAvailable} from './sales';
import {periods,buckets,metrics,type PeriodKind,type Window} from './sales-periods';
const sums=`COUNT(*) records,COUNT(DISTINCT d.transaction_id) transactions,SUM(d.net_cents) net,SUM(h.quantity) quantity,SUM(h.refund_cents) refunds,SUM(h.discount_cents) discounts,SUM(h.tax_cents) tax,SUM(d.timestamp_status='ambiguous_wall_time') ambiguous`;
const joins='FROM historical_sales h JOIN sales_details d USING(source_key) JOIN sales_mappings m USING(source_product_key)';
export async function salesDashboard(kind:PeriodKind,day:string,product?:string){
 if(!await reportingAvailable())return {available:false,reason:'Reporting schema is unavailable. No migration was attempted.'};
 const db=database(),c=await db.getConnection();
 try{
  // One repeatable read snapshot prevents refresh/import commits splitting cards,
  // product totals and comparisons across different versions of the ledger.
  await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await c.query('START TRANSACTION READ ONLY');
  const [clock]=await c.query<RowDataPacket[]>('SELECT UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3))*1000 now_ms');
  const period=periods(kind,day,new Date(Number(clock[0].now_ms)));
  async function windowData(w:Window){
   const where=` WHERE h.is_test=0 AND d.included=1 AND d.local_date>=? AND d.local_date<? AND d.local_date<=? AND (d.timestamp_status='ambiguous_wall_time' OR h.sold_at<?)${product?' AND d.source_product_key=?':''}`;
   const args=[w.start,w.end,w.through,w.cutoff.replace('T',' ').slice(0,23),...(product?[product]:[])];
   const [total]=await c.execute<RowDataPacket[]>('SELECT '+sums+' '+joins+where,args);
   const uncertain=w.partial&&Number(total[0].ambiguous)>0;
   const key=kind==='day'?"DATE_FORMAT(h.sold_at,'%Y-%m-%dT%H')":"DATE_FORMAT(d.local_date,'%Y-%m-%d')";
   const [points]=await c.execute<RowDataPacket[]>(`SELECT ${key} bucket,${sums} ${joins}${where}${kind==='day'?" AND d.timestamp_status<>'ambiguous_wall_time'":''} GROUP BY ${key}`,args);
   const map=new Map(points.map(p=>[p.bucket,p]));
   const [products]=await c.execute<RowDataPacket[]>(`SELECT d.source_product_key productKey,CONCAT(m.item_name,IF(m.variant_name='','',CONCAT(' · ',m.variant_name))) name,m.product_id productId,${sums} ${joins}${where} GROUP BY d.source_product_key,m.item_name,m.variant_name,m.product_id ORDER BY net DESC,d.source_product_key`,args);
   return {totals:metrics(total[0],uncertain),records:Number(total[0].records),ambiguousRows:Number(total[0].ambiguous),uncertain,points:buckets(kind,w).map(b=>({...b,metrics:metrics(map.get(b.key)||{},uncertain||!b.elapsed)})),products:products.map(p=>({key:p.productKey,name:p.name,mapped:!!p.productId,metrics:metrics(p,uncertain)}))};
  }
  const current=await windowData(period.current),previous=await windowData(period.previous);
  const [connection]=await c.query<RowDataPacket[]>('SELECT last_success,last_attempt,failure_code,watermark FROM sales_connection WHERE id=1');
  const [coverage]=await c.query<RowDataPacket[]>("SELECT DATE_FORMAT(MIN(d.local_date),'%Y-%m-%d') firstDate,DATE_FORMAT(MAX(d.local_date),'%Y-%m-%d') lastDate,COUNT(DISTINCT d.local_date) observedDays FROM sales_details d JOIN historical_sales h USING(source_key) WHERE d.included=1 AND h.is_test=0");
  const [unresolved]=await c.query<RowDataPacket[]>('SELECT COUNT(*) count FROM sales_mappings WHERE product_id IS NULL');
  const [exclusions]=await c.query<RowDataPacket[]>('SELECT state,COUNT(*) count FROM sales_api_orders WHERE state<>\'included\' GROUP BY state');
  const [runs]=await c.query<RowDataPacket[]>("SELECT state,COUNT(*) count FROM sales_runs WHERE state<>'complete' GROUP BY state");
  const [legacy]=await c.query<RowDataPacket[]>('SELECT COUNT(*) count FROM historical_sales h LEFT JOIN sales_details d USING(source_key) WHERE h.is_test=0 AND d.source_key IS NULL');
  // Detect transaction IDs reused across distinct source/merchant/location identities.
  // Preserve the existing distinct-ID definition, but withhold AOV/count if ambiguous.
  const [identity]=await c.execute<RowDataPacket[]>(`SELECT COUNT(*) count FROM (SELECT d.transaction_id ${joins} WHERE h.is_test=0 AND d.included=1 AND d.local_date BETWEEN ? AND ? GROUP BY d.transaction_id HAVING COUNT(DISTINCT CONCAT(d.source_kind,':',COALESCE(d.merchant_id,''),':',d.location_key))>1) collisions`,[period.previous.start,period.current.through]);
  const collisions=Number(identity[0].count);if(collisions)for(const w of [current,previous]){w.totals.transactions=null;w.totals.aov=null;for(const p of [...w.points,...w.products]){p.metrics.transactions=null;p.metrics.aov=null;}}
  await c.commit();
  return {available:true,period,current,previous,product:product||null,connection:connection[0]||null,coverage:{firstDate:coverage[0].firstDate as string|null,lastDate:coverage[0].lastDate as string|null,observedDays:Number(coverage[0].observedDays),complete:false},unresolvedMappings:Number(unresolved[0].count),exclusions,unfinishedRuns:runs,legacyExclusions:Number(legacy[0].count),identityCollisions:collisions,currency:'CAD',timezone:'America/Vancouver',freshnessLagMinutes:15};
 }catch(e){await c.rollback();throw e;}finally{c.release();}
}
export type DashboardData=Awaited<ReturnType<typeof salesDashboard>>;
