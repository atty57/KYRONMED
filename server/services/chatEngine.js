import Groq from 'groq-sdk';
import { buildSystemPrompt } from '../prompts/system.js';
import { getAllDoctors, matchDoctor, selectDoctor } from './doctorMatcher.js';
import { getAvailableSlots, bookSlot, cancelSlot } from './slotManager.js';
import { sessionStore } from './sessionStore.js';
import { sendConfirmationEmail, sendConfirmationSMS } from './notifications.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load practice/office info
let practiceInfo = {};
try {
  practiceInfo = JSON.parse(readFileSync(path.join(__dirname, '..', 'data', 'practice.json'), 'utf-8'));
} catch (e) {
  console.warn('⚠️  Could not load practice.json:', e.message);
}

let groq;
function getGroq() {
  if (!groq) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY environment variable is required.');
    }
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groq;
}
const MODEL = process.env.LLM_MODEL || 'llama-3.3-70b-versatile';

// ─── Parse text-embedded function calls from Llama ────────────────
// Llama 3.3 sometimes outputs <function=name{json}</function> as text
// instead of using the structured tool_calls API. This parser extracts
// those, executes the tools, and returns the cleaned text.
const FUNC_TAG_RE = /<function=(\w+)([\s\S]*?)<\/function>/g;

function parseTextFunctionCalls(content) {
  const calls = [];
  let match;
  while ((match = FUNC_TAG_RE.exec(content)) !== null) {
    const name = match[1];
    let argsStr = match[2].trim();
    try {
      // Handle both <function=name{json}> and <function=name>json</function> formats
      if (argsStr.startsWith('>')) argsStr = argsStr.slice(1).trim();
      if (argsStr.startsWith('{')) {
        calls.push({ name, args: JSON.parse(argsStr) });
      }
    } catch (e) {
      console.warn(`⚠️  Failed to parse embedded tool call ${name}:`, argsStr.substring(0, 100));
    }
  }
  // Reset regex lastIndex
  FUNC_TAG_RE.lastIndex = 0;
  const cleanedContent = content.replace(FUNC_TAG_RE, '').trim();
  return { calls, cleanedContent };
}

