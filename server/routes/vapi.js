import { Router } from 'express';
import { sessionStore } from '../services/sessionStore.js';
import { buildSystemPrompt, buildVoiceContext } from '../prompts/system.js';
import { getAllDoctors } from '../services/doctorMatcher.js';
import { getAvailableSlots, bookSlot, cancelSlot } from '../services/slotManager.js';
import { matchDoctor } from '../services/doctorMatcher.js';

const router = Router();

/**
 * Builds the Vapi function-tool definitions pointing to our webhook.
 * Only included when VAPI_SERVER_URL is set (required for Vapi to call back).
 */
function buildVoiceTools(serverUrl) {
  const webhookUrl = `${serverUrl}/api/vapi/webhook`;
  return [
    {
      type: 'function',
      async: false,
      function: {
        name: 'match_doctor',
        description: 'Match patient symptoms/reason to the best specialist.',
        parameters: { type: 'object', properties: { reason: { type: 'string' } }, required: ['reason'] },
      },
      server: { url: webhookUrl },
    },
    {
      type: 'function',
      async: false,
      function: {
        name: 'get_available_slots',
        description: 'Get available appointment slots for a doctor.',
        parameters: {
          type: 'object',
          properties: {
            doctor_id: { type: 'string' },
            date: { type: 'string' },
            time_preference: { type: 'string', enum: ['morning', 'afternoon', 'evening'] },
          },
          required: ['doctor_id'],
        },
      },
      server: { url: webhookUrl },
    },
    {
      type: 'function',
      async: false,
      function: {
        name: 'book_appointment',
        description: 'Book a specific appointment slot after the patient explicitly confirms.',
        parameters: {
          type: 'object',
          properties: {
            doctor_id: { type: 'string' },
            datetime: { type: 'string', description: 'ISO datetime of the slot (YYYY-MM-DDTHH:mm:ss)' },
          },
          required: ['doctor_id', 'datetime'],
        },
      },
      server: { url: webhookUrl },
    },
    {
      type: 'function',
      async: false,
      function: {
        name: 'reschedule_appointment',
        description: 'Reschedule the patient\'s confirmed appointment. Frees the current slot. Call when the patient wants a different time/date — then IMMEDIATELY ask for their new preferred time and search for slots.',
        parameters: {
          type: 'object',
          properties: {
            reason: { type: 'string', description: 'Optional reason for rescheduling' },
          },
        },
      },
      server: { url: webhookUrl },
    },
    {
      type: 'function',
      async: false,
      function: {
        name: 'cancel_appointment',
        description: 'Cancel the patient\'s confirmed appointment and free the slot. Only call after explicit patient confirmation.',
        parameters: {
          type: 'object',
          properties: {
            reason: { type: 'string', description: 'Optional reason for cancellation' },
          },
        },
      },
      server: { url: webhookUrl },
    },
  ];
}

/**
 * POST /api/vapi/context/:sessionId
 * Returns a clean transient assistant config for vapi.start().
 */
router.post('/context/:sessionId', (req, res) => {
  const session = sessionStore.get(req.params.sessionId);
  const voiceContext = buildVoiceContext(session);

  const systemPrompt = buildSystemPrompt({
    doctors: getAllDoctors(),
    patientContext: voiceContext,
    bookingContext: session.booking?.status === 'confirmed' ? session.booking : undefined,
  });

  const voicePrompt = systemPrompt + `

VOICE CALL INSTRUCTIONS:
- You are now on a voice call with the patient. Speak naturally and concisely.
- You have full context from the previous chat conversation above.
- Reference specific details from the chat to show continuity.
  For example: "I see from our chat that you're looking to see Dr. Rodriguez about your knee."
- Keep responses SHORT — 1 to 2 sentences max. This is a phone call, not an essay.
- Spell out dates and times clearly: "Tuesday, March eighteenth at two thirty PM"
- If the patient asks to book or reschedule, guide them step by step.
- Use verbal confirmations: "Got it", "Perfect", "Let me check that for you"
- End the call warmly: "You're all set! Have a great day."
- If there's silence, gently prompt: "Are you still there?" or "Anything else I can help with?"
`;

  const serverUrl = process.env.VAPI_SERVER_URL;
  const voiceTools = serverUrl ? buildVoiceTools(serverUrl).filter(t => {
    if (t.function?.name === 'book_appointment' && session.state === 'complete') return false;
    if ((t.function?.name === 'cancel_appointment' || t.function?.name === 'reschedule_appointment') && session.booking?.status !== 'confirmed') return false;
    return true;
  }) : undefined;

  // Transient assistant config — must match Vapi's Create Assistant schema exactly.
  // Only include fields Vapi accepts for transient assistants.
  const assistantConfig = {
    firstMessage: buildFirstMessage(session),
    firstMessageMode: 'assistant-speaks-first',
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: voicePrompt }],
      temperature: 0.7,
      maxTokens: 250,
      ...(voiceTools && { tools: voiceTools }),
    },
    voice: {
      provider: '11labs',
      voiceId: '21m00Tcm4TlvDq8ikWAM',  // "Rachel" — warm, professional
    },
    transcriber: {
      provider: 'deepgram',
      model: 'nova-2',
      language: 'en-US',
    },
  };

  res.json({
    assistantConfig,
    context: voiceContext,
    patient: session.patient,
    state: session.state,
    sessionId: req.params.sessionId,
  });
});

