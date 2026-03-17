import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AVAILABILITY_FILE = path.join(__dirname, '..', 'data', 'availability.json');

let availability = {};

/** Load availability from disk */
function loadAvailability() {
  try {
    availability = JSON.parse(fs.readFileSync(AVAILABILITY_FILE, 'utf-8'));
  } catch (err) {
    console.error('⚠️  No availability.json found. Run: npm run generate-slots');
    availability = {};
  }
}

// Load on startup
loadAvailability();

/**
 * Get available slots for a doctor, optionally filtered by date/time preferences.
 *
 * @param {string} doctorId - Doctor ID
 * @param {object} filters - Optional filters
 * @param {string} filters.date - Specific date (YYYY-MM-DD)
 * @param {string} filters.dateFrom - Start date range
 * @param {string} filters.dateTo - End date range
 * @param {string} filters.timePreference - "morning" | "afternoon" | "evening"
 * @param {number} filters.limit - Max slots to return (default 5)
 */
export function getAvailableSlots(doctorId, filters = {}) {
  const doctorSlots = availability[doctorId];
  if (!doctorSlots) return [];

  let slots = doctorSlots.filter(s => s.available);

  // Filter out past slots
  const now = new Date();
  slots = slots.filter(s => new Date(s.datetime) > now);

  // Filter by specific date
  if (filters.date) {
    slots = slots.filter(s => s.date === filters.date);
  }

  // Filter by date range
  if (filters.dateFrom) {
    slots = slots.filter(s => s.date >= filters.dateFrom);
  }
  if (filters.dateTo) {
    slots = slots.filter(s => s.date <= filters.dateTo);
  }

  // Filter by time preference
  if (filters.timePreference) {
    const pref = filters.timePreference.toLowerCase();
    slots = slots.filter(s => {
      const hour = parseInt(s.time.split(':')[0]);
      if (pref === 'morning') return hour >= 8 && hour < 12;
      if (pref === 'afternoon') return hour >= 12 && hour < 16;
      if (pref === 'evening') return hour >= 16 && hour < 18;
      return true;
    });
  }

  // Limit results
  const limit = filters.limit || 5;
  return slots.slice(0, limit);
}

/**
 * Book a slot — marks it as unavailable.
 * Returns the booked slot or null if not found/already booked.
 */
export function bookSlot(doctorId, datetime) {
  const doctorSlots = availability[doctorId];
  if (!doctorSlots) return null;

  // Compare by date + time strings to avoid timezone mismatches.
  // The LLM passes datetime as "2026-03-19T10:00:00" (local, no tz suffix),
  // while slots are stored with UTC datetimes. Comparing epoch values is
  // unreliable across server timezones, so we use the date/time fields directly.
  const dtDate = datetime.substring(0, 10);   // "2026-03-19"
  const dtTime = datetime.substring(11, 16);  // "10:00"
  const slot = doctorSlots.find(s => s.available && s.date === dtDate && s.time === dtTime);
  if (!slot) {
    console.error(`❌ bookSlot: no matching available slot for ${doctorId} at ${datetime} (date=${dtDate}, time=${dtTime})`);
    return null;
  }

  slot.available = false;

  // Persist to disk
  try {
    fs.writeFileSync(AVAILABILITY_FILE, JSON.stringify(availability, null, 2));
  } catch (err) {
    console.error('Failed to save availability:', err.message);
  }

  return { ...slot };
}

/**
 * Cancel a booking — marks the slot as available again.
 */
export function cancelSlot(doctorId, datetime) {
  const doctorSlots = availability[doctorId];
  if (!doctorSlots) return false;

  const dtDate = datetime.substring(0, 10);
  const dtTime = datetime.substring(11, 16);
  const slot = doctorSlots.find(s => !s.available && s.date === dtDate && s.time === dtTime);
  if (!slot) {
    console.error(`❌ cancelSlot: no matching booked slot for ${doctorId} at ${datetime} (date=${dtDate}, time=${dtTime})`);
    return false;
  }

  slot.available = true;

  try {
    fs.writeFileSync(AVAILABILITY_FILE, JSON.stringify(availability, null, 2));
  } catch (err) {
    console.error('Failed to save availability:', err.message);
  }

  return true;
}

/** Reload availability (useful after regenerating slots) */
export function reloadAvailability() {
  loadAvailability();
}
