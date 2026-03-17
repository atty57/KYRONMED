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

function generateSlots() {
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

          const slotDate = new Date(date);
          slotDate.setHours(hour, min, 0, 0);

          slots.push({
            datetime: slotDate.toISOString(),
            date: slotDate.toISOString().split('T')[0],
            time: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
            available: true,
          });
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

generateSlots();