/**
 * Build a contextual first message for the voice agent.
 */
function buildFirstMessage(session) {
  const name = session.patient?.name?.split(' ')[0];

  if (session.booking) {
    if (session.booking.status === 'cancelled') {
      return name
        ? `Hi ${name}! I see your recent appointment was cancelled. Would you like to schedule a new one?`
        : `Hi there! I see a recent appointment was cancelled. Would you like to book a new one?`;
    }
    if (session.booking.status === 'rescheduled') {
      return name
        ? `Hi ${name}! I see we're in the middle of rescheduling your appointment. What day or time works best for you?`
        : `Hi! It looks like we're rescheduling an appointment. What time works best for you?`;
    }
    return name
      ? `Hi ${name}! I see your appointment is already booked. How can I help you today?`
      : `Hi there! I see you already have an appointment booked. What can I help you with?`;
  }
  if (session.matchedDoctor) {
    return name
      ? `Hi ${name}! I see we were just chatting about seeing ${session.matchedDoctor.name}. Would you like to continue scheduling?`
      : `Hi! I have the context from our chat. Shall we continue where we left off?`;
  }
  if (name) {
    return `Hi ${name}! I'm Kyra from KyronMed. I have our chat pulled up. How can I help you?`;
  }
  return `Hi! I'm Kyra, the scheduling assistant at KyronMed. How can I help you today?`;
}

/**
 * POST /api/vapi/call-me
 * Places an outbound phone call to the patient's registered number,
 * injecting full chat context so the voice AI continues seamlessly.
 *
 * Requires VAPI_PHONE_NUMBER_ID in .env (purchase a number in the Vapi dashboard).
 */
