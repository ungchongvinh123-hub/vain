'use client';
import { isOfflineBuild, localApi } from './localApi';

const OFFLINE = isOfflineBuild();

/**
 * fetch() that transparently falls back to the IndexedDB-backed local API:
 * - always local in the offline/APK build (NEXT_PUBLIC_OFFLINE=1);
 * - local when the network request itself throws (PWA with no server).
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  if (OFFLINE || typeof window === 'undefined') return localApi(input, init);
  try {
    return await fetch(input, init);
  } catch {
    (window as unknown as { __VAIN_OFFLINE__?: boolean }).__VAIN_OFFLINE__ = true;
    return localApi(input, init);
  }
}
