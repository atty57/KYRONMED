/**
 * Self-check for slot record consistency.
 * Run: node data/generateSlots.test.mjs   (optionally under TZ=...)
 *
 * Verifies the fix for the UTC/local timezone bug: a slot's datetime/date/time
 * fields must all describe the SAME local wall-clock moment, regardless of the
 * server timezone. The old toISOString()-based code failed this in every
 * non-UTC zone.
 */
import assert from 'assert';
import { makeSlot } from './generateSlots.js';

// A 9:00 AM slot on 2026-03-19 (local midnight + 9h).
const day = new Date(2026, 2, 19);
const slot = makeSlot(day, 9, 0);

assert.strictEqual(slot.date, '2026-03-19', `date wrong in TZ=${process.env.TZ}: ${slot.date}`);
assert.strictEqual(slot.time, '09:00', `time wrong in TZ=${process.env.TZ}: ${slot.time}`);

// bookSlot matches on datetime.substring(0,10) / substring(11,16) === date/time.
assert.strictEqual(slot.datetime.substring(0, 10), slot.date, 'datetime date half must match date field');
assert.strictEqual(slot.datetime.substring(11, 16), slot.time, 'datetime time half must match time field');

// A late-afternoon slot must not spill onto an adjacent calendar day.
const evening = makeSlot(new Date(2026, 2, 19), 16, 30);
assert.strictEqual(evening.date, '2026-03-19');
assert.strictEqual(evening.datetime, '2026-03-19T16:30:00');

console.log(`✅ slot consistency OK (TZ=${process.env.TZ || 'system'})`);
