import { Router } from 'express';
import { sessionStore } from '../services/sessionStore.js';
import { cancelSlot } from '../services/slotManager.js';

const router = Router();

const ADMIN_PASSWORD = 'kyronmed2026';

/**
 * POST /api/admin/login
 * Validates admin password. No token — just a gate.
 */
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Invalid password' });
});

// Protect all routes below
function requireAdmin(req, res, next) {
  if (req.headers['x-admin-key'] === ADMIN_PASSWORD) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}
router.use(requireAdmin);

/**
 * GET /api/admin/appointments
 * Returns all bookings (for the admin panel).
 */
router.get('/appointments', (_req, res) => {
  const bookings = sessionStore.getAllBookings();
  res.json(bookings);
});

/**
 * GET /api/admin/sessions
 * Returns all sessions (for debugging).
 */
router.get('/sessions', (_req, res) => {
  const sessions = sessionStore.getAll();
  res.json(sessions.map(s => ({
    id: s.id,
    state: s.state,
    patient: s.patient,
    matchedDoctor: s.matchedDoctor,
    booking: s.booking,
    messageCount: s.messages.length,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  })));
});

/**
 * DELETE /api/admin/appointments/:sessionId
 * Cancels a confirmed appointment and frees the slot.
 */
router.delete('/appointments/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessionStore.getAll().find(s => s.id === sessionId);

  if (!session || !session.booking || session.booking.status !== 'confirmed') {
    return res.status(400).json({ error: 'No confirmed appointment found.' });
  }

  cancelSlot(session.booking.doctorId, session.booking.datetime);

  // Inject a cancellation notice into the conversation so the LLM sees it in chat history
  const doctorName = session.matchedDoctor?.name || 'your doctor';
  const apptDate = session.booking.date;
  const apptTime = session.booking.time;
  sessionStore.addMessage(sessionId, 'assistant',
    `I wanted to let you know that your appointment with ${doctorName} on ${apptDate} at ${apptTime} has been cancelled by our office. I apologize for any inconvenience. Would you like me to help you rebook at a different time?`
  );

  session.booking.status = 'cancelled';
  session.booking.cancelledAt = new Date().toISOString();
  // Reset session state so the patient can rebook
  sessionStore.setState(sessionId, 'scheduling');
  sessionStore._saveToDisk();

  res.json({ success: true });
});

export default router;
