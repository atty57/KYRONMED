import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import KyraAvatar from './ui/KyraAvatar.jsx';
import { MicIcon, MicOffIcon, HangUpIcon } from './ui/CallIcons.jsx';

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Animated ring visualizer that pulses with volume */
function VoiceRings({ level, isMuted }) {
  const rings = [1, 0.7, 0.4];
  return (
    <div className="relative w-28 h-28 flex items-center justify-center">
      {rings.map((baseOpacity, i) => {
        const scale = 1 + (isMuted ? 0 : level * 0.3 * (i + 1));
        const opacity = isMuted ? 0.1 : baseOpacity * (0.15 + level * 0.2);
        return (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full border-2 border-emerald-400"
            animate={{ scale, opacity }}
            transition={{ duration: 0.15 }}
          />
        );
      })}
      <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg shadow-blue-900/40 z-10">
        <KyraAvatar size={64} />
      </div>
    </div>
  );
}

export default function VoiceOverlay({
  isActive,
  volumeLevel,
  isMuted,
  transcript,
  callDuration,
  onEndCall,
  onToggleMute,
}) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: 'rgba(6, 14, 26, 0.95)', backdropFilter: 'blur(20px)' }}
        >
          {/* Voice visualizer */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            className="mb-8"
          >
            <VoiceRings level={volumeLevel} isMuted={isMuted} />
          </motion.div>

          {/* Status */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-6"
          >
            <h2 className="text-lg font-semibold text-white">Kyra</h2>
            <p className="text-sm text-slate-400 mt-0.5">KyronMed Voice Assistant</p>
            <p className="text-xs text-emerald-400/80 font-mono mt-2 tabular-nums">
              {formatDuration(callDuration)}
            </p>
          </motion.div>

          {/* Live transcript */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="w-full max-w-sm mb-8"
          >
            <div
              ref={scrollRef}
              className="glass-light rounded-xl max-h-48 overflow-y-auto chat-scroll p-4 space-y-2"
            >
              {transcript.length === 0 ? (
                <p className="text-center text-slate-500 text-xs">
                  {isMuted ? 'You are muted' : 'Listening...'}
                </p>
              ) : (
                transcript.map((entry, i) => (
                  <div
                    key={i}
                    className={`text-[12px] leading-relaxed ${
                      entry.role === 'assistant'
                        ? 'text-blue-300'
                        : 'text-slate-300'
                    }`}
                  >
                    <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 mr-1.5">
                      {entry.role === 'assistant' ? 'Kyra' : 'You'}:
                    </span>
                    {entry.text}
                  </div>
                ))
              )}
            </div>
          </motion.div>

          {/* Controls */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-4"
          >
            <button
              onClick={onToggleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                isMuted
                  ? 'bg-red-500/20 border border-red-500/30 text-red-400'
                  : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {isMuted ? <MicOffIcon size={20} /> : <MicIcon size={20} active={!isMuted} />}
            </button>

            <button
              onClick={onEndCall}
              className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center
                         hover:bg-red-500 transition-colors shadow-lg shadow-red-900/40 text-white"
            >
              <HangUpIcon size={22} />
            </button>
          </motion.div>

          {/* Footer hint */}
          <p className="text-[10px] text-slate-600 mt-8">
            Press the red button to end the call
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
