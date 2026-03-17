import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSIONS_FILE = path.join(__dirname, '..', 'data', 'sessions.json');

/**
 * In-memory session store with JSON file backup.
 * Each session tracks: messages, patient info, matched doctor, booking, state.
 */
class SessionStore {
  constructor() {
    this.sessions = new Map();
    this.phoneMap = new Map();   // phoneNumber → sessionId (for callback memory)
    this._loadFromDisk();
  }

  /** Get or create a session */
  get(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        id: sessionId,
        state: 'greeting',       // greeting | intake | triage | scheduling | confirming | complete
        messages: [],
        patient: {},
        matchedDoctor: null,
        booking: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    return this.sessions.get(sessionId);
  }

  /** Add a message to the session */
  addMessage(sessionId, role, content) {
    const session = this.get(sessionId);
    session.messages.push({ role, content, timestamp: new Date().toISOString() });
    session.updatedAt = new Date().toISOString();
    this._saveToDisk();
    return session;
  }

  /** Update patient info (partial merge) */
  updatePatient(sessionId, data) {
    const session = this.get(sessionId);
    session.patient = { ...session.patient, ...data };
    session.updatedAt = new Date().toISOString();
    this._saveToDisk();
    return session;
  }

  /** Set the matched doctor */
  setMatchedDoctor(sessionId, doctor) {
    const session = this.get(sessionId);
    session.matchedDoctor = doctor;
    session.updatedAt = new Date().toISOString();
    this._saveToDisk();
    return session;
  }

  /** Set booking details */
  setBooking(sessionId, booking) {
    const session = this.get(sessionId);
    session.booking = booking;
    session.updatedAt = new Date().toISOString();
    this._saveToDisk();
    return session;
  }

  /** Update session state */
  setState(sessionId, state) {
    const session = this.get(sessionId);
    session.state = state;
    session.updatedAt = new Date().toISOString();
    this._saveToDisk();
    return session;
  }

  /** Map a phone number to a session (for callback memory) */
  mapPhone(phoneNumber, sessionId) {
    this.phoneMap.set(phoneNumber, sessionId);
  }

  /** Look up session by phone number */
  getByPhone(phoneNumber) {
    const sessionId = this.phoneMap.get(phoneNumber);
    return sessionId ? this.get(sessionId) : null;
  }

  /** Get all sessions (for admin panel) */
  getAll() {
    return Array.from(this.sessions.values());
  }

  /** Get all bookings (for admin panel) */
  getAllBookings() {
    return this.getAll()
      .filter(s => s.booking)
      .map(s => ({
        sessionId: s.id,
        patient: s.patient,
        doctor: s.matchedDoctor,
        booking: s.booking,
        symptomAssessment: s.symptomAssessment || null,
        createdAt: s.createdAt,
      }));
  }

  // --- Persistence ---

  _saveToDisk() {
    try {
      const data = {
        sessions: Object.fromEntries(this.sessions),
        phoneMap: Object.fromEntries(this.phoneMap),
      };
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('Failed to save sessions:', err.message);
    }
  }

  _loadFromDisk() {
    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        const raw = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
        if (raw.sessions) {
          for (const [k, v] of Object.entries(raw.sessions)) {
            this.sessions.set(k, v);
          }
        }
        if (raw.phoneMap) {
          for (const [k, v] of Object.entries(raw.phoneMap)) {
            this.phoneMap.set(k, v);
          }
        }
        console.log(`📂 Loaded ${this.sessions.size} sessions from disk`);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err.message);
    }
  }
}

// Singleton
export const sessionStore = new SessionStore();
