/**
 * Generate realistic availability slots for the next 60 days for all doctors.
 * Run: node data/generateSlots.js
 *
 * Outputs availability.json — each doctor gets slots on their work days,
 * with some randomly removed to feel realistic.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const doctors = JSON.parse(fs.readFileSync(path.join(__dirname, 'doctors.json'), 'utf-8'));

/**
 * Build a slot record for a given day + wall-clock time.
 *
 * All three fields (datetime/date/time) are derived from the SAME local
 * wall-clock basis so they are always internally consistent. The rest of the
 * app treats these as naive local time: the UI parses `date + 'T00:00:00'`,
 * bookSlot matches on the `date`/`time` strings, and slotManager parses
 * `datetime` with `new Date()` (local). Emitting a UTC `toISOString()` here
 * (the old behavior) made `date`/`datetime` disagree with `time` in any
 * non-UTC timezone — e.g. in Sydney a 9am slot was stored on the previous
 * calendar day — which broke date filtering and booking matches.
 *
 * @param {Date} dayDate - a Date at local midnight of the target day
 * @param {number} hour   - local hour (0-23)
 * @param {number} min    - local minute
 */
export function makeSlot(dayDate, hour, min) {
  const y = dayDate.getFullYear();
  const mo = String(dayDate.getMonth() + 1).padStart(2, '0');
  const d = String(dayDate.getDate()).padStart(2, '0');
  const date = `${y}-${mo}-${d}`;
  const time = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  return {
    datetime: `${date}T${time}:00`,  // naive local, no tz suffix
    date,
    time,
    available: true,
  };
}

export function generateSlots() {
  const availability = {};
  const now = new Date();
  // Start from tomorrow
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() + 1);
  startDate.setHours(0, 0, 0, 0);

  for (const doctor of doctors) {
    const slots = [];

    for (let dayOffset = 0; dayOffset < 60; dayOffset++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + dayOffset);

      const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ...
      if (!doctor.workDays.includes(dayOfWeek)) continue;

      // Generate time slots for this day
      const { start, end } = doctor.workHours;
      const duration = doctor.slotDurationMinutes;

      for (let hour = start; hour < end; hour++) {
        for (let min = 0; min < 60; min += duration) {
          if (hour === end - 1 && min + duration > 60) break;

          // Skip lunch hour (12:00 - 13:00)
          if (hour === 12) continue;

          // Randomly remove ~25% of slots to feel realistic
          if (Math.random() < 0.25) continue;

          slots.push(makeSlot(date, hour, min));
        }
      }
    }

    availability[doctor.id] = slots;
  }

  const outPath = path.join(__dirname, 'availability.json');
  fs.writeFileSync(outPath, JSON.stringify(availability, null, 2));
  console.log(`✅ Generated slots for ${doctors.length} doctors → ${outPath}`);
  console.log(`   Total slots: ${Object.values(availability).reduce((sum, s) => sum + s.length, 0)}`);
}

// Run only when invoked directly (e.g. `npm run generate-slots`),
// so the helpers above can be imported by tests without writing files.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  generateSlots();
}
