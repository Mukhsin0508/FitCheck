import { describe, expect, it } from 'vitest';
import { parsePostback } from '../src/postback';

const SUB_ID = 'v1.u1.s1.p1.r1';
const ATTRIBUTION = { userId: 'u1', sessionId: 's1', productId: 'p1', renderId: 'r1' };

describe('parsePostback', () => {
  it('awin: maps fields, normalizes decimal-string amounts, decodes subid', () => {
    const event = parsePostback('awin', {
      transactionId: 'T-100',
      commissionAmount: '12.50',
      saleAmount: '125.00',
      clickRef: SUB_ID,
      commissionStatus: 'approved',
      currency: 'USD',
    });
    expect(event.network).toBe('awin');
    expect(event.orderId).toBe('T-100');
    expect(event.commissionCents).toBe(1250);
    expect(event.saleAmountCents).toBe(12500);
    expect(event.subId).toBe(SUB_ID);
    expect(event.attribution).toEqual(ATTRIBUTION);
    expect(event.status).toBe('confirmed');
  });

  it('awin: maps declined status, defaults unknown to pending', () => {
    expect(parsePostback('awin', { commissionStatus: 'declined' }).status).toBe('declined');
    expect(parsePostback('awin', { commissionStatus: 'weird' }).status).toBe('pending');
  });

  it('rakuten: order_id/commissions/sale_amount/u1 with numeric amounts', () => {
    const event = parsePostback('rakuten', {
      order_id: 'R-9',
      commissions: 3.2,
      sale_amount: 40,
      u1: SUB_ID,
      currency: 'EUR',
    });
    expect(event.orderId).toBe('R-9');
    expect(event.commissionCents).toBe(320);
    expect(event.saleAmountCents).toBe(4000);
    expect(event.currency).toBe('EUR');
    expect(event.attribution).toEqual(ATTRIBUTION);
    expect(event.status).toBe('pending');
  });

  it('cj: orderId/commissionAmount/saleAmount/sid', () => {
    const event = parsePostback('cj', {
      orderId: 'CJ-1',
      commissionAmount: '4.90',
      saleAmount: '49.00',
      sid: SUB_ID,
    });
    expect(event.orderId).toBe('CJ-1');
    expect(event.commissionCents).toBe(490);
    expect(event.saleAmountCents).toBe(4900);
    expect(event.attribution).toEqual(ATTRIBUTION);
  });

  it('partnerize: conversion_id/value/commission/pubref', () => {
    const event = parsePostback('partnerize', {
      conversion_id: 'PZ-1',
      value: '99.99',
      commission: '8.00',
      pubref: SUB_ID,
    });
    expect(event.orderId).toBe('PZ-1');
    expect(event.saleAmountCents).toBe(9999);
    expect(event.commissionCents).toBe(800);
    expect(event.attribution).toEqual(ATTRIBUTION);
  });

  it('direct: amounts already in cents are not rescaled', () => {
    const event = parsePostback('direct', {
      orderId: 'D-1',
      amountCents: 4900,
      commissionCents: 735,
      subid: SUB_ID,
    });
    expect(event.saleAmountCents).toBe(4900);
    expect(event.commissionCents).toBe(735);
    expect(event.attribution).toEqual(ATTRIBUTION);
  });

  it('never throws: missing/garbage fields fall back to defaults', () => {
    const event = parsePostback('awin', { clickRef: 'not-a-subid', saleAmount: 'NaN?!' });
    expect(event.orderId).toBe('');
    expect(event.saleAmountCents).toBe(0);
    expect(event.commissionCents).toBe(0);
    expect(event.currency).toBe('USD');
    expect(event.subId).toBe('not-a-subid');
    expect(event.attribution).toBeUndefined();
    expect(event.status).toBe('pending');

    const empty = parsePostback('rakuten', {});
    expect(empty.subId).toBe('');
    expect(empty.status).toBe('pending');
    expect(empty.raw).toEqual({});
  });
});
