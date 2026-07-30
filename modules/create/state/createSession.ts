import type { CreateMessage, CreateSession } from '../types';
import { createEmptyWebsiteState } from './websiteState';
import { createId } from '../utils/id';

export const CREATE_SESSION_STORAGE_KEY = 'hubly.create.session.v1';

export const GREETING_CONTENT =
  "Hi, I'm Hubly.\n\nTell me what you'd like to build.";

export function createGreetingMessage(now = new Date().toISOString()): CreateMessage {
  return {
    id: createId('msg'),
    role: 'assistant',
    content: GREETING_CONTENT,
    createdAt: now,
    status: 'complete',
  };
}

export function createNewSession(): CreateSession {
  const now = new Date().toISOString();
  return {
    sessionId: createId('cs'),
    createdAt: now,
    updatedAt: now,
    conversation: [createGreetingMessage(now)],
    websiteState: createEmptyWebsiteState(),
    lastResponseId: null,
  };
}

export function touchSession(session: CreateSession): CreateSession {
  return {
    ...session,
    updatedAt: new Date().toISOString(),
  };
}

export function isValidSession(value: unknown): value is CreateSession {
  if (!value || typeof value !== 'object') return false;
  const s = value as CreateSession;
  return (
    typeof s.sessionId === 'string' &&
    typeof s.createdAt === 'string' &&
    typeof s.updatedAt === 'string' &&
    Array.isArray(s.conversation) &&
    typeof s.websiteState === 'object' &&
    s.websiteState !== null
  );
}
