import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';

export async function runCustomerChecks({db,request,check,cookie,staffCookie}) {
  const hash = text => createHash('sha256').update(text).digest('hex');
  const identity = (scope,email) => hash(scope+':'+email.trim().toLowerCase());
  const liveKey = identity('live','crm-customer@example.test');
  const sandboxKey = identity('sandbox','crm-customer@example.test');
  const list = scope => request('/api/customers?scope='+scope,{cookie});
  const details = (key,scope='live',page=1) => request(`/api/customers?scope=${scope}&key=${key}&page=${page}`,{cookie});
  const save = (body,options={}) => request('/api/customers',{
    method:'PATCH',cookie,body:{key:liveKey,scope:'live',...body},...options,
  });
  const orderIds = [], fixtureKeys = new Set([liveKey,sandboxKey]);
  let batchId, configurationId;
  const forbidden = ['receipt_hash','receiptKey','payment_idempotency_key','request_hash','checkout_key','square_payment_id','square_order_id','created_by','updated_by'];
  function noPrivateFields(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key,child] of Object.entries(value)) {
      assert.ok(!forbidden.includes(key),'Unexpected private field '+key);
      noPrivateFields(child);
    }
  }
  try {
    await check('customer records and notes are restricted to owners',async()=>{
      assert.equal((await request('/api/customers')).status,401);
      assert.equal((await request('/api/customers',{cookie:staffCookie})).status,403);
      assert.equal((await save({note:'Private',version:0},{cookie:undefined})).status,401);
      assert.equal((await save({note:'Private',version:0},{cookie:staffCookie})).status,403);
      for (const originHeader of [null,'https://foreign.example.test','http://localhost:3443']) {
        assert.equal((await save({note:'Private',version:0},{originHeader})).status,403);
      }
      assert.equal((await request('/api/customers?scope=all',{cookie})).status,400);
      assert.equal((await request('/api/customers?scope=live&scope=sandbox',{cookie})).status,400);
      assert.equal((await request('/api/customers?page=-1',{cookie})).status,400);
      assert.equal((await save({note:'x'.repeat(2001),version:0})).status,400);
      assert.equal((await save({note:'Private',version:0,unexpected:true})).status,400);
      assert.equal((await save({note:'Private',version:0,padding:'x'.repeat(13000)})).status,413);
    });
    const before = await list('live');
    assert.equal(before.status,200);
    await check('empty real customer records never invent sandbox customers',async()=>{
      assert.equal(before.data.total,0);
      assert.deepEqual(before.data.customers,[]);
      assert.equal(before.data.hasNext,false);
      assert.equal(before.data.scope,'live');
    });

    const [owners] = await db.query("SELECT id FROM users WHERE role='owner' ORDER BY id LIMIT 1");
    const [configuration] = await db.execute(
      'INSERT INTO capacity_versions(effective_at,configuration,created_by) VALUES(?,?,?)',
      ['2020-01-01 00:00:00',JSON.stringify({syntheticCustomerFixture:true}),owners[0].id],
    );
    configurationId = configuration.insertId;
    batchId = randomUUID();
    await db.execute(
      `INSERT INTO service_batches(id,configuration_id,bake_at,cutoff_at,pickup_at,pickup_until,oven_capacity,packing_capacity_seconds,state)
       VALUES(?,?,'2020-01-01 00:10:00','2020-01-01 00:00:00','2020-01-01 00:30:00','2020-01-01 00:40:00',200,0,'completed')`,
      [batchId,configurationId],
    );
    async function addOrder({email,name='Synthetic CRM customer',isTest=0,paid=true,created='2020-01-01 00:00:00',complete=true}) {
      const id = randomUUID(); orderIds.push(id);
      fixtureKeys.add(identity(isTest?'sandbox':'live',email));
      await db.execute(
        `INSERT INTO pickup_orders(id,checkout_key,request_hash,receipt_hash,batch_id,payment_status,order_status,fulfilment_status,
          hold_status,expires_at,contact_name,contact_email,subtotal_cents,tax_cents,deposit_cents,total_cents,is_test,payment_idempotency_key,created_at)
         VALUES(?,?,?,?,?,?,?,?,?,'2020-01-01 00:10:00',?,?,800,40,0,840,?,?,?)`,
        [id,randomUUID(),hash('request:'+id),hash('receipt:'+id),batchId,paid?'paid':'unpaid',complete?'complete':'open',
          complete?'collected':'reserved',paid?'committed':'released',name,email,isTest,randomUUID(),created],
      );
      await db.execute(
        `INSERT INTO pickup_order_lines(order_id,product_id,name,quantity,unit_price_cents,tax_snapshot,tax_cents,deposit_cents,oven_units,packing_seconds,inventory_stage)
         VALUES(?,'synthetic-product','Synthetic CRM item',1,800,'[]',40,0,1,0,'frozen')`,[id],
      );
      return id;
    }
    const olderId = await addOrder({email:'  CRM-Customer@Example.Test  ',name:'Synthetic older name'});
    const newerId = await addOrder({email:'crm-customer@example.test',name:'Synthetic latest name',created:'2020-01-02 00:00:00'});
    await addOrder({email:'crm-customer@example.test',name:'Synthetic sandbox name',isTest:1});
    await addOrder({email:'unpaid-crm@example.test',paid:false});
    for(let i=0;i<27;i++) await addOrder({email:`crm-page-${String(i).padStart(2,'0')}@example.test`});

    await check('customer grouping uses normalized email and complete paid history',async()=>{
      const first = await list('live');
      assert.equal(first.status,200); assert.equal(first.data.total,28);
      assert.equal(first.data.customers.length,25); assert.equal(first.data.hasNext,true);
      assert.equal(first.data.totalPages,2);
      const customer = first.data.customers.find(customer=>customer.key===liveKey);
      assert.ok(customer); assert.equal(customer.orderCount,2);
      assert.equal(customer.name,'Synthetic latest name');
      assert.equal(customer.email,'crm-customer@example.test');
      const second = await request('/api/customers?scope=live&page=2',{cookie});
      assert.equal(second.data.customers.length,3); assert.equal(second.data.hasNext,false);
      const all = [...first.data.customers,...second.data.customers];
      assert.equal(new Set(all.map(customer=>customer.key)).size,28);
      assert.ok(!all.some(customer=>customer.email==='unpaid-crm@example.test'));
      const detail = await details(liveKey);
      assert.equal(detail.status,200); assert.equal(detail.data.total,2);
      assert.deepEqual(detail.data.orders.map(order=>order.id),[newerId,olderId]);
      assert.ok(detail.data.orders.every(order=>order.orderStatus==='complete'));
      assert.ok(detail.data.orders.every(order=>order.totalCents===840 && order.items.length===1));
      noPrivateFields(first.data); noPrivateFields(detail.data);
    });
    await check('sandbox customers cannot be merged with real customers or notes',async()=>{
      const sandbox = await details(sandboxKey,'sandbox');
      assert.equal(sandbox.status,200); assert.equal(sandbox.data.customer.orderCount,1);
      assert.equal(sandbox.data.customer.name,'Synthetic sandbox name');
      assert.notEqual(sandboxKey,liveKey);
      assert.equal((await details(liveKey,'sandbox')).status,404);
      assert.equal((await details(sandboxKey,'live')).status,404);
      assert.equal((await save({scope:'sandbox',note:'Wrong scope',version:0})).status,404);
    });

    await check('customer notes persist privately and reject concurrent first saves',async()=>{
      const before = await details(liveKey);
      assert.equal(before.data.notesAvailable,true); assert.equal(before.data.version,0);
      const results = await Promise.all([
        save({note:'Synthetic pickup preference A',version:0}),
        save({note:'Synthetic pickup preference B',version:0}),
      ]);
      assert.deepEqual(results.map(result=>result.status).sort(),[200,409]);
      const after = await details(liveKey);
      assert.equal(after.data.version,1);
      assert.match(after.data.note,/^Synthetic pickup preference [AB]$/);
      const separate = await details(sandboxKey,'sandbox');
      assert.equal(separate.data.note,''); assert.equal(separate.data.version,0);
      const publicData = await request('/api/puna');
      assert.ok(!JSON.stringify(publicData.data).includes(after.data.note));
      const [audits] = await db.execute("SELECT action,entity_id FROM audit_log WHERE action='customer:note' AND entity_id=?",[liveKey]);
      assert.equal(audits.length,1); assert.equal(audits[0].entity_id,liveKey);
    });
    await check('customer note edits use optimistic versions and transactional audit',async()=>{
      const text = '<strong>Synthetic note stored as text</strong>';
      assert.equal((await save({note:text,version:1})).status,200);
      assert.equal((await save({note:'Stale overwrite',version:1})).status,409);
      const saved = await details(liveKey);
      assert.equal(saved.data.note,text); assert.equal(saved.data.version,2);
      await db.query("CREATE TRIGGER synthetic_customer_audit_failure BEFORE INSERT ON audit_log FOR EACH ROW BEGIN IF NEW.action='customer:note' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic note rollback'; END IF; END");
      try { assert.equal((await save({note:'Must roll back',version:2})).status,503); }
      finally { await db.query('DROP TRIGGER synthetic_customer_audit_failure'); }
      const after = await details(liveKey);
      assert.equal(after.data.note,text); assert.equal(after.data.version,2);
    });
    await check('missing note storage leaves customer history available without pretending to save',async()=>{
      await db.query('RENAME TABLE customer_notes TO synthetic_customer_notes_unavailable');
      try {
        const first = await list('live'), detail = await details(liveKey);
        assert.equal(first.status,200); assert.equal(first.data.notesAvailable,false);
        assert.equal(detail.status,200); assert.equal(detail.data.notesAvailable,false);
        assert.equal(detail.data.customer.orderCount,2);
        assert.equal((await save({note:'Cannot save',version:2})).status,503);
      } finally {
        await db.query('RENAME TABLE synthetic_customer_notes_unavailable TO customer_notes');
      }
    });
  } finally {
    if(fixtureKeys.size) {
      const keys = [...fixtureKeys];
      await db.execute('DELETE FROM customer_notes WHERE customer_key IN ('+keys.map(()=>'?').join(',')+')',keys);
    }
    if(orderIds.length) {
      const placeholders = orderIds.map(()=>'?').join(',');
      await db.execute('DELETE FROM pickup_order_lines WHERE order_id IN ('+placeholders+')',orderIds);
      await db.execute('DELETE FROM pickup_orders WHERE id IN ('+placeholders+')',orderIds);
    }
    if(batchId) await db.execute('DELETE FROM service_batches WHERE id=?',[batchId]);
    if(configurationId) await db.execute('DELETE FROM capacity_versions WHERE id=?',[configurationId]);
  }
}
