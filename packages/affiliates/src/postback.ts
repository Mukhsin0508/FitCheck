import type { AffiliateNetworkId, PostbackEvent } from './schema';
import { decodeSubId } from './subid';

function str(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

/** Major units ('12.50' or 12.5) → integer cents. Invalid → 0. */
function toCents(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 100);
  if (typeof value === 'string') {
    const n = Number.parseFloat(value.replace(/,/g, ''));
    if (Number.isFinite(n)) return Math.round(n * 100);
  }
  return 0;
}

/** Already-cents value (direct network) → integer cents. Invalid → 0. */
function asCents(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value === 'string') {
    const n = Number.parseFloat(value);
    if (Number.isFinite(n)) return Math.round(n);
  }
  return 0;
}

function currencyOf(payload: Record<string, unknown>): string {
  const candidates = [payload['currency'], payload['saleCurrency'], payload['commissionCurrency']];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length === 3) return c.toUpperCase();
  }
  return 'USD';
}

const AWIN_STATUS: Record<string, PostbackEvent['status']> = {
  pending: 'pending',
  approved: 'confirmed',
  declined: 'declined',
};

interface FieldMap {
  orderId: string;
  commission: string;
  sale: string;
  subId: string;
}

const FIELDS: Record<AffiliateNetworkId, FieldMap> = {
  awin: { orderId: 'transactionId', commission: 'commissionAmount', sale: 'saleAmount', subId: 'clickRef' },
  rakuten: { orderId: 'order_id', commission: 'commissions', sale: 'sale_amount', subId: 'u1' },
  cj: { orderId: 'orderId', commission: 'commissionAmount', sale: 'saleAmount', subId: 'sid' },
  partnerize: { orderId: 'conversion_id', commission: 'commission', sale: 'value', subId: 'pubref' },
  direct: { orderId: 'orderId', commission: 'commissionCents', sale: 'amountCents', subId: 'subid' },
};

/** Normalize a raw network postback payload. Tolerant: never throws. */
export function parsePostback(network: AffiliateNetworkId, payload: Record<string, unknown>): PostbackEvent {
  const fields = FIELDS[network];
  const cents = network === 'direct' ? asCents : toCents;

  let status: PostbackEvent['status'] = 'pending';
  if (network === 'awin') {
    const s = str(payload['commissionStatus']).toLowerCase();
    status = AWIN_STATUS[s] ?? 'pending';
  }

  const subId = str(payload[fields.subId]);
  const attribution = decodeSubId(subId);

  const event: PostbackEvent = {
    network,
    orderId: str(payload[fields.orderId]),
    saleAmountCents: cents(payload[fields.sale]),
    commissionCents: cents(payload[fields.commission]),
    currency: currencyOf(payload),
    subId,
    status,
    raw: payload,
  };
  if (attribution) event.attribution = attribution;
  return event;
}
