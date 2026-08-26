/**
 * App state. One zustand store, persisted to AsyncStorage.
 * Renders are cached here too — same user + same garment = same render,
 * across app restarts. Re-rendering only happens after an avatar update
 * (avatarVersion is part of the cache key).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CostRecord, TryOnRender } from '@fitcheck/tryon';
import { File } from 'expo-file-system';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { generateId } from '@/lib/ids';

/** Best-effort removal of the avatar portrait file from disk. */
function deletePortraitFile(localUri: string | undefined): void {
  if (!localUri) return;
  try {
    const file = new File(localUri);
    if (file.exists) file.delete();
  } catch {
    // Already gone, or the platform can't touch it — the state reset still wins.
  }
}

export type AvatarStatus = 'none' | 'ready';

export interface AvatarState {
  status: AvatarStatus;
  /** Display name for the avatar ("Amara" in demo mode). */
  name?: string;
  /** Bundled demo portrait key ('avatar') or undefined when using own photos. */
  imageKey?: string;
  /** Local uri of the user's own portrait selfie, when they onboarded with photos. */
  localUri?: string;
  /** How many selfies were captured at onboarding. */
  selfieCount?: number;
  /** Higgsfield Soul id once a real avatar exists. */
  soulId?: string;
  /** Bumped on re-onboarding; invalidates the render cache. */
  version: number;
}

export interface ClosetItem {
  renderId: string;
  productId?: string;
  /** `asset://<key>` or a URI. */
  imageRef: string;
  title: string;
  brand?: string;
  productUrl?: string;
  provider: string;
  costUsd: number;
  createdAt: string;
}

interface FitCheckState {
  userId: string;
  /** New per app launch (not persisted) — doubles as the affiliate session subid. */
  sessionId: string;
  avatar: AvatarState;
  closet: ClosetItem[];
  /** Render cache: cache key → finished render. */
  renders: Record<string, TryOnRender>;
  costLog: CostRecord[];

  completeAvatar: (avatar: Omit<AvatarState, 'status' | 'version'>) => void;
  resetAvatar: () => void;
  /** "Delete everything on this phone": files, persisted state, and identity. */
  purgeEverything: () => void;
  addToCloset: (item: ClosetItem) => void;
  removeFromCloset: (renderId: string) => void;
  cacheRender: (key: string, render: TryOnRender) => void;
  logCost: (record: CostRecord) => void;
}

export const useStore = create<FitCheckState>()(
  persist(
    (set, get) => ({
      userId: generateId('user'),
      sessionId: generateId('sess'),
      avatar: { status: 'none', version: 0 },
      closet: [],
      renders: {},
      costLog: [],

      completeAvatar: (avatar) =>
        set((state) => ({
          avatar: { ...avatar, status: 'ready', version: state.avatar.version + 1 },
          // New avatar → old renders no longer look like you.
          renders: {},
        })),

      // Privacy path: drops the portrait file, selfie refs, renders, and closet.
      resetAvatar: () => {
        deletePortraitFile(get().avatar.localUri);
        set((state) => ({
          avatar: { status: 'none', version: state.avatar.version + 1 },
          renders: {},
          closet: [],
        }));
      },

      // Deletes the portrait file, purges the persisted store, and starts over
      // as a brand-new identity — nothing survives, on disk or in AsyncStorage.
      purgeEverything: () => {
        deletePortraitFile(get().avatar.localUri);
        useStore.persist.clearStorage();
        set({
          userId: generateId('user'),
          sessionId: generateId('sess'),
          avatar: { status: 'none', version: 0 },
          closet: [],
          renders: {},
          costLog: [],
        });
      },

      addToCloset: (item) =>
        set((state) => ({
          closet: [item, ...state.closet.filter((c) => c.renderId !== item.renderId)],
        })),

      removeFromCloset: (renderId) =>
        set((state) => ({ closet: state.closet.filter((c) => c.renderId !== renderId) })),

      cacheRender: (key, render) =>
        set((state) => ({ renders: { ...state.renders, [key]: render } })),

      logCost: (record) => set((state) => ({ costLog: [record, ...state.costLog].slice(0, 500) })),
    }),
    {
      name: 'fitcheck-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        userId: state.userId,
        avatar: state.avatar,
        closet: state.closet,
        renders: state.renders,
        costLog: state.costLog,
      }),
    },
  ),
);

/** Total estimated spend this device has caused, for the profile screen. */
export function selectTotalSpendUsd(state: FitCheckState): number {
  return state.costLog.reduce((sum, record) => sum + record.costUsd, 0);
}

export function selectRenderCount(state: FitCheckState): number {
  return state.costLog.filter((record) => !record.cached).length;
}
