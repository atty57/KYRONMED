import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { getSlots } from '../lib/api.js';
import GlassCard from './ui/GlassCard.jsx';

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function SlotPicker({ doctorId, doctorName, onSelect, onCancel }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!doctorId) return;
    setLoading(true);
    getSlots(doctorId, { limit: 50 })
      .then(data => {
        setSlots(data.slots || []);
        if (data.slots?.length > 0) {
          setSelectedDate(data.slots[0].date);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [doctorId]);

  // Group slots by date
  const grouped = slots.reduce((acc, s) => {
    if (!acc[s.date]) acc[s.date] = [];
    acc[s.date].push(s);
    return acc;
  }, {});
  const dates = Object.keys(grouped);
  const visibleDates = dates.slice(page * 5, (page + 1) * 5);

  if (loading) {
    return (
      <GlassCard className="p-6 flex items-center justify-center gap-2 text-slate-400 text-sm">
        <Loader2 size={16} className="animate-spin" />
        Loading availability...
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-4 space-y-3">
      {/* Title */}
      <div className="flex items-center gap-2 text-sm text-slate-300 px-1">
        <Calendar size={14} className="text-blue-400" />
        <span>Available slots for <strong className="text-white">{doctorName}</strong></span>
      </div>

      {/* Date pills */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
          className="p-1 rounded text-slate-500 hover:text-white disabled:opacity-20 transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <div className="flex gap-1.5 flex-1 overflow-hidden">
          {visibleDates.map(date => (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className={`flex-1 py-2 px-1 rounded-lg text-center text-[11px] font-medium transition-all ${
                selectedDate === date
                  ? 'bg-blue-600/30 border border-blue-500/30 text-blue-300'
                  : 'bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
              }`}
            >
              {formatDate(date)}
            </button>
          ))}
        </div>
        <button
          onClick={() => setPage(p => Math.min(Math.ceil(dates.length / 5) - 1, p + 1))}
          disabled={page >= Math.ceil(dates.length / 5) - 1}
          className="p-1 rounded text-slate-500 hover:text-white disabled:opacity-20 transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Time slots */}
      <AnimatePresence mode="wait">
        {selectedDate && (
          <motion.div
            key={selectedDate}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-3 gap-1.5"
          >
            {(grouped[selectedDate] || []).map(slot => (
              <button
                key={slot.datetime}
                onClick={() => onSelect(slot)}
                className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg
                           bg-white/[0.03] border border-white/[0.06] text-[12px] text-slate-300
                           hover:bg-blue-600/20 hover:border-blue-500/25 hover:text-blue-300
                           transition-all duration-150"
              >
                <Clock size={11} />
                {formatTime(slot.time)}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel */}
      <button
        onClick={onCancel}
        className="w-full text-center text-[11px] text-slate-500 hover:text-slate-300 py-1 transition-colors"
      >
        Choose a different doctor
      </button>
    </GlassCard>
  );
}
