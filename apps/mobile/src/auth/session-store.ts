import * as SecureStore from 'expo-secure-store';
import type { Session } from '@/api/types';

const KEY = 'cargogo.session.v1';
export async function saveSession(session: Session) { await SecureStore.setItemAsync(KEY, JSON.stringify(session), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); }
export async function loadSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as Session; } catch { await SecureStore.deleteItemAsync(KEY); return null; }
}
export async function clearSession() { await SecureStore.deleteItemAsync(KEY); }
