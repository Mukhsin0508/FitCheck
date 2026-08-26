import { useEffect, useState } from 'react';

import { useStore } from '@/state/store';

/** True once the persisted store has loaded from AsyncStorage. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useStore.persist.hasHydrated());

  useEffect(() => {
    const unsubscribe = useStore.persist.onFinishHydration(() => setHydrated(true));
    if (useStore.persist.hasHydrated()) setHydrated(true);
    return unsubscribe;
  }, []);

  return hydrated;
}
