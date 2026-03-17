import { Router } from 'express';
import { getAvailableSlots, bookSlot, cancelSlot } from '../services/slotManager.js';
import { getAllDoctors, getDoctorById } from '../services/doctorMatcher.js';

const router = Router();

/**
 * GET /api/booking/doctors
 * List all doctors.
 */
router.get('/doctors', (_req, res) => {
  res.json(getAllDoctors());
});

/**
 * GET /api/booking/slots/:doctorId
 * Query: ?date=YYYY-MM-DD&timePreference=morning|afternoon|evening&limit=10
 */
router.get('/slots/:doctorId', (req, res) => {
  const { doctorId } = req.params;
  const { date, dateFrom, dateTo, timePreference, limit } = req.query;

  const doctor = getDoctorById(doctorId);
  if (!doctor) {
    return res.status(404).json({ error: 'Doctor not found' });
  }

  const slots = getAvailableSlots(doctorId, {
    date,
    dateFrom,
    dateTo,
    timePreference,
    limit: parseInt(limit) || 10,
  });

  res.json({ doctor, slots });
});

/**
 * POST /api/booking/book
 * Body: { doctorId, datetime }
 */
router.post('/book', (req, res) => {
  const { doctorId, datetime } = req.body;

  if (!doctorId || !datetime) {
    return res.status(400).json({ error: 'doctorId and datetime are required' });
  }

  const booked = bookSlot(doctorId, datetime);
  if (!booked) {
    return res.status(409).json({ error: 'Slot is no longer available' });
  }

  res.json({ success: true, booking: booked });
});

/**
 * POST /api/booking/cancel
 * Body: { doctorId, datetime }
 */
router.post('/cancel', (req, res) => {
  const { doctorId, datetime } = req.body;
  const cancelled = cancelSlot(doctorId, datetime);

  if (!cancelled) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  res.json({ success: true });
});

export default router;
