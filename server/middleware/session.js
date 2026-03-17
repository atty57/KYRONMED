import { v4 as uuidv4 } from 'uuid';
import { sessionStore } from '../services/sessionStore.js';

/**
 * Session middleware — phone-number-based session mapping.
 *
 * Reads X-Session-Id header (format: phone-XXXXXXXXXX) to resolve
 * the session. Falls back to a new UUID for unauthenticated requests.
 */
export function sessionMiddleware(req, _res, next) {
  // VAPI webhook is server-to-server — exempt
  if (req.path === '/api/vapi/webhook') return next();

  req.sessionId = req.headers['x-session-id'] || uuidv4();

  const phoneMatch = req.sessionId.match(/^phone-(\d{10,})$/);
  if (phoneMatch) {
    sessionStore.mapPhone(phoneMatch[1], req.sessionId);
  }

  next();
}
