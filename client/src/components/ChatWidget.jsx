import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, RotateCcw, MessageSquare, ArrowRight, User, Mail, Phone as PhoneIcon, Sparkles, Calendar, LogOut, ChevronDown } from 'lucide-react';
import { useChat } from '../hooks/useChat.js';
import { useVapi } from '../hooks/useVapi.js';
import { setSessionFromPhone, hasSession, resetSession, registerPatient } from '../lib/api.js';
import ChatMessage from './ChatMessage.jsx';
import SlotPicker from './SlotPicker.jsx';
import BookingConfirm from './BookingConfirm.jsx';
import CallButton from './CallButton.jsx';
import VoiceOverlay from './VoiceOverlay.jsx';
import GlassCard from './ui/GlassCard.jsx';
import KyraAvatar from './ui/KyraAvatar.jsx';
import StatusPulse from './ui/StatusPulse.jsx';

// ─── Futuristic Send Button ───────────────────────────────────────
const CORNERS = [
  'top-[-3px] left-[-3px] border-t border-l',
  'top-[-3px] right-[-3px] border-t border-r',
  'bottom-[-3px] left-[-3px] border-b border-l',
  'bottom-[-3px] right-[-3px] border-b border-r',
];

function SendButton({ hasText, loading }) {
  const active = hasText && !loading;
  return (
    <div className="relative flex-shrink-0 w-[42px] h-[42px]">

      {/* HUD targeting brackets */}
      <AnimatePresence>
        {active && CORNERS.map((cls, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, scale: 1.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.4 }}
            transition={{ duration: 0.18, delay: i * 0.03 }}
            className={`absolute w-[7px] h-[7px] border-cyan-400/75 rounded-[1px] pointer-events-none z-10 ${cls}`}
          />
        ))}
      </AnimatePresence>

      {/* Scan line when loading */}
      {loading && (
        <motion.div
          className="absolute inset-x-1 h-px pointer-events-none z-10 rounded
                     bg-gradient-to-r from-transparent via-cyan-400/90 to-transparent"
          initial={{ opacity: 0, y: 7  }}
          animate={{ opacity: 1, y: [7, 33, 7] }}
          exit={{   opacity: 0 }}
          transition={{
            opacity: { duration: 0.2 },
            y: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
          }}
        />
      )}

      <motion.button
        type="submit"
        disabled={!hasText || loading}
        whileHover={active ? { scale: 1.07 } : {}}
        whileTap={active  ? { scale: 0.88 } : {}}
        transition={{ duration: 0.12 }}
        className={`absolute inset-0 rounded-xl overflow-hidden flex items-center justify-center
                    outline-none transition-all duration-300 ${
          loading
            ? 'bg-[#070f1d] border border-cyan-500/35 text-cyan-400 cursor-wait'
            : active
              ? 'bg-gradient-to-br from-blue-600 via-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-900/50'
              : 'bg-blue-900/10 text-white/15 cursor-not-allowed'
        }`}
      >
        {/* Shimmer sweep — active only */}
        {active && (
          <motion.div
            className="absolute inset-0 pointer-events-none
                       bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
            animate={{ x: ['-120%', '220%'] }}
            transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 0.6, ease: 'easeInOut' }}
          />
        )}

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.span
              key="dots"
              className="flex items-center gap-[3px]"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{   opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.14 }}
            >
              {[0, 1, 2].map(i => (
                <motion.span
                  key={i}
                  className="block w-[4px] h-[4px] rounded-full bg-cyan-300"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 0.52, repeat: Infinity, delay: i * 0.13, ease: 'easeInOut' }}
                />
              ))}
            </motion.span>
          ) : (
            <motion.span
              key="send"
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0  }}
              exit={{   opacity: 0, x:  5  }}
              transition={{ duration: 0.14 }}
              className="flex items-center justify-center"
            >
              <Send size={16} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { label: 'Book appointment',     text: 'I need to book a doctor appointment' },
  { label: 'Refill prescription',  text: 'I need to refill a prescription' },
  { label: 'Office hours & location', text: 'What are your office hours and where are you located?' },
  { label: 'Insurance question',   text: 'Do you accept my insurance?' },
];