router.post('/call-me', async (req, res) => {
  const sid = req.body.sessionId || req.headers['x-session-id'];

  const session = sessionStore.get(sid);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const rawPhone = session.patient?.phone;
  if (!rawPhone) return res.status(400).json({ error: 'No phone number on file for this session' });

  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID?.trim();
  if (!phoneNumberId) {
    return res.status(503).json({ error: 'Outbound calling not configured — set VAPI_PHONE_NUMBER_ID in .env' });
  }

  // Normalize to E.164
  const digits = rawPhone.replace(/\D/g, '');
  const e164 = digits.startsWith('1') ? `+${digits}` : `+1${digits}`;

  // Build assistant config (same pattern as /context/:sessionId)
  const voiceContext = buildVoiceContext(session);
  const systemPrompt = buildSystemPrompt({
    doctors: getAllDoctors(),
    patientContext: voiceContext,
    bookingContext: session.booking?.status === 'confirmed' ? session.booking : undefined,
  });

  const voicePrompt = systemPrompt + `

VOICE CALL INSTRUCTIONS:
- You initiated this outbound call to follow up from the patient's recent web chat.
- Greet the patient warmly and remind them you are continuing from the chat.
- Keep responses SHORT — 1 to 2 sentences max. This is a phone call.
- Spell out dates and times clearly: "Tuesday, March eighteenth at two thirty PM"
- Use verbal confirmations: "Got it", "Perfect", "Let me check that for you"
- End the call warmly: "You're all set! Have a great day."
- If there's silence, gently prompt: "Are you still there?"
`;

  const serverUrl = process.env.VAPI_SERVER_URL?.trim();
  const voiceTools = serverUrl ? buildVoiceTools(serverUrl).filter(t => {
    if (t.function?.name === 'book_appointment' && session.state === 'complete') return false;
    if ((t.function?.name === 'cancel_appointment' || t.function?.name === 'reschedule_appointment') && session.booking?.status !== 'confirmed') return false;
    return true;
  }) : undefined;

  const firstName = session.patient?.name?.split(' ')[0];
  const firstMessage = firstName
    ? `Hi ${firstName}, this is Kyra from KyronMed calling to continue helping you from our recent chat. How can I assist you?`
    : `Hi there, this is Kyra from KyronMed following up on your recent chat with us. How can I help?`;

  const assistantConfig = {
    firstMessage,
    firstMessageMode: 'assistant-speaks-first',
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: voicePrompt }],
      temperature: 0.7,
      maxTokens: 250,
      ...(voiceTools && { tools: voiceTools }),
    },
    voice: {
      provider: '11labs',
      voiceId: '21m00Tcm4TlvDq8ikWAM',  // "Rachel"
    },
    transcriber: {
      provider: 'deepgram',
      model: 'nova-2',
      language: 'en-US',
    },
    metadata: { sessionId: sid },
  };

  try {
    const vapiRes = await fetch('https://api.vapi.ai/call', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumberId,
        customer: {
          number: e164,
          ...(session.patient?.name && { name: session.patient.name }),
        },
        assistant: assistantConfig,
        metadata: { sessionId: sid },
      }),
    });

    const callData = await vapiRes.json();

    if (!vapiRes.ok) {
      console.error('📱 Vapi call-me error:', callData);
      return res.status(vapiRes.status).json({ error: callData.message || 'Vapi rejected the call request' });
    }

    console.log(`📱 Outbound call placed → ${e164} (callId: ${callData.id})`);
    res.json({ success: true, callId: callData.id, phone: e164 });
  } catch (err) {
    console.error('📱 call-me fetch error:', err);
    res.status(500).json({ error: 'Failed to place call. Please try again.' });
  }
});

/**
 * POST /api/vapi/webhook
 * Handles Vapi server-side events: function calls, call lifecycle, and callback memory.
 */
router.post('/webhook', (req, res) => {
  const event = req.body;
  const eventType = event.message?.type || event.type || 'unknown';

  console.log('📞 Vapi webhook:', eventType);

  switch (eventType) {
    case 'function-call': {
      const { functionCall } = event.message || {};
      if (!functionCall) break;

      const sessionId = event.message?.call?.metadata?.sessionId;
      const result = handleVoiceToolCall(functionCall.name, functionCall.parameters, sessionId);
      return res.json({ result: JSON.stringify(result) });
    }

    case 'call-started':
    case 'status-update': {
      const status = event.message?.status || event.call?.status;
      if (status === 'in-progress') {
        const phoneNumber = event.message?.call?.customer?.number || event.call?.customer?.number;
        const sessionId = event.message?.call?.metadata?.sessionId || event.call?.metadata?.sessionId;
        if (phoneNumber && sessionId) {
          sessionStore.mapPhone(phoneNumber, sessionId);
          console.log(`   Mapped ${phoneNumber} → session ${sessionId}`);
        }
      }
      break;
    }

    case 'end-of-call-report': {
      const report = event.message || event;
      console.log(`   Call ended — duration: ${report.durationSeconds}s, cost: $${report.cost || '?'}`);

      const sessionId = report.call?.metadata?.sessionId;
      if (sessionId && report.transcript) {
        sessionStore.addMessage(sessionId, 'system', `[Voice call transcript]\n${report.transcript}`);
      }
      break;
    }

    case 'phone-call-incoming':
    case 'assistant-request': {
      const incomingNumber = event.message?.call?.customer?.number || event.call?.customer?.number;
      const existingSession = incomingNumber ? sessionStore.getByPhone(incomingNumber) : null;

      if (existingSession) {
        console.log(`   🔄 Callback detected! Resuming session ${existingSession.id}`);
        const voiceContext = buildVoiceContext(existingSession);
        const prompt = buildSystemPrompt({
          doctors: getAllDoctors(),
          patientContext: voiceContext,
          bookingContext: existingSession.booking?.status === 'confirmed' ? existingSession.booking : undefined,
        }) + '\n\nIMPORTANT: This is a CALLBACK — the patient called back. Greet them warmly: "Welcome back! I remember we were discussing..."';

        const callbackServerUrl = process.env.VAPI_SERVER_URL;
        const callbackTools = callbackServerUrl ? buildVoiceTools(callbackServerUrl).filter(t => {
          if (t.function?.name === 'book_appointment' && existingSession.state === 'complete') return false;
          if ((t.function?.name === 'cancel_appointment' || t.function?.name === 'reschedule_appointment') && existingSession.booking?.status !== 'confirmed') return false;
          return true;
        }) : undefined;

        return res.json({
          assistant: {
            firstMessage: `Welcome back${existingSession.patient?.name ? ', ' + existingSession.patient.name.split(' ')[0] : ''}! I remember our conversation. How can I help?`,
            firstMessageMode: 'assistant-speaks-first',
            model: {
              provider: 'openai',
              model: 'gpt-4o-mini',
              messages: [{ role: 'system', content: prompt }],
              ...(callbackTools && { tools: callbackTools }),
            },
            voice: { provider: '11labs', voiceId: '21m00Tcm4TlvDq8ikWAM' },
            transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en-US' },
          },
        });
      }
      break;
    }
  }

  res.json({ ok: true });
});