// ─── Day-of-week helper ───────────────────────────────────────────
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function getNextDatesForDayOfWeek(dayName, count = 4) {
  const targetDay = DAY_NAMES.indexOf(dayName.toLowerCase());
  if (targetDay === -1) return [];
  const dates = [];
  const d = new Date();
  d.setDate(d.getDate() + 1); // start from tomorrow
  while (dates.length < count) {
    if (d.getDay() === targetDay) {
      dates.push(d.toISOString().split('T')[0]);
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

// ─── Tool definitions ─────────────────────────────────────────────
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'update_patient_info',
      description: 'Store or update patient information as it is collected during conversation. Call this every time you learn a new piece of patient info.',
      parameters: {
        type: 'object',
        properties: {
          firstName: { type: 'string', description: 'Patient first name' },
          lastName: { type: 'string', description: 'Patient last name' },
          name: { type: 'string', description: 'Patient full name (if first/last not separated)' },
          dob: { type: 'string', description: 'Date of birth (any format the patient provides)' },
          phone: { type: 'string', description: 'Phone number' },
          email: { type: 'string', description: 'Email address' },
          reason: { type: 'string', description: 'Reason for visit / symptoms' },
          smsOptIn: { type: 'boolean', description: 'Whether patient opted in to receive SMS confirmations' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_symptom_assessment',
      description: 'Save the structured symptom assessment after conducting the clinical intake questions. Call this AFTER you have asked the patient about their symptoms and gathered enough detail. This data is included in the confirmation email and shared with the doctor.',
      parameters: {
        type: 'object',
        properties: {
          chiefComplaint: { type: 'string', description: 'Primary symptom or reason for visit in patient\'s words (e.g., "knee pain after running")' },
          location: { type: 'string', description: 'Specific body location (e.g., "left knee, outer side")' },
          severity: { type: 'number', description: 'Pain/discomfort severity on 1-10 scale' },
          duration: { type: 'string', description: 'How long symptoms have been present (e.g., "2 weeks", "since Monday")' },
          onset: { type: 'string', description: 'How it started — sudden vs gradual, triggering event if any' },
          aggravatingFactors: { type: 'string', description: 'What makes it worse (e.g., "walking upstairs, bending knee")' },
          relievingFactors: { type: 'string', description: 'What helps (e.g., "rest, ice, ibuprofen")' },
          additionalSymptoms: { type: 'string', description: 'Any accompanying symptoms (e.g., "mild swelling, no numbness")' },
          summary: { type: 'string', description: 'Brief 1-2 sentence clinical summary for the doctor (e.g., "Patient reports 2-week history of lateral left knee pain (6/10) aggravated by running and stairs, with mild swelling. No prior injury. OTC ibuprofen provides partial relief.")' },
        },
        required: ['chiefComplaint', 'summary'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'match_doctor',
      description: 'Register the best doctor match for this patient. You should use your own clinical reasoning — based on the patient\'s symptoms, the clinical intake assessment, and the AVAILABLE DOCTORS list — to determine the best specialist. Then call this tool with the doctor_id to register your choice. If you are unsure, you may pass just a "reason" string and the system will attempt keyword matching as a fallback.',
      parameters: {
        type: 'object',
        properties: {
          doctor_id: {
            type: 'string',
            description: 'The ID of the doctor you have selected (e.g., "dr-chen", "dr-rodriguez"). This is the preferred parameter — use your clinical judgment to pick the best doctor from the AVAILABLE DOCTORS list, then pass their ID here.',
          },
          reason: {
            type: 'string',
            description: 'Fallback: the patient\'s symptoms/reason for visit. Only use this if you cannot determine the best doctor yourself. The system will attempt keyword-based matching.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_available_slots',
      description: 'Get available appointment slots for a doctor. Supports filtering by date, day of week, time preference, or date range.',
      parameters: {
        type: 'object',
        properties: {
          doctor_id: {
            type: 'string',
            description: 'The doctor\'s ID (e.g., "dr-chen")',
          },
          date: {
            type: 'string',
            description: 'Specific date in YYYY-MM-DD format (optional)',
          },
          day_of_week: {
            type: 'string',
            enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
            description: 'Day of week to search for (e.g., "tuesday"). Will find next few occurrences of this day.',
          },
          date_from: {
            type: 'string',
            description: 'Start date for range search (YYYY-MM-DD). Use with date_to for "next week" queries.',
          },
          date_to: {
            type: 'string',
            description: 'End date for range search (YYYY-MM-DD).',
          },
          time_preference: {
            type: 'string',
            enum: ['morning', 'afternoon', 'evening'],
            description: 'Preferred time of day (optional)',
          },
        },
        required: ['doctor_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_appointment',
      description: 'Book a specific appointment slot. Call this ONLY after the patient has explicitly confirmed they want this exact slot.',
      parameters: {
        type: 'object',
        properties: {
          doctor_id: { type: 'string', description: 'The doctor\'s ID' },
          datetime: { type: 'string', description: 'The exact ISO datetime of the slot to book' },
          patient_name: { type: 'string', description: 'Patient full name' },
          patient_email: { type: 'string', description: 'Patient email for confirmation' },
          patient_phone: { type: 'string', description: 'Patient phone number' },
          patient_dob: { type: 'string', description: 'Patient date of birth' },
          reason: { type: 'string', description: 'Reason for visit' },
        },
        required: ['doctor_id', 'datetime', 'patient_name', 'patient_email'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_appointment',
      description: 'Cancel the patient\'s existing confirmed appointment and free up the slot. Only call this AFTER the patient has explicitly confirmed they want to cancel.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Optional reason for cancellation' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reschedule_appointment',
      description: 'Reschedule the patient\'s confirmed appointment. Frees the current slot so the patient can pick a new time. Call this when the patient wants a different date/time — then IMMEDIATELY ask for their new preferred date/time and use get_available_slots.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Optional reason for rescheduling' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_office_info',
      description: 'Get practice information: office hours, locations, addresses, insurance accepted, parking, new patient info, cancellation policy, etc. Call this when the patient asks about office details.',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            enum: ['hours', 'locations', 'insurance', 'new_patient', 'parking', 'cancellation', 'after_hours', 'contact', 'all'],
            description: 'What information the patient is asking about',
          },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_prescription_refill',
      description: 'Submit a prescription refill request. Requires patient name, DOB, medication name, and pharmacy.',
      parameters: {
        type: 'object',
        properties: {
          patient_name: { type: 'string', description: 'Patient full name' },
          patient_dob: { type: 'string', description: 'Patient date of birth' },
          medication: { type: 'string', description: 'Medication name and dosage if known' },
          pharmacy: { type: 'string', description: 'Pharmacy name and location' },
          notes: { type: 'string', description: 'Any additional notes from the patient' },
        },
        required: ['patient_name', 'patient_dob', 'medication', 'pharmacy'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_sms_confirmation',
      description: 'Send an SMS text confirmation to the patient after they have opted in. Only call this if the patient agrees to receive a text.',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: 'Patient phone number' },
          patient_name: { type: 'string', description: 'Patient name' },
          doctor_name: { type: 'string', description: 'Doctor name' },
          date: { type: 'string', description: 'Appointment date' },
          time: { type: 'string', description: 'Appointment time' },
        },
        required: ['phone', 'patient_name', 'doctor_name', 'date', 'time'],
      },
    },
  },
];

// ─── Tool handlers ────────────────────────────────────────────────
async function handleToolCall(toolName, args, sessionId) {
  switch (toolName) {
    case 'update_patient_info': {
      sessionStore.updatePatient(sessionId, args);
      return { success: true, updated: Object.keys(args) };
    }

    case 'send_symptom_assessment':
    case 'save_symptom_assessment': {
      const session = sessionStore.get(sessionId);
      session.symptomAssessment = {
        chiefComplaint: args.chiefComplaint,
        location: args.location || '',
        severity: args.severity || null,
        duration: args.duration || '',
        onset: args.onset || '',
        aggravatingFactors: args.aggravatingFactors || '',
        relievingFactors: args.relievingFactors || '',
        additionalSymptoms: args.additionalSymptoms || '',
        summary: args.summary,
        assessedAt: new Date().toISOString(),
      };
      // Also update reason on patient record
      sessionStore.updatePatient(sessionId, { reason: args.chiefComplaint });
      sessionStore._saveToDisk();
      console.log(`📋 Symptom assessment saved: ${args.summary}`);
      return { success: true, message: 'Assessment saved. This will be included in the confirmation email.' };
    }

    case 'match_doctor': {
      // Primary path: LLM picks the doctor by ID using clinical reasoning
      if (args.doctor_id) {
        const result = selectDoctor(args.doctor_id);
        if (result.error) return result;
        sessionStore.setMatchedDoctor(sessionId, result.doctor);
        sessionStore.setState(sessionId, 'scheduling');
        return result;
      }
      // Fallback path: keyword-based matching from a reason string
      const result = matchDoctor(args.reason);
      if (result) {
        sessionStore.setMatchedDoctor(sessionId, result.doctor);
        sessionStore.setState(sessionId, 'scheduling');
      }
      return result || { error: 'Could not determine the best specialist. Please describe your symptoms in more detail, or specify a doctor from the available list.' };
    }

    case 'get_available_slots': {
      // If a day_of_week is specified, find the next dates for that day and search across them
      if (args.day_of_week && !args.date) {
        const dates = getNextDatesForDayOfWeek(args.day_of_week, 4);
        let allSlots = [];
        for (const d of dates) {
          const slots = getAvailableSlots(args.doctor_id, {
            date: d,
            timePreference: args.time_preference,
            limit: 3,
          });
          allSlots.push(...slots);
        }
        allSlots = allSlots.slice(0, 5);
        return { slots: allSlots, count: allSlots.length, searchedDates: dates };
      }

      const slots = getAvailableSlots(args.doctor_id, {
        date: args.date,
        dateFrom: args.date_from,
        dateTo: args.date_to,
        timePreference: args.time_preference,
        limit: 5,
      });
      return { slots, count: slots.length };
    }

    case 'book_appointment': {
      console.log(`📅 Booking attempt: doctor=${args.doctor_id} datetime=${args.datetime}`);
      const booked = bookSlot(args.doctor_id, args.datetime);
      if (!booked) {
        console.log(`❌ Booking FAILED for ${args.doctor_id} at ${args.datetime}`);
        return { error: 'That slot is no longer available. Please choose another time.' };
      }
      console.log(`✅ Booking SUCCESS: ${booked.date} ${booked.time}`);

      const session = sessionStore.get(sessionId);
      sessionStore.setBooking(sessionId, {
        doctorId: args.doctor_id,
        datetime: args.datetime,
        date: booked.date,
        time: booked.time,
        status: 'confirmed',
        bookedAt: new Date().toISOString(),
      });
      sessionStore.setState(sessionId, 'complete');

      // Send confirmation email (async, don't block)
      // Fall back to session email if LLM didn't include it in tool args
      const emailTo = args.patient_email || session.patient?.email;
      console.log(`📧 Email debug — args.patient_email: ${args.patient_email || 'none'} | session.patient.email: ${session.patient?.email || 'none'} | resolved emailTo: ${emailTo || 'NONE — skipping email'}`);
      if (emailTo) {
        sendConfirmationEmail({
          to: emailTo,
          patientName: args.patient_name || (session.patient?.firstName ? `${session.patient.firstName} ${session.patient.lastName || ''}`.trim() : (session.patient?.name || 'Patient')),
          doctorName: session.matchedDoctor?.name || 'Your Doctor',
          specialty: session.matchedDoctor?.specialty || '',
          date: booked.date,
          time: booked.time,
          location: practiceInfo.locations?.[0]?.address || '',
          practicePhone: practiceInfo.phone || '',
          symptomAssessment: session.symptomAssessment || null,
        }).catch(err => console.error('Email send failed:', err));
      }

      return {
        success: true,
        booking: {
          doctor: session.matchedDoctor?.name,
          date: booked.date,
          time: booked.time,
        },
        emailSent: !!emailTo,
      };
    }

    case 'cancel_appointment': {
      const session = sessionStore.get(sessionId);
      if (!session.booking || session.booking.status !== 'confirmed') {
        return { error: 'No confirmed appointment found to cancel.' };
      }
      const { doctorId, datetime } = session.booking;
      const cancelled = cancelSlot(doctorId, datetime);
      session.booking.status = 'cancelled';
      session.booking.cancelledAt = new Date().toISOString();
      // Reset state to scheduling so the patient can rebook if they wish
      sessionStore.setState(sessionId, 'scheduling');
      sessionStore._saveToDisk();
      console.log(`🚫 Appointment cancelled: ${doctorId} at ${datetime} (slot freed: ${cancelled})`);
      return { success: true, message: 'Appointment cancelled. The slot has been released.' };
    }

    case 'reschedule_appointment': {
      const session = sessionStore.get(sessionId);
      if (!session.booking || session.booking.status !== 'confirmed') {
        return { error: 'No confirmed appointment found to reschedule.' };
      }
      const { doctorId, datetime } = session.booking;
      cancelSlot(doctorId, datetime);
      // Keep a record of what was rescheduled
      session.booking = { ...session.booking, status: 'rescheduled', rescheduledAt: new Date().toISOString() };
      sessionStore.setState(sessionId, 'scheduling');
      sessionStore._saveToDisk();
      console.log(`🔄 Appointment rescheduled: ${doctorId} at ${datetime} (slot freed)`);
      return { success: true, message: 'Current slot released. Now ask the patient for their preferred new date/time and use get_available_slots to find options.' };
    }

    case 'get_office_info': {
      const topic = args.topic;
      switch (topic) {
        case 'hours':
          return { locations: practiceInfo.locations?.map(l => ({ name: l.name, hours: l.hours })) };
        case 'locations':
          return { locations: practiceInfo.locations?.map(l => ({ name: l.name, address: l.address, phone: l.phone })) };
        case 'insurance':
          return { acceptedInsurance: practiceInfo.insurance, note: 'Please verify your specific plan with your insurance provider.' };
        case 'new_patient':
          return practiceInfo.newPatientInfo;
        case 'parking':
          return { locations: practiceInfo.locations?.map(l => ({ name: l.name, parking: l.parking, transit: l.transit })) };
        case 'cancellation':
          return { policy: practiceInfo.newPatientInfo?.cancellationPolicy };
        case 'after_hours':
          return { afterHours: practiceInfo.afterHoursInfo };
        case 'contact':
          return { phone: practiceInfo.phone, fax: practiceInfo.fax, email: practiceInfo.email, website: practiceInfo.website };
        case 'all':
          return practiceInfo;
        default:
          return practiceInfo;
      }
    }

    case 'request_prescription_refill': {
      const session = sessionStore.get(sessionId);
      session.prescriptionRefill = {
        medication: args.medication,
        pharmacy: args.pharmacy,
        notes: args.notes || '',
        requestedAt: new Date().toISOString(),
        status: 'pending',
      };
      sessionStore._saveToDisk();

      return {
        success: true,
        message: `Refill request submitted for ${args.medication}.`,
        turnaround: practiceInfo.prescriptionRefills?.turnaround || '24-48 business hours',
        pharmacy: args.pharmacy,
        note: practiceInfo.prescriptionRefills?.controlled || '',
      };
    }

    case 'send_sms_confirmation': {
      sessionStore.updatePatient(sessionId, { smsOptIn: true });

      const result = await sendConfirmationSMS({
        to: args.phone,
        patientName: args.patient_name,
        doctorName: args.doctor_name,
        date: args.date,
        time: args.time,
      });

      return result.success
        ? { success: true, message: 'SMS confirmation sent.' }
        : { success: false, message: 'Could not send SMS. The patient can still rely on their email confirmation.' };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ─── Chat processor ───────────────────────────────────────────────
export async function* processChat(sessionId, userMessage) {
  const session = sessionStore.get(sessionId);

  // If this patient already has a completed booking and is starting a new booking request,
  // reset the session state so the LLM doesn't auto-rebook with stale data
  if (session.state === 'complete' && session.booking?.status === 'confirmed') {
    const isNewBookingRequest = /\b(book|appointment|schedule|see a doctor|new appointment)\b/i.test(userMessage);
    if (isNewBookingRequest) {
      console.log('🔄 Returning patient starting new booking — resetting session state to scheduling');
      sessionStore.setState(sessionId, 'scheduling');
      // Clear stale booking so the LLM doesn't think there's an active one
      session.booking = { ...session.booking, status: 'previous' };
      sessionStore._saveToDisk();
    }
  }

  // Add user message to history
  sessionStore.addMessage(sessionId, 'user', userMessage);

  // Build messages array for LLM
  const systemPrompt = buildSystemPrompt({
    doctors: getAllDoctors(),
    officeInfo: {
      name: practiceInfo.name,
      phone: practiceInfo.phone,
      locations: practiceInfo.locations?.map(l => l.name + ' — ' + l.address),
      insuranceAccepted: practiceInfo.insurance?.join(', '),
    },
    patientContext: session.patient && Object.keys(session.patient).length > 0
      ? JSON.stringify(session.patient)
      : undefined,
    bookingContext: session.booking?.status === 'confirmed' ? session.booking : undefined,
    cancelledBookingContext: session.booking?.status === 'cancelled'
      ? { ...session.booking, doctorName: session.matchedDoctor?.name || session.booking.doctorId }
      : undefined,
  });

  // Only include user/assistant messages (filter out system/tool messages from voice transcripts etc.)
  const chatHistory = session.messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
      role: m.role,
      content: (m.content || '').replace(/<function=\w+[\s\S]*?<\/function>/gs, '').trim(),
    }))
    .filter(m => m.content.length > 0);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory,
  ];

  // Exclude book_appointment once a booking is confirmed; only surface change tools when a confirmed booking exists
  const activeTools = TOOLS.filter(t => {
    if (t.function?.name === 'book_appointment' && session.state === 'complete') return false;
    if ((t.function?.name === 'cancel_appointment' || t.function?.name === 'reschedule_appointment') && session.booking?.status !== 'confirmed') return false;
    return true;
  });

  let response = await getGroq().chat.completions.create({
    model: MODEL,
    messages,
    tools: activeTools,
    tool_choice: 'auto',
    temperature: 0.7,
    max_tokens: 1024,
    stream: false,
  });

  let assistantMessage = response.choices[0].message;

  // Handle tool calls in a loop (may need multiple rounds)
  let iterations = 0;
  let slotsJustFetched = false;
  while (assistantMessage.tool_calls && iterations < 5) {
    iterations++;

    // Guard: if we fetched slots last round, don't allow booking in the next
    // round — force the LLM to present options to the user first
    if (slotsJustFetched) {
      const triesBooking = assistantMessage.tool_calls.some(
        tc => tc.function.name === 'book_appointment'
      );
      if (triesBooking) {
        console.log('⛔ Blocked book_appointment — must present slots to user first');
        break;
      }
    }

    // Detect if get_available_slots and book_appointment are called in the SAME round
    const calledSlots = assistantMessage.tool_calls.some(
      tc => tc.function.name === 'get_available_slots'
    );
    const calledBook = assistantMessage.tool_calls.some(
      tc => tc.function.name === 'book_appointment'
    );
    if (calledSlots && calledBook) {
      // Only execute get_available_slots, strip the booking call
      console.log('⛔ Blocked simultaneous get_available_slots + book_appointment — must present slots to user first');
      assistantMessage.tool_calls = assistantMessage.tool_calls.filter(
        tc => tc.function.name !== 'book_appointment'
      );
    }

    messages.push(assistantMessage);

    for (const toolCall of assistantMessage.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments);
      console.log(`🔧 Tool call: ${toolCall.function.name}`, JSON.stringify(args).substring(0, 200));
      const result = await handleToolCall(toolCall.function.name, args, sessionId);

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }

    // Track whether slots were fetched this round
    slotsJustFetched = calledSlots;

    response = await getGroq().chat.completions.create({
      model: MODEL,
      messages,
      tools: activeTools,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 1024,
      stream: false,
    });

    assistantMessage = response.choices[0].message;
  }

  let finalContent = assistantMessage.content || '';

  // ── Handle Llama's text-embedded function calls ──────────────────
  // Llama 3.3 sometimes outputs <function=name{json}</function> as text
  // instead of using the structured tool_calls API. Parse and execute them.
  const { calls: embeddedCalls, cleanedContent } = parseTextFunctionCalls(finalContent);
  // Always use cleaned content so function tags are never stored in message history
  finalContent = cleanedContent;
  if (embeddedCalls.length > 0) {
    // Guard: if embedded calls contain both get_available_slots and book_appointment, strip the booking
    const hasEmbeddedSlots = embeddedCalls.some(c => c.name === 'get_available_slots');
    const hasEmbeddedBook = embeddedCalls.some(c => c.name === 'book_appointment');
    const filteredCalls = (hasEmbeddedSlots && hasEmbeddedBook)
      ? embeddedCalls.filter(c => c.name !== 'book_appointment')
      : embeddedCalls;
    if (hasEmbeddedSlots && hasEmbeddedBook) {
      console.log('⛔ Blocked embedded book_appointment — must present slots to user first');
    }

    console.log(`🔄 Found ${filteredCalls.length} embedded function call(s) in text output`);
    for (const call of filteredCalls) {
      console.log(`🔧 Embedded tool call: ${call.name}`, JSON.stringify(call.args).substring(0, 200));
      try {
        const result = await handleToolCall(call.name, call.args, sessionId);
        console.log(`  ✅ Result:`, JSON.stringify(result).substring(0, 200));
      } catch (err) {
        console.error(`  ❌ Error executing ${call.name}:`, err.message);
      }
    }
    finalContent = cleanedContent;
  }

  sessionStore.addMessage(sessionId, 'assistant', finalContent);

  yield { type: 'text', content: finalContent };

  // Re-read session after all tool calls have updated it
  const finalSession = sessionStore.get(sessionId);
  const confirmedBooking = finalSession.booking?.status === 'confirmed'
    ? {
        doctorId:    finalSession.booking.doctorId,
        date:        finalSession.booking.date,
        time:        finalSession.booking.time,
        doctorName:  finalSession.matchedDoctor?.name,
        specialty:   finalSession.matchedDoctor?.specialty,
        patientName: finalSession.patient?.firstName
          ? `${finalSession.patient.firstName} ${finalSession.patient.lastName || ''}`.trim()
          : (finalSession.patient?.name || null),
        patientEmail: finalSession.patient?.email || null,
      }
    : null;

  const matchedDoc = finalSession.matchedDoctor
    ? { id: finalSession.matchedDoctor.id, name: finalSession.matchedDoctor.name, specialty: finalSession.matchedDoctor.specialty }
    : null;

  const bookingCancelled = finalSession.booking?.status === 'cancelled';

  yield {
    type: 'done',
    sessionId: finalSession.id,
    state: finalSession.state,
    matchedDoctor: (confirmedBooking || bookingCancelled) ? null : matchedDoc,   // hide picker once booked or cancelled
    booking: confirmedBooking,
    bookingCancelled,
  };
}

/**
 * Non-streaming version for simpler use cases.
 */
export async function processChatSync(sessionId, userMessage) {
  let fullContent = '';
  let finalData = {};

  for await (const chunk of processChat(sessionId, userMessage)) {
    if (chunk.type === 'text') fullContent += chunk.content;
    if (chunk.type === 'done') finalData = chunk;
  }

  return { content: fullContent, ...finalData };
}
