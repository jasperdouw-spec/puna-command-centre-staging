import {z} from 'zod';
import type {ResultSetHeader,RowDataPacket} from 'mysql2';
import {requireRole,checkOrigin} from '@/lib/auth';
import {database} from '@/lib/db';
import {json,failure} from '@/lib/http';
import {customerDetails,listCustomers,customerIdentitySql,missingCustomerNotes} from '@/lib/customers';

export const runtime = 'nodejs';
const key = z.string().regex(/^[a-f0-9]{64}$/);
const scope = z.enum(['live','sandbox']);
const query = z.object({
  scope: scope.default('live'),
  page: z.string().regex(/^[1-9]\d{0,5}$/).transform(Number).default('1'),
  key: key.optional(),
}).strict();
const noteInput = z.object({
  key, scope, note: z.string().trim().max(2000),
  version: z.number().int().nonnegative().max(4294967294),
}).strict();

export async function GET(req: Request) {
  try {
    await requireRole(['owner']);
    const params = new URL(req.url).searchParams;
    if ([...new Set(params.keys())].some(name => params.getAll(name).length !== 1)) {
      return json({error:'Invalid customer query'},400);
    }
    const parsed = query.safeParse(Object.fromEntries(params));
    if (!parsed.success) return json({error:'Invalid customer query'},400);
    const p = parsed.data;
    if (!p.key) return json(await listCustomers(p.scope,p.page));
    const customer = await customerDetails(p.key,p.scope,p.page);
    return customer ? json(customer) : json({error:'Customer not found'},404);
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(req: Request) {
  if (!checkOrigin(req)) return json({error:'Invalid origin'},403);
  try {
    const user = await requireRole(['owner']);
    const raw = await req.text();
    if (Buffer.byteLength(raw,'utf8') > 12000) return json({error:'Request too large'},413);
    const parsed = noteInput.safeParse(JSON.parse(raw));
    if (!parsed.success) return json({error:'Invalid customer note'},400);
    const p = parsed.data, conn = await database().getConnection();
    try {
      await conn.beginTransaction();
      const [customer] = await conn.execute<RowDataPacket[]>(
        `SELECT id FROM pickup_orders WHERE is_test=? AND payment_status='paid'
         AND ${customerIdentitySql}=? LIMIT 1`, [p.scope === 'sandbox' ? 1 : 0,p.key],
      );
      if (!customer.length) {
        await conn.rollback();
        return json({error:'Customer not found'},404);
      }
      let result: ResultSetHeader;
      if (p.version === 0) {
        [result] = await conn.execute<ResultSetHeader>(
          'INSERT INTO customer_notes(customer_key,note,updated_by) VALUES(?,?,?)',
          [p.key,p.note,user.id],
        );
      } else {
        [result] = await conn.execute<ResultSetHeader>(
          `UPDATE customer_notes SET note=?,version=version+1,updated_by=?
           WHERE customer_key=? AND version=?`, [p.note,user.id,p.key,p.version],
        );
      }
      if (result.affectedRows !== 1) {
        await conn.rollback();
        return json({error:'This note changed. Reload it before saving.'},409);
      }
      await conn.execute(
        'INSERT INTO audit_log(actor_id,action,entity_type,entity_id) VALUES(?,?,?,?)',
        [user.id,'customer:note','customer',p.key],
      );
      await conn.commit();
      return json({saved:true,note:p.note,version:p.version+1});
    } catch (error) {
      await conn.rollback();
      if (missingCustomerNotes(error)) return json({error:'Customer notes are not available yet.'},503);
      if ((error as {code?: string}).code === 'ER_DUP_ENTRY') {
        return json({error:'This note changed. Reload it before saving.'},409);
      }
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    if (error instanceof SyntaxError) return json({error:'Invalid JSON'},400);
    return failure(error);
  }
}