function handleVoiceToolCall(name, params, sessionId) {
  switch (name) {
    case 'match_doctor': {
      const result = matchDoctor(params.reason);
      if (result && sessionId) {
        sessionStore.setMatchedDoctor(sessionId, result.doctor);
      }
      return result || { error: 'Could not determine specialist. Ask the patient for more details.' };
    }

    case 'get_available_slots': {
      return getAvailableSlots(params.doctor_id, {
        date: params.date,
        timePreference: params.time_preference,
        limit: 3,
      });
    }

    case 'book_appointment': {
      const booked = bookSlot(params.doctor_id, params.datetime);
      if (!booked) return { error: 'That slot is taken. Try another time.' };

      if (sessionId) {
        sessionStore.setBooking(sessionId, {
          doctorId: params.doctor_id,
          datetime: params.datetime,
          date: booked.date,
          time: booked.time,
          status: 'confirmed',
          bookedAt: new Date().toISOString(),
        });
        sessionStore.setState(sessionId, 'complete');
      }

      return { success: true, date: booked.date, time: booked.time };
    }

    case 'reschedule_appointment': {
      if (!sessionId) return { error: 'No session found.' };
      const session = sessionStore.get(sessionId);
      if (!session.booking || session.booking.status !== 'confirmed') {
        return { error: 'No confirmed appointment to reschedule.' };
      }
      const { doctorId, datetime } = session.booking;
      cancelSlot(doctorId, datetime);
      session.booking = { ...session.booking, status: 'rescheduled', rescheduledAt: new Date().toISOString() };
      sessionStore.setState(sessionId, 'scheduling');
      sessionStore._saveToDisk();
      console.log(`🔄 Voice: appointment rescheduled: ${doctorId} at ${datetime} (slot freed)`);
      return { success: true, message: 'Current slot released. Ask the patient for their preferred new date/time and use get_available_slots.' };
    }

    case 'cancel_appointment': {
      if (!sessionId) return { error: 'No session found.' };
      const session = sessionStore.get(sessionId);
      if (!session.booking || session.booking.status !== 'confirmed') {
        return { error: 'No confirmed appointment to cancel.' };
      }
      const { doctorId, datetime } = session.booking;
      cancelSlot(doctorId, datetime);
      session.booking.status = 'cancelled';
      session.booking.cancelledAt = new Date().toISOString();
      sessionStore.setState(sessionId, 'scheduling');
      sessionStore._saveToDisk();
      console.log(`🚫 Voice: appointment cancelled: ${doctorId} at ${datetime}`);
      return { success: true, message: 'Appointment cancelled. The slot has been released.' };
    }

    default:
      return { error: `Unknown function: ${name}` };
  }
}

export default router;
