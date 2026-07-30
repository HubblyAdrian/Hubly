import { useEffect, useState } from 'react';
import type { CreateEngineListener, CreateSession } from '../types';
import { CreateEngine, getCreateEngine } from '../services/createEngine';

/** Optional hook for future Create surfaces — CreatePage can also subscribe directly. */
export function useCreateSession(engine: CreateEngine = getCreateEngine()): {
  session: CreateSession;
  streaming: boolean;
} {
  const [session, setSession] = useState(engine.getSession());
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    const listener: CreateEngineListener = (event) => {
      if (event.type === 'session') setSession(event.session);
      if (event.type === 'streaming') setStreaming(event.active);
    };
    return engine.subscribe(listener);
  }, [engine]);

  return { session, streaming };
}
