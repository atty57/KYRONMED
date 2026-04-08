# KyronMed AI Scheduling Assistant

An intelligent medical scheduling platform that combines conversational AI chat with voice calling to deliver a seamless patient appointment booking experience. Patients interact with **Kyra**, an AI receptionist who collects intake information, matches symptoms to the right specialist, and books appointments all through natural conversation.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [API Reference](#api-reference)
- [Deployment](#deployment)
- [Doctor Directory](#doctor-directory)

## Features

**Conversational Scheduling** — Kyra collects patient information (name, DOB, phone, email, reason for visit) through natural conversation rather than rigid forms, then matches patients to the appropriate specialist.

**Clinical Intake Assessment** — Before matching a doctor, Kyra conducts a structured symptom assessment (onset, severity, location, triggers, etc.) that is included in the booking confirmation email as a pre-visit summary.

**Intelligent Doctor Matching** — A two-tier system: the LLM performs clinical reasoning to select a doctor by ID, with keyword-based matching (including synonym expansion) as a fallback. Ambiguous cases prompt clarifying questions.

**Real-Time Chat Streaming** — Messages stream token-by-token via Server-Sent Events (SSE) for a responsive, typing-like experience.

**Voice AI Integration** — Patients can speak with Kyra via in-browser voice calls (Vapi Web SDK) or request a phone callback. The voice assistant receives full chat context so the patient never has to repeat information.

**Callback Memory** — If a patient calls back on the same phone number, the system recognizes them and resumes the conversation with full context ("Welcome back, John. I see we were discussing your knee appointment...").

**Email Confirmations** — After booking, patients receive an HTML email with appointment details, their pre-visit assessment summary, and a checklist of what to bring.

**Admin Dashboard** — A password-protected panel for staff to view all booked appointments, see pre-visit assessments, and cancel bookings.

**Liquid Glass UI** — A polished dark-themed interface featuring glassmorphism cards, a Three.js WebGL animated background with interactive mouse tracking, and Framer Motion transitions throughout.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)               │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Chat Widget  │  │ Slot Picker  │  │  Voice Call    │  │
│  │ (streaming)  │  │ (interactive)│  │  (Vapi SDK)    │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                 │                   │          │
│  Tailwind CSS + Framer Motion + Three.js Background     │
└─────────┬─────────────────┬───────────────────┬─────────┘
          │ REST / SSE      │ REST              │ Vapi Web SDK
          ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────┐
│                   BACKEND (Node.js / Express)            │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  /api/chat   │  │ /api/booking │  │ /api/vapi/*  │  │
│  │  (streaming) │  │ (slots/book) │  │ (webhooks)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                  │          │
│  ┌──────┴──────────────────┴──────────────────┴──────┐  │
│  │              Core Services Layer                   │  │
│  │  • ChatEngine    — LLM orchestration + tool calls  │  │
│  │  • DoctorMatcher — Symptom → specialty routing     │  │
│  │  • SlotManager   — Availability + booking logic    │  │
│  │  • SessionStore  — Chat history + context memory   │  │
│  │  • Notifications — Email confirmations             │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
          │                 │                  │
          ▼                 ▼                  ▼
   ┌────────────┐   ┌────────────┐    ┌─────────────┐
   │  Groq API  │   │  Gmail     │    │  Vapi.ai    │
   │ (Llama 3.3)│   │ (SMTP)    │    │ (Voice AI)  │
   └────────────┘   └────────────┘    └─────────────┘
```

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| Vite 6 | Build tool and dev server |
| Tailwind CSS 3 | Utility-first styling with custom glassmorphism system |
| Framer Motion 11 | Page transitions and micro-animations |
| Three.js | WebGL liquid background with custom GLSL shaders |
| Vapi Web SDK | In-browser voice calls |
| Lucide React | Icon library |

### Backend

| Technology | Purpose |
|---|---|
| Node.js + Express | HTTP server and API routing |
| Groq SDK | LLM inference (Llama 3.3 70B, sub-200ms latency) |
| Nodemailer | Email delivery via Gmail SMTP |
| UUID | Session ID generation |
| Server-Sent Events | Real-time chat streaming |

### Infrastructure

| Technology | Purpose |
|---|---|
| Nginx | Reverse proxy with SSL termination |
| PM2 | Process management with auto-restart |
| Let's Encrypt | Free SSL certificates via Certbot |
| AWS EC2 | Hosting (Ubuntu) |

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- A [Groq](https://console.groq.com) API key (free tier available)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd kyronmed

# Install all dependencies (root, server, and client)
npm run setup

# Create and configure environment variables (see Environment Variables below)
cp .env.example .env  # Or create .env manually
# Edit .env with your API keys

# Generate doctor availability slots (60 days)
cd server && npm run generate-slots && cd ..

# Start development servers (client on :5173, server on :3001)
npm run dev
```

The app will be available at `http://localhost:5173`. The Vite dev server proxies `/api/*` requests to the Express backend on port 3001.

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start both client and server in development mode |
| `npm run dev:client` | Start only the Vite dev server |
| `npm run dev:server` | Start only the Express server (with `--watch`) |
| `npm run build` | Build the client for production |
| `npm start` | Start the production server (serves built client) |
| `npm run setup` | Install dependencies for root, server, and client |
| `cd server && npm run generate-slots` | Regenerate 60 days of appointment slots |

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# ── LLM ──────────────────────────────────────
GROQ_API_KEY=gsk_...                # Required: Groq API key
LLM_MODEL=llama-3.3-70b-versatile  # Optional: model override

# ── Voice (Vapi.ai) ─────────────────────────
VAPI_API_KEY=...                    # Required for voice features
VAPI_PHONE_NUMBER_ID=...            # Required for outbound "call me" feature
VAPI_ASSISTANT_ID=                  # Optional: pre-configured Vapi assistant
VAPI_PHONE_NUMBER=                  # Optional: for callback memory
VAPI_SERVER_URL=                    # Public URL for Vapi webhooks (e.g. ngrok)

# ── Email (Gmail SMTP) ──────────────────────
GMAIL_USER=you@gmail.com            # Gmail address
GMAIL_APP_PASSWORD=xxxx xxxx xxxx   # Gmail App Password (requires 2FA enabled)

# ── Server ───────────────────────────────────
PORT=3001                           # Backend port
NODE_ENV=development                # development | production
SESSION_SECRET=change-me            # Session signing secret
FRONTEND_URL=http://localhost:5173  # CORS origin
```

Voice and email features degrade gracefully — the chat works without them configured.

## Project Structure

```
kyronmed/
├── client/                          # React frontend (Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatWidget.jsx       # Main chat interface with intake form
│   │   │   ├── ChatMessage.jsx      # Individual message bubble
│   │   │   ├── SlotPicker.jsx       # Interactive slot selection by date/time
│   │   │   ├── BookingConfirm.jsx   # Animated booking confirmation card
│   │   │   ├── CallButton.jsx       # Voice call FAB with dropdown menu
│   │   │   ├── VoiceOverlay.jsx     # Full-screen voice call UI with visualizer
│   │   │   ├── AdminPanel.jsx       # Staff appointment management dashboard
│   │   │   ├── LiquidBackground.jsx # Three.js WebGL animated background
│   │   │   └── ui/                  # Reusable UI primitives
│   │   │       ├── GlassCard.jsx    # Glassmorphism container (3 variants)
│   │   │       ├── KyraAvatar.jsx   # SVG animated AI/user avatars
│   │   │       ├── CallIcons.jsx    # Animated SVG call icons
│   │   │       ├── Badge.jsx        # Color-coded status badges
│   │   │       ├── StatusPulse.jsx  # Online indicator with sonar effect
│   │   │       ├── WaveTyping.jsx   # Waveform typing indicator
│   │   │       └── AnimatedText.jsx # Text animation utility
│   │   ├── hooks/
│   │   │   ├── useChat.js           # Chat state, streaming, special messages
│   │   │   ├── useVapi.js           # Vapi SDK lifecycle and call state
│   │   │   └── useSession.js        # Session ID management
│   │   ├── lib/
│   │   │   ├── api.js               # Backend API client (REST + SSE)
│   │   │   └── constants.js         # Brand config, API base URL
│   │   ├── App.jsx                  # Root with chat/admin view toggle
│   │   ├── main.jsx                 # React entry point
│   │   └── index.css                # Tailwind base + glassmorphism design system
│   ├── tailwind.config.js           # Custom colors, glass shadows, animations
│   └── vite.config.js               # Dev proxy to backend (/api → :3001)
│
├── server/                          # Node.js backend (Express)
│   ├── routes/
│   │   ├── chat.js                  # POST /api/chat (SSE streaming)
│   │   ├── booking.js               # Slots and booking CRUD
│   │   ├── vapi.js                  # Voice call context + webhooks
│   │   └── admin.js                 # Protected admin endpoints
│   ├── services/
│   │   ├── chatEngine.js            # LLM orchestration with 9 tool definitions
│   │   ├── doctorMatcher.js         # Clinical reasoning + keyword fallback
│   │   ├── slotManager.js           # Availability filtering and booking
│   │   ├── sessionStore.js          # In-memory store with JSON persistence
│   │   └── notifications.js         # Email confirmations via Nodemailer
│   ├── data/
│   │   ├── doctors.json             # 5 doctors with specialties and schedules
│   │   ├── practice.json            # Office info, insurance, policies
│   │   ├── generateSlots.js         # Slot generator (60 days, realistic gaps)
│   │   ├── availability.json        # Generated slot data (gitignored)
│   │   └── sessions.json            # Persisted session data (gitignored)
│   ├── prompts/
│   │   └── system.js                # System prompt builder with dynamic context
│   ├── middleware/
│   │   └── session.js               # Session ID extraction and phone mapping
│   ├── app.js                       # Express app setup (CORS, routes, static)
│   └── server.js                    # Entry point (dotenv, listen)
│
├── deploy/
│   ├── nginx.conf                   # Reverse proxy with SSE/WebSocket support
│   ├── setup.sh                     # EC2 bootstrap (Node 20, PM2, Nginx, Certbot)
│   └── ecosystem.config.js          # PM2 process config (512MB limit, autorestart)
│
├── .env                             # Environment variables (gitignored)
├── .gitignore
├── package.json                     # Root workspace with concurrently
└── PROJECT_PLAN.md                  # Detailed build plan and architecture notes
```

## How It Works

### Chat Flow

The conversation follows a state machine: **START → INTAKE → TRIAGE → SCHEDULING → CONFIRMING → COMPLETE**.

1. **Greeting** — Kyra welcomes the patient and begins collecting information conversationally.
2. **Intake** — Patient provides name, DOB, phone, email, and reason for visit. Kyra asks these naturally, not as a rigid form. If the patient provides everything upfront, Kyra skips ahead.
3. **Clinical Assessment** — For non-routine visits, Kyra asks about symptom onset, severity, location, duration, and triggers. This assessment is saved and included in the confirmation email.
4. **Doctor Matching** — The LLM analyzes symptoms and selects the appropriate specialist. A keyword-based fallback with synonym expansion handles edge cases. Ambiguous cases prompt clarifying questions.
5. **Scheduling** — Available slots are presented in an interactive picker grouped by date. The patient selects a time.
6. **Confirmation** — The appointment is booked, the slot is marked unavailable, and a confirmation email is sent with full details and the pre-visit assessment.

### Chat-to-Voice Handoff

1. During chat, all messages and patient context are stored in the session.
2. When the patient clicks "Call Kyra" or "Call Me", the backend compiles the full chat history into a context summary.
3. The Vapi voice assistant receives this context as its system prompt — it already knows the patient's name, symptoms, matched doctor, and booking status.
4. If the patient calls back on the same phone number, the webhook detects the returning caller and resumes their session automatically.

### LLM Tool Calling

The chat engine provides 10 tools to the LLM: `update_patient_info`, `send_symptom_assessment`, `match_doctor`, `get_available_slots`, `book_appointment`, `cancel_appointment`, `reschedule_appointment`, `get_office_info`, `request_prescription_refill`, and `send_sms_confirmation`. Guardrails prevent the LLM from booking without first presenting slots, or fetching slots and booking in the same turn.

## API Reference

### Chat

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/chat` | Send a message, receive SSE stream. Header: `x-session-id` |
| POST | `/api/chat/register` | Pre-register patient info (name, DOB, email, phone) |
| GET | `/api/chat/session/:id` | Retrieve full session object (debug) |

### Booking

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/booking/doctors` | List all doctors |
| GET | `/api/booking/slots/:doctorId` | Get available slots (query: date, timePreference, limit) |
| POST | `/api/booking/book` | Book a slot (body: doctorId, datetime) |
| POST | `/api/booking/cancel` | Cancel a booking (body: doctorId, datetime) |

### Voice (Vapi)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/vapi/context/:sessionId` | Get transient assistant config for web call |
| POST | `/api/vapi/call-me` | Place outbound phone call to patient |
| POST | `/api/vapi/webhook` | Handle Vapi events (function calls, call lifecycle) |

### Admin

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/admin/login` | Validate admin password |
| GET | `/api/admin/appointments` | List all bookings with patient and assessment details |
| GET | `/api/admin/sessions` | List all sessions |
| DELETE | `/api/admin/appointments/:sessionId` | Cancel an appointment and free the slot |

### Health

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Returns `{ status: "ok" }` with timestamp |

## Deployment

The `deploy/` directory contains everything needed to deploy on an Ubuntu EC2 instance:

```bash
# On the EC2 instance:
# 1. Run the bootstrap script
chmod +x deploy/setup.sh && ./deploy/setup.sh

# 2. Clone the repo
git clone <repo-url> /opt/kyronmed && cd /opt/kyronmed

# 3. Install dependencies and configure
npm run setup
# Create .env with production values (see Environment Variables section)

# 4. Generate slots and build
cd server && npm run generate-slots && cd ..
npm run build

# 5. Start with PM2
pm2 start deploy/ecosystem.config.js
pm2 save && pm2 startup

# 6. Configure Nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/kyronmed
sudo ln -s /etc/nginx/sites-available/kyronmed /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx

# 7. Enable HTTPS (requires a domain pointed at the server)
sudo certbot --nginx -d yourdomain.com
```

In production, the Express server serves the built React client as static files and handles all API routes on port 3001, with Nginx reverse-proxying port 80/443 to it.

## Doctor Directory

| Doctor | Specialty | Slot Duration | Schedule |
|---|---|---|---|
| Dr. Sarah Chen | Family Medicine / Primary Care | 30 min | Mon–Fri, 9 AM – 5 PM |
| Dr. Michael Rodriguez | Orthopedics | 30 min | Mon–Fri, 8 AM – 4 PM |
| Dr. Priya Patel | Dermatology | 20 min | Mon–Thu, 10 AM – 5 PM |
| Dr. James Wilson | Cardiology | 30 min | Mon, Wed–Fri, 9 AM – 4 PM |
| Dr. Aisha Thompson | Pediatrics | 20 min | Mon–Fri, 8 AM – 5 PM |

Slots are generated for 60 days with ~25% randomly removed to simulate realistic availability. Lunch hour (12–1 PM) is always blocked.

---

Built with Groq, Vapi.ai, React, and Express.
