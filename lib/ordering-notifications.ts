import 'server-only';
import QRCode from 'qrcode';
import type {RowDataPacket} from 'mysql2/promise';
import {transaction,sqlDate,digest,audit} from './commerce';
import {requireLocal,seal,unseal} from './ordering-gates';
import {loadOrder,customerState,publicOrder,syncOrdering} from './ordering';
import {readKitchen} from './kitchen';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function dispatchNotifications(){requireLocal();await transaction((c,now)=>syncOrdering(c,now));let sent=0,failed=0,suppressed=0;
 for(let n=0;n<10;n++){
  const job=await transaction(async(c,now)=>{const [rows]=await c.execute<RowDataPacket[]>("SELECT * FROM kitchen_notifications WHERE (state='pending' OR state='running' AND locked_until<=?) AND available_at<=? ORDER BY created_at,id LIMIT 1 FOR UPDATE",[sqlDate(now),sqlDate(now)]);if(!rows[0])return null;const j=rows[0];await c.execute("UPDATE kitchen_notifications SET state='running',attempts=attempts+1,locked_until=? WHERE id=?",[sqlDate(now+20000),j.id]);return j;});if(!job)break;
  // A real provider adapter will use its idempotency key outside the stock lock.
  // The fake capture is a separate transaction after claim, with a final state
  // check at delivery. It sends no network request or email.
  const result=await transaction(async(c,now)=>{const [rows]=await c.execute<RowDataPacket[]>('SELECT * FROM kitchen_notifications WHERE id=? FOR UPDATE',[job.id]);const j=rows[0];if(j.state!=='running')return 'suppressed';const o=await loadOrder(c,j.order_id),s=await readKitchen(c,now),state=customerState(o,s);const obsolete=j.kind==='ready'&&(state!=='ready'||j.eligibility_hash!==digest(o.status_fingerprint))||j.kind==='delay'&&(state!=='delayed'||j.eligibility_hash!==digest(o.status_fingerprint))||['confirmation','pass_reissued'].includes(j.kind)&&o.payment_status!=='paid';
   if(obsolete){await c.execute("UPDATE kitchen_notifications SET state='suppressed',locked_until=NULL WHERE id=?",[j.id]);return 'suppressed';}
   if(Number(j.fixture_failures)>0){await c.execute("UPDATE kitchen_notifications SET fixture_failures=fixture_failures-1,state='pending',locked_until=NULL,available_at=?,last_error_code='LOCAL_DELIVERY_FAILURE' WHERE id=?",[sqlDate(now+1000),j.id]);return 'failed';}
   const view=await publicOrder(c,o,now),token=unseal<string>(o.sealed_access_token,'status-token'),origin=process.env.PUNA_D1_ORIGIN||'https://localhost:3443';if(!['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname))throw Error('LOCAL_EMAIL_ORIGIN_REQUIRED');
   const subject=({confirmation:'Payment confirmed',ready:'Ready for pickup',delay:'An update from the kitchen',exception:'Your order needs a review',cancelled:'Order cancelled',pass_reissued:'Your replacement pickup pass'} as Record<string,string>)[j.kind]+' · '+o.order_number;
   const link=origin+'/order-status#'+token,pickupPass=view.pickupToken?'puna-pickup:'+view.pickupToken:null;
   const text=[subject,'LOCAL CAPTURE ONLY — no email sent.',view.pickup,view.lines.map(l=>l.quantity+' × '+l.name).join('\n'),state==='ready'?'Your complete order is packed and ready.':'Check your status before travelling. Estimated times are not a pickup guarantee.',link].join('\n\n');
   const qrDataUrl=pickupPass?await QRCode.toDataURL(pickupPass,{width:280,margin:4,errorCorrectionLevel:'M'}):null;
   const content={qrDataUrl,to:o.contact_email,subject,text,html:'<h1>'+escape(subject)+'</h1><p>'+escape(view.pickup)+'</p><p>'+escape(view.lines.map(l=>l.quantity+' × '+l.name).join(', '))+'</p><p><a href="'+escape(link)+'">View your order and pickup pass</a></p>'+(qrDataUrl?'<img alt="Private pickup pass" src="'+qrDataUrl+'"/>':''),statusLink:link,pickupPass,orderNumber:o.order_number,type:j.kind};const reference='local-email-'+j.id;
   await c.execute('INSERT IGNORE INTO local_email_captures(id,notification_id,sealed_content,created_at) VALUES(?,?,?,?)',[reference,j.id,seal(content,'email-capture'),sqlDate(now)]);await c.execute("UPDATE kitchen_notifications SET state='sent',provider_reference=?,sent_at=?,locked_until=NULL,last_error_code=NULL WHERE id=?",[reference,sqlDate(now),j.id]);await audit(c,null,'ordering:notification_captured:'+j.kind,'pickup_order',o.id);return 'sent';});
  if(result==='sent')sent++;else if(result==='failed')failed++;else suppressed++;
 }return {sent,failed,suppressed};
}
