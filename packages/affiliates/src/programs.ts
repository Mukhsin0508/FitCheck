import type { AffiliateProgram } from './schema';

/**
 * Seed program registry. Publisher/advertiser ids are placeholders — swap in
 * real ids from env config (e.g. AWIN_PUBLISHER_ID) once network accounts are
 * approved. All seeds are 30-day-cookie programs by policy.
 */
export const AFFILIATE_PROGRAMS: Record<string, AffiliateProgram> = {
  shein: {
    id: 'shein',
    merchantName: 'SHEIN',
    network: 'awin',
    commissionPctRange: [10, 20],
    cookieWindowDays: 30,
    advertiserId: '30327',
    publisherId: 'FITCHECK_AWIN_ID',
  },
  hm: {
    id: 'hm',
    merchantName: 'H&M',
    network: 'awin',
    commissionPctRange: [7, 10],
    cookieWindowDays: 30,
    advertiserId: '20033',
    publisherId: 'FITCHECK_AWIN_ID',
  },
  farfetch: {
    id: 'farfetch',
    merchantName: 'Farfetch',
    network: 'partnerize',
    commissionPctRange: [7, 10],
    cookieWindowDays: 30,
    campaignRef: 'FITCHECK_CAMREF',
  },
  asos: {
    id: 'asos',
    merchantName: 'ASOS',
    network: 'awin',
    commissionPctRange: [6, 7],
    cookieWindowDays: 30,
    advertiserId: '3196',
    publisherId: 'FITCHECK_AWIN_ID',
  },
  mango: {
    id: 'mango',
    merchantName: 'Mango',
    network: 'rakuten',
    commissionPctRange: [8, 12],
    cookieWindowDays: 30,
    advertiserId: '38227',
    publisherId: 'FITCHECK_RAKUTEN_ID',
  },
  reformation: {
    id: 'reformation',
    merchantName: 'Reformation',
    network: 'cj',
    commissionPctRange: [10, 14],
    cookieWindowDays: 30,
    advertiserId: '5247006',
    publisherId: 'FITCHECK_CJ_PID',
  },
};

export function getProgram(id: string): AffiliateProgram {
  const program = AFFILIATE_PROGRAMS[id];
  if (!program) throw new Error(`Unknown affiliate program: '${id}'`);
  return program;
}
