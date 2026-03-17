import { Router } from 'express';
import { processChat } from '../services/chatEngine.js';
import { sessionStore } from '../services/sessionStore.js';

const router = Router();

/**
 * POST /api/chat
 * Body: { message: string }
 * Headers: x-session-id (optional)
 *
 * Returns SSE stream of assistant response chunks.
 */
router.post('/', async (req, res) => {
  const { message } = req.body;
  const sessionId = req.sessionId;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Session-Id', sessionId);

  try {
    for await (const chunk of processChat(sessionId, message)) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
  } catch (err) {
    console.error('Chat error:', err);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Something went wrong. Please try again.' })}\n\n`);
  }

  res.write('data: [DONE]\n\n');
  res.end();
});

/**
 * POST /api/chat/register
 * Pre-register patient info from the intake form.
 * This saves info to the session BEFORE the first chat message,
 * so Kyra already knows the patient's name, DOB, email, etc.
 */
router.post('/register', (req, res) => {
  const sessionId = req.sessionId;
  const { firstName, lastName, name, dob, phone, email } = req.body;

  const session = sessionStore.get(sessionId);
  sessionStore.updatePatient(sessionId, {
    ...(firstName && { firstName }),
    ...(lastName && { lastName }),
    ...(name && { name }),
    ...(dob && { dob }),
    ...(phone && { phone }),
    ...(email && { email }),
  });
  sessionStore.setState(sessionId, 'intake_complete');

  console.log(`📋 Patient registered: ${firstName} ${lastName} → session ${sessionId}`);
  res.json({ success: true, sessionId, patient: session.patient });
});

/**
 * GET /api/chat/session/:id
 * Get session state (for debugging / admin).
 */
router.get('/session/:id', (req, res) => {
  const session = sessionStore.get(req.params.id);
  res.json(session);
});

export default router;
