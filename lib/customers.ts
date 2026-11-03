import 'server-only';
import type {RowDataPacket} from 'mysql2';
import {database} from './db';

export type CustomerScope = 'live' | 'sandbox';
export const customerPageSize = 25;
// Email normalization is identical in every query. The scope is part of the
// identity so a test checkout can never add history or notes to a real customer.
export const customerIdentitySql = "SHA2(CONCAT(IF(is_test=1,'sandbox:','live:'),LOWER(TRIM(contact_email))),256)";
const paidCustomerWhere = `is_test=? AND payment_status='paid' AND ${customerIdentitySql}=?`;

export function missingCustomerNotes(error: unknown) {
  const details = error as {code?:string;message?:string;sqlMessage?:string;sql?:string};
  return details?.code === 'ER_NO_SUCH_TABLE'
    && /\bcustomer_notes\b/.test([details.message,details.sqlMessage,details.sql].join(' '));
}

export async function customerNotesAvailable() {
  try {
    await database().query('SELECT customer_key FROM customer_notes LIMIT 0');
    return true;
  } catch (error) {
    if (missingCustomerNotes(error)) return false;
    throw error;
  }
}

export async function customerSummary(key: string, scope: CustomerScope) {
  const parameters = [scope === 'sandbox' ? 1 : 0, key];
  const [latest] = await database().execute<RowDataPacket[]>(
    `SELECT contact_name,LOWER(TRIM(contact_email)) AS email,created_at
     FROM pickup_orders WHERE ${paidCustomerWhere}
     ORDER BY created_at DESC,id DESC LIMIT 1`, parameters,
  );
  if (!latest.length) return null;
  const [count] = await database().execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS order_count FROM pickup_orders WHERE ${paidCustomerWhere}`, parameters,
  );
  return {
    key,
    name: String(latest[0].contact_name),
    email: String(latest[0].email),
    orderCount: Number(count[0].order_count),
    lastOrderAt: latest[0].created_at,
  };
}

export async function listCustomers(scope: CustomerScope, page: number) {
  const isTest = scope === 'sandbox' ? 1 : 0;
  const [count] = await database().execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM (
       SELECT ${customerIdentitySql} AS customer_key
       FROM pickup_orders WHERE is_test=? AND payment_status='paid'
       GROUP BY customer_key
     ) AS customer_groups`, [isTest],
  );
  const total = Number(count[0].total);
  // Bounds are validated integers, not request text. LIMIT/OFFSET literals also
  // work consistently with the existing MySQL and MariaDB prepared clients.
  const offset = (page - 1) * customerPageSize;
  const [groups] = await database().execute<RowDataPacket[]>(
    `SELECT ${customerIdentitySql} AS customer_key,COUNT(*) AS order_count,
            MAX(created_at) AS last_order_at
     FROM pickup_orders WHERE is_test=? AND payment_status='paid'
     GROUP BY customer_key ORDER BY last_order_at DESC,customer_key
     LIMIT ${customerPageSize} OFFSET ${offset}`, [isTest],
  );
  // Each latest-record read is bounded to one row, rather than truncating a
  // customer's history or guessing a display name from a grouped aggregate.
  const customers = await Promise.all(groups.map(async group => {
    const [latest] = await database().execute<RowDataPacket[]>(
      `SELECT contact_name,LOWER(TRIM(contact_email)) AS email
       FROM pickup_orders WHERE ${paidCustomerWhere}
       ORDER BY created_at DESC,id DESC LIMIT 1`, [isTest, group.customer_key],
    );
    return {
      key: String(group.customer_key),
      name: String(latest[0]?.contact_name || 'Customer'),
      email: String(latest[0]?.email || ''),
      orderCount: Number(group.order_count),
      lastOrderAt: group.last_order_at,
    };
  }));
  return {
    customers, scope, page, pageSize: customerPageSize, total,
    totalPages: Math.max(1, Math.ceil(total / customerPageSize)),
    hasNext: offset + customers.length < total,
    notesAvailable: await customerNotesAvailable(),
  };
}

export async function customerDetails(key: string, scope: CustomerScope, page: number) {
  const customer = await customerSummary(key, scope);
  if (!customer) return null;
  const offset = (page - 1) * customerPageSize;
  const [rows] = await database().execute<RowDataPacket[]>(
    `SELECT id,created_at,fulfilment_status,order_status,refund_status,
            subtotal_cents,tax_cents,deposit_cents,discount_cents,total_cents,currency
     FROM pickup_orders WHERE ${paidCustomerWhere}
     ORDER BY created_at DESC,id DESC
     LIMIT ${customerPageSize} OFFSET ${offset}`, [scope === 'sandbox' ? 1 : 0, key],
  );
  const orders = await Promise.all(rows.map(async row => {
    const [items] = await database().execute<RowDataPacket[]>(
      'SELECT name,quantity FROM pickup_order_lines WHERE order_id=? ORDER BY name', [row.id],
    );
    return {
      id: String(row.id), createdAt: row.created_at,
      fulfilmentStatus: String(row.fulfilment_status), orderStatus: String(row.order_status),
      refundStatus: String(row.refund_status), totalCents: Number(row.total_cents),
      subtotalCents: Number(row.subtotal_cents), taxCents: Number(row.tax_cents),
      depositCents: Number(row.deposit_cents), discountCents: Number(row.discount_cents),
      currency: String(row.currency),
      items: items.map(item => ({name: String(item.name), quantity: Number(item.quantity)})),
    };
  }));
  let notesAvailable = true, note = '', version = 0, updatedAt: unknown = null;
  try {
    const [notes] = await database().execute<RowDataPacket[]>(
      'SELECT note,version,updated_at FROM customer_notes WHERE customer_key=?', [key],
    );
    if (notes[0]) {
      note = String(notes[0].note);
      version = Number(notes[0].version);
      updatedAt = notes[0].updated_at;
    }
  } catch (error) {
    if (!missingCustomerNotes(error)) throw error;
    notesAvailable = false;
  }
  return {
    customer, scope, orders, page, pageSize: customerPageSize,
    total: customer.orderCount,
    totalPages: Math.max(1, Math.ceil(customer.orderCount / customerPageSize)),
    hasNext: offset + orders.length < customer.orderCount,
    notesAvailable, note, version, updatedAt,
  };
}
