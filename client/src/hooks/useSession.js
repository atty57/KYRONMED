import { useState, useCallback } from 'react';
import { getSessionId, resetSession } from '../lib/api.js';

export function useSession() {
  const [sessionId, setSessionId] = useState(getSessionId());

  const reset = useCallback(() => {
    const newId = resetSession();
    setSessionId(newId);
    return newId;
  }, []);

  return { sessionId, reset };
}
