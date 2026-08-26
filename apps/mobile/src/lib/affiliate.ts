/**
 * Buy flow: open the merchant page through the right affiliate network with a
 * subid that ties the (future) commission back to this user, session, and the
 * render that sold it.
 */

import { buildAffiliateUrl, getProgram, type ClickAttribution, type Product } from '@fitcheck/affiliates';
import * as WebBrowser from 'expo-web-browser';

import { useStore } from '@/state/store';

export function attributionFor(productId: string, renderId?: string): ClickAttribution {
  const { userId, sessionId } = useStore.getState();
  return { userId, sessionId, productId, renderId };
}

/** Returns the deep link it opened (for logging/tests). */
export async function openBuyLink(product: Product, renderId?: string): Promise<string> {
  const program = getProgram(product.programId);
  const url = buildAffiliateUrl(product, program, attributionFor(product.id, renderId));
  await WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    dismissButtonStyle: 'close',
  });
  return url;
}
