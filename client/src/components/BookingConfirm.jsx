import { motion } from 'framer-motion';
import { CheckCircle2, Calendar, Clock, User, Stethoscope, Mail } from 'lucide-react';
import GlassCard from './ui/GlassCard.jsx';

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function BookingConfirm({ booking }) {
  if (!booking) return null;

  return (
    <GlassCard className="p-5 space-y-4" delay={0.1}>
      {/* Success header */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className="flex flex-col items-center text-center gap-2"
      >
        <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
          <CheckCircle2 size={24} className="text-emerald-400" />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-white">Appointment Confirmed</h3>
          <p className="text-[12px] text-slate-400 mt-0.5">You'll receive a confirmation email shortly</p>
        </div>
      </motion.div>

      {/* Details card */}
      <div className="glass-light rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
            <Stethoscope size={14} className="text-blue-400" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-white">{booking.doctorName}</p>
            <p className="text-[11px] text-slate-400">{booking.specialty}</p>
          </div>
        </div>

        <div className="h-px bg-white/[0.06]" />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={13} className="text-slate-500" />
            <span className="text-[12px] text-slate-300">{formatDate(booking.date)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-slate-500" />
            <span className="text-[12px] text-slate-300">{formatTime(booking.time)}</span>
          </div>
        </div>

        {booking.patientName && (
          <>
            <div className="h-px bg-white/[0.06]" />
            <div className="flex items-center gap-2">
              <User size={13} className="text-slate-500" />
              <span className="text-[12px] text-slate-300">{booking.patientName}</span>
            </div>
          </>
        )}

        {booking.patientEmail && (
          <div className="flex items-center gap-2">
            <Mail size={13} className="text-slate-500" />
            <span className="text-[12px] text-slate-300">{booking.patientEmail}</span>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
