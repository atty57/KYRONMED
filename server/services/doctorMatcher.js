import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const doctors = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'doctors.json'), 'utf-8'));

// ─── Synonym map: maps common patient words → canonical keywords ──
const SYNONYMS = {
  ache: 'pain', aching: 'pain', hurting: 'pain', sore: 'pain', painful: 'pain', hurts: 'pain', throbbing: 'pain',
  pimple: 'acne', pimples: 'acne', zit: 'acne', zits: 'acne', breakout: 'acne', blemish: 'acne',
  tummy: 'stomach', belly: 'stomach', abdomen: 'stomach', abdominal: 'stomach',
  breathless: 'shortness of breath', 'can\'t breathe': 'shortness of breath', 'hard to breathe': 'shortness of breath',
  'racing heart': 'palpitations', 'heart racing': 'palpitations', 'heart pounding': 'palpitations', 'heart fluttering': 'palpitations',
  'pins and needles': 'numbness', tingling: 'numbness',
  scratch: 'rash', blotch: 'rash', blotchy: 'rash', redness: 'rash', irritation: 'rash',
  lump: 'swelling', swollen: 'swelling', inflamed: 'swelling', inflammation: 'swelling',
  kid: 'child', kids: 'child', son: 'child', daughter: 'child', 'my child': 'child', boy: 'child', girl: 'child',
  exhausted: 'fatigue', exhaustion: 'fatigue', 'no energy': 'fatigue', 'always tired': 'fatigue', lethargic: 'fatigue',
  migraine: 'headache', 'head hurts': 'headache', 'head pain': 'headache',
  throwing: 'nausea', vomiting: 'nausea', 'feeling sick': 'nausea', queasy: 'nausea',
  'high blood pressure': 'hypertension', 'low blood pressure': 'blood pressure',
  itchy: 'itching', itch: 'itching',
  coughing: 'cough', stuffy: 'cold', runny: 'cold', congestion: 'cold', sneezing: 'cold',
  stiff: 'stiffness', tight: 'stiffness', tightness: 'stiffness',
  spasm: 'muscle', cramp: 'muscle', strain: 'muscle',
  bruise: 'swelling', bruised: 'swelling',
  dizzy: 'dizziness', lightheaded: 'dizziness', vertigo: 'dizziness', 'light headed': 'dizziness',
  shot: 'vaccination', shots: 'vaccination', vaccine: 'vaccination', vaccines: 'vaccination', immunize: 'immunization',
  checkup: 'general', 'check up': 'general', 'regular visit': 'general', 'routine visit': 'general', physical: 'general',
};

/**
 * Expand input text with synonyms so keyword matching can find more hits.
 */
function expandWithSynonyms(text) {
  let expanded = text;
  for (const [variant, canonical] of Object.entries(SYNONYMS)) {
    if (text.includes(variant) && !text.includes(canonical)) {
      expanded += ` ${canonical}`;
    }
  }
  return expanded;
}

// Family Medicine doctor ID — used as fallthrough when no specialist matches
const FAMILY_MEDICINE_ID = doctors.find(d => d.specialty === 'Family Medicine')?.id || doctors[0]?.id;

/**
 * Select a doctor by ID — the primary path.
 * The LLM picks the best doctor using clinical reasoning, then calls this
 * to register the choice in session state. Returns the doctor info.
 */
export function selectDoctor(doctorId) {
  const doc = doctors.find(d => d.id === doctorId);
  if (!doc) return { error: `Unknown doctor ID: "${doctorId}". Valid IDs: ${doctors.map(d => d.id).join(', ')}` };
  return {
    doctor: { id: doc.id, name: doc.name, specialty: doc.specialty, title: doc.title, bio: doc.bio },
    confidence: 1.0,
  };
}

/**
 * Keyword-based fallback matcher with synonym expansion.
 * Used when the LLM provides a reason string instead of a doctor_id.
 * Returns { doctor, confidence, matchedKeywords, ambiguous?, topTwo? } or falls through to Family Medicine.
 */
export function matchDoctor(reason) {
  if (!reason || typeof reason !== 'string') return null;

  const normalized = reason.toLowerCase().trim();
  const expanded = expandWithSynonyms(normalized);
  const scores = [];

  for (const doctor of doctors) {
    let score = 0;
    const matchedKeywords = [];

    for (const keyword of doctor.keywords) {
      const kw = keyword.toLowerCase();
      if (expanded.includes(kw)) {
        // Multi-word keywords are more specific → bonus
        const wordCount = kw.split(' ').length;
        score += wordCount * 2;
        matchedKeywords.push(keyword);
      }
    }

    scores.push({
      doctor: { id: doctor.id, name: doctor.name, specialty: doctor.specialty, title: doctor.title, bio: doctor.bio },
      score,
      matchedKeywords,
    });
  }

  scores.sort((a, b) => b.score - a.score);

  const top = scores[0];
  const runnerUp = scores[1];

  // No keyword hits at all → fall through to Family Medicine
  if (top.score === 0) {
    const fm = doctors.find(d => d.id === FAMILY_MEDICINE_ID);
    return {
      doctor: { id: fm.id, name: fm.name, specialty: fm.specialty, title: fm.title, bio: fm.bio },
      confidence: 0.3,
      matchedKeywords: [],
      fallthrough: true,
      note: 'No specialist keywords matched. Routing to Family Medicine as the general provider. If this doesn\'t seem right, ask the patient for more details.',
    };
  }

  // Ambiguity check — if top two are close, flag it
  const gap = runnerUp ? (top.score - runnerUp.score) / top.score : 1;
  const confidence = Math.min(0.95, gap * 0.6 + (top.score >= 6 ? 0.3 : 0.1));

  if (gap < 0.25 && runnerUp.score > 0) {
    return {
      doctor: top.doctor,
      confidence: Math.round(confidence * 100) / 100,
      matchedKeywords: top.matchedKeywords,
      ambiguous: true,
      topTwo: [
        { name: top.doctor.name, specialty: top.doctor.specialty, score: top.score },
        { name: runnerUp.doctor.name, specialty: runnerUp.doctor.specialty, score: runnerUp.score },
      ],
      note: `Close match between ${top.doctor.specialty} and ${runnerUp.doctor.specialty}. Consider asking the patient a clarifying question before confirming.`,
    };
  }

  return {
    doctor: top.doctor,
    confidence: Math.round(confidence * 100) / 100,
    matchedKeywords: top.matchedKeywords,
  };
}

/** Get all doctors (for system prompt context) */
export function getAllDoctors() {
  return doctors.map(d => ({
    id: d.id,
    name: d.name,
    specialty: d.specialty,
    title: d.title,
    bio: d.bio,
    keywords: d.keywords,
  }));
}

/** Get a single doctor by ID */
export function getDoctorById(doctorId) {
  const doc = doctors.find(d => d.id === doctorId);
  if (!doc) return null;
  return {
    id: doc.id,
    name: doc.name,
    specialty: doc.specialty,
    title: doc.title,
    bio: doc.bio,
  };
}
