/**
 * Onboarding scratch state. Selfie uris captured on the selfies screen live
 * here until the build screen consumes them. Module scope on purpose: the
 * draft never needs to survive a reload, and keeping it out of the persisted
 * store means an abandoned onboarding run leaves nothing behind.
 */

export const draft = {
  uris: [] as string[],
  reset() {
    this.uris = [];
  },
};
