// D2 preparation only. No imports from the application or its dependencies.
import {createHmac, timingSafeEqual} from 'node:crypto';

export const SQUARE_SANDBOX_ORIGIN = 'https://connect.squareupsandbox.com';
export const REQUIRED_SCOPES = ['MERCHANT_PROFILE_READ', 'PAYMENTS_READ', 'PAYMENTS_WRITE'];
const fail = code => { throw new Error(code); };
const identity = value => typeof value === 'string' && value.length>=5 && value.length<=100 && !/[^A-Za-z0-9_-]/.test(value);

export function assertSandboxIdentity(config, token, merchant, location) {
  if (config?.enabled !== true || config.environment !== 'sandbox' || config.origin !== SQUARE_SANDBOX_ORIGIN) fail('SANDBOX_ONLY');
  if (![config.applicationId, config.merchantId, config.locationId].every(identity)) fail('EXPLICIT_SANDBOX_IDENTITIES_REQUIRED');
  if (token.client_id !== config.applicationId || token.merchant_id !== config.merchantId) fail('TOKEN_IDENTITY_MISMATCH');
  if (!Array.isArray(token.scopes) || REQUIRED_SCOPES.some(s => !token.scopes.includes(s)) || token.scopes.some(s => !REQUIRED_SCOPES.includes(s))) fail('MINIMAL_SANDBOX_SCOPES_REQUIRED');
  if (merchant.id !== config.merchantId || merchant.country !== 'CA' || merchant.currency !== 'CAD') fail('SANDBOX_MERCHANT_MISMATCH');
  if (location.id !== config.locationId || location.merchant_id !== config.merchantId || location.country !== 'CA' || location.currency !== 'CAD' || location.status !== 'ACTIVE') fail('SANDBOX_LOCATION_MISMATCH');
  return true;
}

export function assertSandboxPayment(config, order, payment) {
  if (config?.enabled !== true || config.environment !== 'sandbox' || config.origin !== SQUARE_SANDBOX_ORIGIN) fail('SANDBOX_ONLY');
  if (typeof payment.id !== 'string' || !identity(payment.id) || payment.location_id !== config.locationId || payment.reference_id !== order.id) fail('PAYMENT_IDENTITY_MISMATCH');
  if (!Number.isSafeInteger(order.totalCents) || order.totalCents <= 0 || payment.amount_money?.amount !== order.totalCents || payment.amount_money?.currency !== 'CAD') fail('PAYMENT_AMOUNT_MISMATCH');
  if (!['APPROVED','PENDING','COMPLETED','CANCELED','FAILED'].includes(payment.status)) fail('UNKNOWN_PAYMENT_STATUS');
  return payment.status; // The private consumer must still atomically check durable identity/idempotency/stock.
}

export function verifySquareSignature(raw, signature, key, notificationUrl) {
  if (!Buffer.isBuffer(raw) || typeof key !== 'string' || key.length < 20 || typeof signature !== 'string') return false;
  const expected = createHmac('sha256', key).update(notificationUrl).update(raw).digest('base64');
  return Buffer.byteLength(signature) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function assertTestRecipient(recipient, approved) {
  // One explicit mailbox, no display-name syntax, lists, CC/BCC or domain wildcards.
  const mailbox = value => typeof value === 'string' && value===value.trim() && !value.includes('*') && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value);
  if (!mailbox(recipient) || !Array.isArray(approved) || !approved.length || approved.some(a => !mailbox(a))) fail('APPROVED_TEST_RECIPIENT_REQUIRED');
  if (!approved.map(a => a.toLowerCase()).includes(recipient.toLowerCase())) fail('RECIPIENT_NOT_ALLOWLISTED');
  return recipient;
}
