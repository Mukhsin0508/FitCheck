/**
 * Browse-area formatting helpers: money and merchant display names.
 */

/** Program ids whose display name isn't a plain capitalization. */
const MERCHANT_NAMES: Record<string, string> = {
  shein: 'SHEIN',
  hm: 'H&M',
  asos: 'ASOS',
};

/** 'shein' → 'SHEIN', 'mango' → 'Mango'. Derived from the product row only. */
export function merchantName(programId: string): string {
  return MERCHANT_NAMES[programId] ?? programId.charAt(0).toUpperCase() + programId.slice(1);
}

export function formatPrice(priceCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(priceCents / 100);
  } catch {
    return `$${(priceCents / 100).toFixed(2)}`;
  }
}
