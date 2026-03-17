import { API_BASE } from './constants.js';

// ─── Session ──────────────────────────────────────────────────────
let sessionId = localStorage.getItem('kyronmed-session') || null;

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (sessionId) headers['X-Session-Id'] = sessionId;
  return headers;
}

/** Set session ID from phone number (normalized) */
export function setSessionFromPhone(phone) {
  const normalized = phone.replace(/\D/g, '');
  sessionId = `phone-${normalized}`;
  localStorage.setItem('kyronmed-session', sessionId);
  localStorage.setItem('kyronmed-phone', phone);
  return sessionId;
}

export function getSessionId() { return sessionId; }
export function getStoredPhone() { return localStorage.getItem('kyronmed-phone') || ''; }
export function hasSession() { return !!sessionId; }

export function resetSession() {
  sessionId = null;
  localStorage.removeItem('kyronmed-session');
  localStorage.removeItem('kyronmed-phone');
  localStorage.removeItem('kyronmed-firstName');
}

/**
 * Send a chat message and receive SSE stream.
 * Returns an async generator of chunks.
 */
export async function* sendMessage(message) {
  if (!sessionId) throw new Error('Please complete the intake form first');

  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error(`Chat request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') return;
        try {
          yield JSON.parse(data);
        } catch {
          // Skip malformed chunks
        }
      }
    }
  }
}

/**
 * Register patient info on the server (called after intake form).
 */
export async function registerPatient(patientData) {
  const res = await fetch(`${API_BASE}/api/chat/register`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(patientData),
  });
  return res.json();
}

export async function requestPhoneCall() {
  const res = await fetch(`${API_BASE}/api/vapi/call-me`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function getVapiContext() {
  const res = await fetch(`${API_BASE}/api/vapi/context/${sessionId}`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return res.json();
}

/**
 * Get all doctors.
 */
export async function getDoctors() {
  const res = await fetch(`${API_BASE}/api/booking/doctors`);
  return res.json();
}

/**
 * Get slots for a doctor.
 */
export async function getSlots(doctorId, filters = {}) {
  const params = new URLSearchParams(filters);
  const res = await fetch(`${API_BASE}/api/booking/slots/${doctorId}?${params}`);
  return res.json();
}

/**
 * Fetch stored chat history and session state for the current session.
 */
export async function fetchChatHistory(sid) {
  const res = await fetch(`${API_BASE}/api/chat/session/${sid}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return null;
  return res.json();
}