// ─── Custom Glass Dropdown ────────────────────────────────────────
function GlassSelect({ value, onChange, options, placeholder, hasError, className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // scroll selected item into view when opening
  useEffect(() => {
    if (open && listRef.current && value) {
      const el = listRef.current.querySelector('[data-selected="true"]');
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [open, value]);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full glass-input rounded-xl px-3 py-2.5 pr-7 text-[12px] text-left appearance-none cursor-pointer
          flex items-center transition-all duration-200
          ${hasError ? 'border border-red-500/50' : ''}
          ${open ? 'border-blue-500/40 shadow-[0_0_0_3px_rgba(59,154,255,0.1)]' : ''}
          ${selected ? 'text-white' : 'text-slate-500'}`}
      >
        {selected ? selected.label : placeholder}
      </button>
      <ChevronDown
        size={12}
        className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none transition-transform duration-200
          ${open ? 'rotate-180' : ''}`}
      />
      <AnimatePresence>
        {open && (
          <motion.div
            ref={listRef}
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 left-0 right-0 mt-0.5 max-h-40 overflow-y-auto
              rounded-xl border border-white/[0.08] shadow-xl shadow-black/40
              backdrop-blur-xl bg-[#0c1929]/95 chat-scroll"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                data-selected={opt.value === value ? 'true' : undefined}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-[12px] transition-colors duration-100
                  first:rounded-t-xl last:rounded-b-xl
                  ${opt.value === value
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'}`}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  .map((m, i) => ({ value: String(i + 1).padStart(2, '0'), label: m }));
const DAYS = Array.from({ length: 31 }, (_, i) => {
  const v = String(i + 1).padStart(2, '0');
  return { value: v, label: String(i + 1) };
});
const YEARS = Array.from({ length: 100 }, (_, i) => {
  const yr = String(new Date().getFullYear() - i);
  return { value: yr, label: yr };
});

// ─── Patient Intake Form ──────────────────────────────────────────
function IntakeForm({ onSubmit }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', dob: '' });
  const [errors, setErrors] = useState({});
  const firstRef = useRef(null);

  useEffect(() => { firstRef.current?.focus(); }, []);

  const update = (field) => (e) => {
    let val = e.target.value;
    if (field === 'phone') {
      const digits = val.replace(/\D/g, '').slice(0, 10);
      if (digits.length <= 3) val = digits;
      else if (digits.length <= 6) val = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
      else val = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    setForm(f => ({ ...f, [field]: val }));
    setErrors(e => ({ ...e, [field]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = 'Required';
    if (!form.lastName.trim())  e.lastName  = 'Required';
    if (form.phone.replace(/\D/g, '').length < 10) e.phone = 'Enter 10-digit number';
    if (!form.email.trim() || !form.email.includes('@')) e.email = 'Valid email required';
    if (!form.dob || form.dob.includes('-') && form.dob.split('-').some(p => !p)) e.dob = 'Date of birth required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) onSubmit(form);
  };

  const inputClass = (field) =>
    `w-full glass-input rounded-lg px-3 py-2.5 text-[13px] text-white placeholder-slate-500
     ${errors[field] ? 'border border-red-500/50' : ''}`;

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-5 shadow-lg shadow-blue-900/30">
        <Sparkles size={24} className="text-white" />
      </motion.div>
      <motion.h2 initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
        className="text-lg font-semibold text-white mb-1">Welcome to KyronMed</motion.h2>
      <motion.p initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}
        className="text-[12px] text-slate-400 mb-6 text-center">Tell us a bit about yourself so Kyra can assist you.</motion.p>

      <motion.form onSubmit={handleSubmit} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
        className="w-full max-w-xs space-y-3">

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-[10px] text-slate-500 mb-1 ml-1">First Name</label>
            <div className="relative">
              <User size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input ref={firstRef} type="text" value={form.firstName} onChange={update('firstName')}
                placeholder="First" className={`${inputClass('firstName')} pl-8`} />
            </div>
            {errors.firstName && <p className="text-red-400 text-[10px] mt-0.5 ml-1">{errors.firstName}</p>}
          </div>
          <div className="flex-1">
            <label className="block text-[10px] text-slate-500 mb-1 ml-1">Last Name</label>
            <input type="text" value={form.lastName} onChange={update('lastName')}
              placeholder="Last" className={inputClass('lastName')} />
            {errors.lastName && <p className="text-red-400 text-[10px] mt-0.5 ml-1">{errors.lastName}</p>}
          </div>
        </div>

        <div>
          <label className="block text-[10px] text-slate-500 mb-1 ml-1">Phone Number</label>
          <div className="relative">
            <PhoneIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="tel" value={form.phone} onChange={update('phone')}
              placeholder="(555) 123-4567" className={`${inputClass('phone')} pl-8`} />
          </div>
          {errors.phone && <p className="text-red-400 text-[10px] mt-0.5 ml-1">{errors.phone}</p>}
        </div>

        <div>
          <label className="block text-[10px] text-slate-500 mb-1 ml-1">
            <Calendar size={10} className="inline mr-1 -mt-px" />Date of Birth
          </label>
          <div className="flex gap-2">
            <GlassSelect
              className="flex-[1.3]"
              placeholder="Month"
              value={form.dob ? form.dob.split('-')[1] : ''}
              hasError={!!errors.dob}
              options={MONTHS}
              onChange={(v) => {
                const [y, , d] = (form.dob || '--').split('-');
                setForm(f => ({ ...f, dob: `${y || ''}-${v}-${d || ''}` }));
                setErrors(er => ({ ...er, dob: '' }));
              }}
            />
            <GlassSelect
              className="flex-[0.9]"
              placeholder="Day"
              value={form.dob ? form.dob.split('-')[2] : ''}
              hasError={!!errors.dob}
              options={DAYS}
              onChange={(v) => {
                const [y, m] = (form.dob || '--').split('-');
                setForm(f => ({ ...f, dob: `${y || ''}-${m || ''}-${v}` }));
                setErrors(er => ({ ...er, dob: '' }));
              }}
            />
            <GlassSelect
              className="flex-[1.1]"
              placeholder="Year"
              value={form.dob ? form.dob.split('-')[0] : ''}
              hasError={!!errors.dob}
              options={YEARS}
              onChange={(v) => {
                const [, m, d] = (form.dob || '--').split('-');
                setForm(f => ({ ...f, dob: `${v}-${m || ''}-${d || ''}` }));
                setErrors(er => ({ ...er, dob: '' }));
              }}
            />
          </div>
          {errors.dob && <p className="text-red-400 text-[10px] mt-0.5 ml-1">{errors.dob}</p>}
        </div>

        <div>
          <label className="block text-[10px] text-slate-500 mb-1 ml-1">Email Address</label>
          <div className="relative">
            <Mail size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="email" value={form.email} onChange={update('email')}
              placeholder="you@email.com" className={`${inputClass('email')} pl-8`} />
          </div>
          {errors.email && <p className="text-red-400 text-[10px] mt-0.5 ml-1">{errors.email}</p>}
        </div>

        <motion.button
          type="submit"
          className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                     bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-[14px] font-medium
                     hover:opacity-90 transition-opacity"
        >
          Start Chatting with Kyra
          <ArrowRight size={14} />
        </motion.button>
      </motion.form>

      <p className="text-[10px] text-slate-600 mt-4 text-center">
        Your info stays private and helps us serve you faster — by chat or voice.
      </p>
    </div>
  );
}

// ─── Main Chat Widget ─────────────────────────────────────────────
export default function ChatWidget() {
  const [authStage, setAuthStage] = useState(hasSession() ? 'ready' : 'intake'); // intake | ready
  const { messages, isLoading, sessionState, send, clearChat, dismissMessage } = useChat();
  const vapiState = useVapi();
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const isFirstMessage = messages.length <= 1;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (authStage === 'ready') inputRef.current?.focus();
  }, [authStage]);

  const handleIntakeSubmit = async (form) => {
    setSessionFromPhone(form.phone);
    localStorage.setItem('kyronmed-firstName', form.firstName);
    try {
      await registerPatient({
        firstName: form.firstName,
        lastName:  form.lastName,
        name:  `${form.firstName} ${form.lastName}`,
        phone: form.phone.replace(/\D/g, ''),
        email: form.email,
        dob:   form.dob,
      });
    } catch (e) {
      console.warn('Could not pre-register patient:', e);
    }
    setAuthStage('ready');
  };

  const handleReset = () => {
    resetSession();
    clearChat();
    setAuthStage('intake');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      send(input);
      setInput('');
    }
  };

  const handleQuickPrompt = (text) => {
    if (!isLoading) send(text);
  };

  if (authStage === 'intake') {
    return (
      <div className="liquid-glass-frame w-full max-w-lg">
        <GlassCard variant="strong" className="flex flex-col h-[700px] overflow-hidden card-pulse-glow hud-corners" animate={false}>
          <IntakeForm onSubmit={handleIntakeSubmit} />
        </GlassCard>
      </div>
    );
  }

  return (
    <>
      <VoiceOverlay
        isActive={vapiState.callState === 'active'}
        volumeLevel={vapiState.volumeLevel}
        isMuted={vapiState.isMuted}
        transcript={vapiState.transcript}
        callDuration={vapiState.callDuration}
        onEndCall={vapiState.endCall}
        onToggleMute={vapiState.toggleMute}
      />

      <div className="liquid-glass-frame w-full max-w-lg">
        <GlassCard variant="strong" className="flex flex-col h-[700px] overflow-hidden card-pulse-glow hud-corners" animate={false}>
        {/* ── Header ─────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] scanline-overlay">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg shadow-blue-900/30">
                <KyraAvatar size={36} />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 border-[2px] border-[#0c1929] rounded-full">
                <StatusPulse size={10} />
              </div>
            </div>
            <div>
              <h2 className="text-[13px] font-semibold text-white leading-tight">Kyra</h2>
              <p className="text-[11px] text-slate-500 leading-tight">KyronMed Patient Assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <CallButton vapiState={vapiState} />
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.90 }}
              onClick={handleReset}
              title="Exit session"
              className="h-7 px-2.5 rounded-full flex items-center justify-center gap-1
                         bg-red-500/10 border border-red-500/20 text-red-400
                         hover:bg-red-500/20 hover:text-red-300 transition-all text-[11px]"
            >
              <LogOut size={13} />
              <span>Exit</span>
            </motion.button>
          </div>
        </div>

        {/* ── Messages ───────────────────────── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto chat-scroll px-5 py-4 space-y-3">
          {messages.filter(m => !m.dismissed).map((msg, i, arr) => {

            if (msg.type === 'slot_picker') {
              return (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <SlotPicker
                    doctorId={msg.doctorId}
                    doctorName={msg.doctorName}
                    onSelect={(slot) => {
                      dismissMessage(msg.id);
                      const h = parseInt(slot.time.split(':')[0]);
                      const m2 = slot.time.split(':')[1];
                      const ampm = h >= 12 ? 'PM' : 'AM';
                      const hour = h % 12 || 12;
                      const pretty = `${hour}:${m2} ${ampm}`;
                      const d = new Date(slot.date + 'T00:00:00');
                      const prettyDate = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
                      send(`I'll take the ${pretty} slot on ${prettyDate}`);
                    }}
                    onCancel={() => {
                      dismissMessage(msg.id);
                      send("I'd like to see a different doctor");
                    }}
                  />
                </motion.div>
              );
            }

            if (msg.type === 'booking_confirm') {
              return (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <BookingConfirm booking={msg.booking} />
                </motion.div>
              );
            }

            return <ChatMessage key={msg.id} message={msg} isLast={i === arr.length - 1} />;
          })}

          <AnimatePresence>
            {isFirstMessage && !isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="flex flex-wrap gap-2 pt-2 pl-9"
              >
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => handleQuickPrompt(p.text)}
                    className="px-3 py-1.5 rounded-full text-[11px] text-slate-400 border border-white/[0.07]
                               bg-white/[0.03] hover:bg-white/[0.06] hover:text-slate-200 transition-all"
                  >
                    {p.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Input ──────────────────────────── */}
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isLoading ? 'Kyra is thinking...' : 'Type your message...'}
                disabled={isLoading}
                maxLength={1000}
                className="w-full glass-input rounded-xl px-4 py-2.5 pr-10 text-[13px] text-white placeholder-slate-500 disabled:opacity-40"
              />
              {input.length > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-600">
                  {input.length}/1000
                </span>
              )}
            </div>
            <SendButton hasText={!!input.trim()} loading={isLoading} />
          </form>

          <div className="flex items-center justify-between mt-2 px-1">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
              <MessageSquare size={10} />
              <span>{messages.length - 1} messages</span>
            </div>
            {isLoading && (
              <div className="flex items-center gap-1 text-[10px] text-blue-400/60">
                <div className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
                <span>Processing</span>
              </div>
            )}
          </div>
        </div>
        </GlassCard>
      </div>
    </>
  );
}
