import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import {
  AIMicIcon, PhoneSmartIcon, MicIcon, MicOffIcon, HangUpIcon, ConnectSpinner,
} from './ui/CallIcons.jsx';
import { requestPhoneCall } from '../lib/api.js';

const ease = [0.25, 0.46, 0.45, 0.94];

// ── Voice activity bars ────────────────────────────────────────────
function VoiceWave({ level }) {
  return (
    <div className="flex items-center gap-[2px] h-3">
      {[0, 1, 2, 3].map((i) => {
        const h = 0.3 + level * (0.7 - Math.abs(i - 1.5) * 0.12);
        return (
          <motion.div
            key={i}
            className="w-[2px] rounded-full bg-emerald-400"
            animate={{ height: `${Math.max(3, h * 12)}px` }}
            transition={{ duration: 0.1, delay: i * 0.07 }}
          />
        );
      })}
    </div>
  );
}

function formatDuration(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── Morphing hamburger icon ────────────────────────────────────────
function HamburgerIcon({ open }) {
  const bar = `block rounded-full origin-center ${open ? 'bg-white' : 'bg-blue-400'}`;
  return (
    <div className="flex flex-col items-center justify-center gap-[4.5px] w-4 h-4 pointer-events-none">
      <motion.span
        className={`${bar} w-3.5 h-[1.5px]`}
        animate={open ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
        transition={{ duration: 0.22, ease }}
      />
      <motion.span
        className={`${bar} w-2.5 h-[1.5px]`}
        animate={open ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.15 }}
      />
      <motion.span
        className={`${bar} w-3.5 h-[1.5px]`}
        animate={open ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
        transition={{ duration: 0.22, ease }}
      />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────
export default function CallButton({ vapiState }) {
  const {
    callState, isMuted, volumeLevel, error, callDuration,
    startCall, endCall, toggleMute,
  } = vapiState;

  const [open, setOpen]           = useState(false);
  const [phoneStatus, setPhone]   = useState('idle');

  const handleCallMe = async () => {
    setPhone('calling');
    setOpen(false);
    try {
      await requestPhoneCall();
      setPhone('placed');
      setTimeout(() => setPhone('idle'), 6000);
    } catch {
      setPhone('error');
    }
  };

  const handleCallKyra = () => {
    startCall();
    setOpen(false);
  };

  // ── Active / connecting / ended / error — show inline controls ──
  if (callState !== 'idle') {
    return (
      <AnimatePresence mode="wait">
        {callState === 'connecting' && (
          <motion.div key="conn"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px]
                       bg-amber-500/10 border border-amber-500/20 text-amber-400"
          >
            <ConnectSpinner size={13} />
            <span>Connecting…</span>
          </motion.div>
        )}

        {callState === 'active' && (
          <motion.div key="active"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-1.5"
          >
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full
                            bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[12px]">
              <VoiceWave level={volumeLevel} />
              <span className="font-mono text-[11px] tabular-nums">{formatDuration(callDuration)}</span>
            </div>
            <motion.button
              onClick={toggleMute}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.90 }}
              transition={{ duration: 0.15 }}
              className={`w-7 h-7 rounded-full flex items-center justify-center border transition-colors ${
                isMuted
                  ? 'bg-red-500/15 border-red-500/25 text-red-400 hover:bg-red-500/25'
                  : 'bg-white/[0.06] border-white/[0.1] text-slate-400 hover:text-white hover:bg-white/[0.1]'
              }`}
            >
              {isMuted ? <MicOffIcon size={13} /> : <MicIcon size={13} active />}
            </motion.button>
            <motion.button
              onClick={endCall}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.90 }}
              transition={{ duration: 0.15 }}
              className="w-7 h-7 rounded-full flex items-center justify-center bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 transition-colors"
            >
              <HangUpIcon size={13} />
            </motion.button>
          </motion.div>
        )}

        {callState === 'ended' && (
          <motion.div key="ended"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="px-3 py-1.5 rounded-full text-[12px]
                       bg-slate-500/10 border border-slate-500/15 text-slate-500"
          >
            Call ended
          </motion.div>
        )}

        {callState === 'error' && (
          <motion.div key="err"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px]
                       bg-red-500/10 border border-red-500/20 text-red-400"
          >
            <AlertCircle size={13} className="flex-shrink-0" />
            <span className="truncate max-w-[130px]">{error || 'Failed'}</span>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // ── Idle — morphing hamburger FAB + dropdown ─────────────────────
  return (
    <div className="relative flex items-center gap-1.5">

      {/* Outbound phone status badge */}
      <AnimatePresence>
        {phoneStatus !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }}
            transition={{ duration: 0.2 }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] border ${
              phoneStatus === 'placed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
              phoneStatus === 'calling' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
              'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            <PhoneSmartIcon size={12} ringing={phoneStatus === 'calling'} />
            <span>
              {phoneStatus === 'placed' ? 'Call placed' :
               phoneStatus === 'calling' ? 'Calling…' : 'Failed'}
            </span>
            {phoneStatus === 'error' && (
              <button onClick={handleCallMe} className="ml-1 underline text-[11px] opacity-70 hover:opacity-100">
                Retry
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB + dropdown wrapper */}
      <div className="relative">

        {/* Click-outside backdrop */}
        {open && (
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
        )}

        {/* Dropdown */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: -6 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{    opacity: 0, scale: 0.94, y: -6 }}
              transition={{ duration: 0.18, ease }}
              className="absolute right-0 top-full mt-2 z-20 w-44
                         rounded-2xl overflow-hidden
                         bg-[#0b1727]/95 backdrop-blur-2xl
                         border border-white/[0.07]
                         shadow-2xl shadow-black/50"
            >
              {/* Call Kyra */}
              <motion.button
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.06, ease }}
                onClick={handleCallKyra}
                className="flex items-center gap-3 w-full px-4 py-3.5 text-left rounded-none group hover:bg-white/[0.04] transition-colors"
              >
                <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/20
                                flex items-center justify-center flex-shrink-0
                                group-hover:bg-emerald-500/25 transition-colors text-emerald-400">
                  <AIMicIcon size={13} />
                </div>
                <div className="leading-tight">
                  <div className="text-[13px] font-medium text-white/90">Call Kyra</div>
                  <div className="text-[10px] text-slate-500">Voice AI</div>
                </div>
              </motion.button>

              <div className="h-px bg-white/[0.05] mx-3" />

              {/* Call me */}
              <motion.button
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12, ease }}
                onClick={handleCallMe}
                className="flex items-center gap-3 w-full px-4 py-3.5 text-left rounded-none group hover:bg-white/[0.04] transition-colors"
              >
                <div className="w-7 h-7 rounded-xl bg-blue-500/15 border border-blue-500/20
                                flex items-center justify-center flex-shrink-0
                                group-hover:bg-blue-500/25 transition-colors text-blue-400">
                  <PhoneSmartIcon size={13} />
                </div>
                <div className="leading-tight">
                  <div className="text-[13px] font-medium text-white/90">Call me</div>
                  <div className="text-[10px] text-slate-500">Phone callback</div>
                </div>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The FAB button */}
        <motion.button
          onClick={() => setOpen(o => !o)}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.90 }}
          transition={{ duration: 0.15 }}
          className={`relative w-8 h-8 rounded-full flex items-center justify-center
                      border transition-colors duration-200 ${
            open
              ? 'bg-white/[0.12] border-white/25'
              : 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/18 hover:border-blue-500/35'
          }`}
        >
          <HamburgerIcon open={open} />
        </motion.button>
      </div>
    </div>
  );
}
