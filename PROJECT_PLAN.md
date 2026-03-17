# KyronMed AI Scheduling Assistant - Project Plan


## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Chat Widget  │  │ Intake Form  │  │  Call Button   │  │
│  │ (streaming)  │  │ (step-based) │  │  (Vapi SDK)    │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                 │                   │          │
│  Tailwind + Framer Motion + Liquid Glass UI             │
└─────────┬─────────────────┬───────────────────┬─────────┘
          │ REST/SSE        │ REST              │ Vapi Web SDK
          ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────┐
│                   BACKEND (Node/Express)                 │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  /api/chat   │  │ /api/book    │  │ /api/vapi/*  │  │
│  │  (streaming) │  │ (booking)    │  │ (webhooks)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                  │          │
│  ┌──────┴──────────────────┴──────────────────┴──────┐  │
│  │              Core Services Layer                   │  │
│  │  • ChatEngine (LLM orchestration + tool calls)    │  │
│  │  • DoctorMatcher (semantic specialty routing)     │  │
│  │  • SlotManager (availability + booking logic)     │  │
│  │  • SessionStore (chat history + context)          │  │
│  │  • NotificationService (email + SMS)              │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
          │                 │                  │
          ▼                 ▼                  ▼
   ┌────────────┐   ┌────────────┐    ┌─────────────┐
   │ Groq API   │   │ Resend API │    │  Vapi.ai    │
   │ (Llama 3)  │   │ (email)    │    │ (voice AI)  │
   └────────────┘   └────────────┘    └─────────────┘
```

**LLM Choice: Groq (Llama 3.3 70B)** — Sub-200ms inference, free tier generous, perfect for real-time chat. If quality issues arise, hot-swap to Claude Sonnet via env var.

---

## 2. Folder Structure

```
kyronmed/
├── client/                     # React frontend (Vite)
│   ├── public/
│   │   └── kyron-logo.svg
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatWidget.jsx        # Main chat interface
│   │   │   ├── ChatMessage.jsx       # Individual message bubble
│   │   │   ├── IntakeForm.jsx        # Patient intake (name, DOB, etc.)
│   │   │   ├── SlotPicker.jsx        # Visual slot selection
│   │   │   ├── BookingConfirm.jsx    # Confirmation screen
│   │   │   ├── CallButton.jsx        # "Call me" → Vapi trigger
│   │   │   ├── AdminPanel.jsx        # 🟢 Simple admin view
│   │   │   └── ui/
│   │   │       ├── GlassCard.jsx     # Reusable liquid glass container
│   │   │       ├── AnimatedText.jsx  # Typing indicator
│   │   │       └── Badge.jsx         # Status badges
│   │   ├── hooks/
│   │   │   ├── useChat.js            # Chat state + streaming logic
│   │   │   ├── useVapi.js            # Vapi Web SDK integration
│   │   │   └── useSession.js         # Session management
│   │   ├── lib/
│   │   │   ├── api.js                # Backend API client
│   │   │   └── constants.js          # Brand colors, config
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css                 # Tailwind + glass styles
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
│
├── server/                     # Node.js backend (Express)
│   ├── routes/
│   │   ├── chat.js                   # POST /api/chat (streaming SSE)
│   │   ├── booking.js                # POST /api/book, GET /api/slots
│   │   ├── vapi.js                   # POST /api/vapi/webhook, context
│   │   └── admin.js                  # GET /api/appointments (admin)
│   ├── services/
│   │   ├── chatEngine.js             # LLM orchestration + tool use
│   │   ├── doctorMatcher.js          # Symptom → specialty mapping
│   │   ├── slotManager.js            # Availability + booking CRUD
│   │   ├── sessionStore.js           # In-memory + file-backed sessions
│   │   └── notifications.js          # Email notifications
│   ├── data/
│   │   ├── doctors.json              # 4+ doctors with specialties
│   │   └── availability.json         # Generated slots (next 60 days)
│   ├── prompts/
│   │   └── system.js                 # System prompt for chat + voice
│   ├── middleware/
│   │   └── session.js                # Session middleware
│   ├── app.js                        # Express app setup
│   ├── server.js                     # Entry point
│   └── package.json
│
├── deploy/
│   ├── nginx.conf                    # Nginx reverse proxy config
│   ├── setup.sh                      # EC2 bootstrap script
│   └── ecosystem.config.js           # PM2 process config
│
├── .env.example                      # All required env vars
├── .gitignore
├── package.json                      # Root workspace config
└── README.md
```

---

## 3. Doctor Data (Hardcoded)

| Doctor | Specialty | Matches (semantic keywords) |
|--------|-----------|----------------------------|
| Dr. Sarah Chen | Family Medicine / Primary Care | general checkup, cold, flu, fever, fatigue, headache, annual physical, blood pressure |
| Dr. Michael Rodriguez | Orthopedics | knee, back, shoulder, joint, bone, fracture, sprain, sports injury, hip, elbow, wrist |
| Dr. Priya Patel | Dermatology | skin, rash, acne, mole, eczema, psoriasis, itching, sunburn, lesion, cosmetic |
| Dr. James Wilson | Cardiology | heart, chest pain, palpitations, blood pressure, shortness of breath, cholesterol, dizzy |
| Dr. Aisha Thompson | Pediatrics | child, baby, infant, toddler, kid, vaccination, growth, developmental |

Each doctor has availability generated for the next 60 days with realistic slots (9am-5pm, Mon-Fri, 30-min increments, some randomly blocked to feel real).

---

## 4. Chat Flow (State Machine)

```
┌─────────┐    greeting     ┌─────────────┐   all fields    ┌───────────────┐
│  START   │ ─────────────► │   INTAKE     │ ──────────────► │  TRIAGE       │
│          │                │  collecting  │                 │  matching     │
└─────────┘                 │  patient info│                 │  specialty    │
                            └─────────────┘                 └───────┬───────┘
                                                                    │
                                    matched doctor                  │
                            ┌───────────────────────────────────────┘
                            ▼
                     ┌──────────────┐   slot chosen    ┌──────────────┐
                     │  SCHEDULING  │ ───────────────► │  CONFIRMING  │
                     │  showing     │                  │  booking +   │
                     │  available   │                  │  sending     │
                     │  slots       │                  │  email       │
                     └──────────────┘                  └──────┬───────┘
                                                              │
                                                              ▼
                                                       ┌──────────────┐
                                                       │   COMPLETE   │
                                                       │  offer call  │
                                                       │  or followup │
                                                       └──────────────┘
```

The AI collects intake info **conversationally** (not a rigid form). It asks for name first, then weaves in DOB, phone, email, reason naturally. If the patient provides everything upfront, it skips ahead.

---

## 5. Chat-to-Voice Handoff (The Showstopper)

### How it works:
1. **During chat**, every message pair is stored in `sessionStore` keyed by `sessionId`
2. **When patient clicks "Call Me"**, frontend calls `POST /api/vapi/start-call`
3. **Backend** compiles the full chat history into a context summary:
   ```
   Patient: John Smith, DOB 03/15/1990
   Reason: Knee pain after running
   Matched Doctor: Dr. Rodriguez (Orthopedics)
   Appointment: March 18, 2:30 PM
   Chat summary: [condensed conversation]
   ```
4. **Backend** calls Vapi API to create an outbound call (or in-browser call via Web SDK) with this context injected as the `system` prompt
5. **Voice AI** picks up already knowing everything — no "can I have your name again?"

### Callback Memory (Pioneer Feature):
- When Vapi assigns a phone number, we store `phoneNumber → sessionId` mapping
- If patient calls that number back, Vapi webhook hits our server
- We look up the session, rebuild context, inject into the new call
- AI says: "Welcome back, John. I see we were discussing your knee appointment with Dr. Rodriguez..."

---

## 6. Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| LLM | Groq (Llama 3.3 70B) | Sub-200ms latency, free tier, swap to Claude via env var |
| Chat streaming | SSE (Server-Sent Events) | Simpler than WebSocket, perfect for one-way streaming |
| Session storage | In-memory Map + JSON file backup | No DB needed for demo, persists across restarts |
| Specialty matching | Keyword embedding + LLM fallback | Fast keyword match first, LLM for ambiguous cases |
| Slot format | ISO 8601 datetime strings | Standard, easy to parse with date-fns |
| Email | Resend | 3 lines of code to send, free tier = 100 emails/day |
| Voice | Vapi.ai Web SDK | Browser-native calls, no phone needed for demo |
| Frontend build | Vite | Fast HMR, clean React setup |
| Deploy | PM2 + Nginx + Let's Encrypt | Production-grade, auto-restart, HTTPS |

---

## 7. Build Order (Hour by Hour)

### DAY 1 — Today (March 15): Foundation + Core Chat

**Block 1 (2-3 hrs): Scaffold + Data**
- [ ] Initialize monorepo (client + server)
- [ ] Set up Express server with CORS, session middleware
- [ ] Create doctor data + availability generator (60 days of slots)
- [ ] Set up Vite + React + Tailwind + Framer Motion
- [ ] Build GlassCard component + base layout with Kyron branding

**Block 2 (2-3 hrs): Chat Engine**
- [ ] Build Groq integration with streaming SSE
- [ ] Write system prompt (conversational medical receptionist)
- [ ] Implement chat state machine (intake → triage → scheduling)
- [ ] Build ChatWidget + ChatMessage components
- [ ] Wire up streaming responses in the UI

**Block 3 (1-2 hrs): Intake + Matching**
- [ ] Implement conversational intake extraction (parse name, DOB, etc. from natural language)
- [ ] Build semantic specialty matcher (keyword map + LLM fallback)
- [ ] Test end-to-end: patient describes issue → matched to correct doctor

### DAY 2 — Tomorrow (March 16): Booking + Voice + Deploy

**Block 4 (2-3 hrs): Booking Flow**
- [ ] Build slot query logic with natural language date parsing ("next Tuesday", "afternoon")
- [ ] SlotPicker component for visual selection
- [ ] Booking confirmation flow + database write
- [ ] Resend email integration for confirmation emails

**Block 5 (2-3 hrs): Voice Integration**
- [ ] Set up Vapi.ai account + assistant
- [ ] Build `/api/vapi/start-call` endpoint (context injection)
- [ ] Integrate Vapi Web SDK in frontend (CallButton component)
- [ ] Build webhook handler for callback memory
- [ ] Test full flow: chat → book → call with context

**Block 6 (2 hrs): Deploy**
- [ ] Set up EC2 instance (Ubuntu, Node 20, Nginx)
- [ ] Configure Nginx reverse proxy + Let's Encrypt SSL
- [ ] PM2 config for process management
- [ ] Deploy + smoke test

### DAY 3 — Tuesday (March 17): Polish + Pioneer + Video

**Block 7 (Morning): Pioneer Features**
- [ ] Callback memory (phone number → session lookup)
- [ ] Appointment rescheduling via chat
- [ ] Simple admin panel (table of booked appointments)

**Block 8 (Afternoon): Polish + Record**
- [ ] UI animations (message appear, slot selection, confirmation)
- [ ] Error handling + edge cases
- [ ] Record demo video
- [ ] Submit by 8 PM ET

---

## 8. Environment Variables

```env
# LLM
GROQ_API_KEY=gsk_...
# Fallback LLM (optional)
ANTHROPIC_API_KEY=sk-ant-...

# Voice
VAPI_API_KEY=...
VAPI_ASSISTANT_ID=...
VAPI_PHONE_NUMBER=...

# Email
RESEND_API_KEY=re_...
FROM_EMAIL=appointments@kyronmed.com

# Server
PORT=3001
NODE_ENV=production
SESSION_SECRET=...
FRONTEND_URL=https://yourdomain.com
```

---

## 9. System Prompt (Core)

```
You are Kyra, a friendly and professional AI scheduling assistant for KyronMed clinic.

Your personality: Warm, efficient, slightly conversational — like the best medical
receptionist you've ever spoken to. You use the patient's first name once you know it.

Your job:
1. Greet the patient warmly
2. Collect their information naturally through conversation (name, date of birth,
   phone number, email, reason for visit) — don't make it feel like a form
3. Based on their reason for visit, match them to the right doctor
4. Help them find an available time slot using natural language
5. Confirm the booking and let them know they'll receive an email
6. Offer to connect them with a voice assistant for any follow-up questions

Rules:
- Never diagnose or give medical advice
- If it's an emergency, tell them to call 911 immediately
- Be concise — patients don't want to read paragraphs
- If you're unsure about the specialty match, ask a clarifying question
- Always confirm details before booking
```

---

## 10. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Groq rate limits | Fallback to Claude Sonnet via env var swap |
| Vapi integration issues | Build call button as progressive enhancement; chat works without it |
| EC2 deploy problems | Can demo locally with ngrok as backup |
| Time crunch | Everything after Block 5 is polish — MVP is complete by end of Day 2 |
| Specialty matching errors | Keyword map handles 80% of cases; LLM handles edge cases |

---

## Ready to Build?

This plan is designed so that **at the end of each block, you have a demoable product**:
- After Block 2: Working chat with AI
- After Block 3: Full intake + doctor matching
- After Block 4: Complete booking flow with email
- After Block 5: Voice handoff working (the "wow" moment)
- After Block 6: Live on the internet
- After Block 7+: Pioneer features that differentiate you
