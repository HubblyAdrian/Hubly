import type { CreateSession } from '../types';
import {
  CREATE_SESSION_STORAGE_KEY,
  createNewSession,
  isValidSession,
} from '../state/createSession';

export function loadSession(): CreateSession {
  try {
    const raw = localStorage.getItem(CREATE_SESSION_STORAGE_KEY);
    if (!raw) return createNewSession();
    const parsed: unknown = JSON.parse(raw);
    if (isValidSession(parsed)) return parsed;
  } catch {
    /* corrupt storage — start fresh */
  }
  return createNewSession();
}

export function saveSession(session: CreateSession): void {
  try {
    localStorage.setItem(CREATE_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* quota / private mode — conversation still works in-memory */
  }
}

export function clearSessionStorage(): void {
  try {
    localStorage.removeItem(CREATE_SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
