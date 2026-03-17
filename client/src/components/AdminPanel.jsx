import { useState, useEffect, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Calendar, Users, Clock, Loader2, ChevronDown, ChevronUp, Activity } from 'lucide-react';
import GlassCard from './ui/GlassCard.jsx';
import Badge from './ui/Badge.jsx';
import { API_BASE } from '../lib/constants.js';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function AssessmentCard({ assessment }) {
  if (!assessment) return null;
  const fields = [
    { label: 'Chief Complaint', value: assessment.chiefComplaint },
    { label: 'Location', value: assessment.location },
    { label: 'Severity', value: assessment.severity ? `${assessment.severity}/10` : null },
    { label: 'Duration', value: assessment.duration },
    { label: 'Onset', value: assessment.onset },
    { label: 'Aggravating Factors', value: assessment.aggravatingFactors },
    { label: 'Relieving Factors', value: assessment.relievingFactors },
    { label: 'Additional Symptoms', value: assessment.additionalSymptoms },
  ].filter(f => f.value);

  return (
    <div className="mt-2 p-3 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/[0.15]">
      <div className="flex items-center gap-1.5 mb-2">
        <Activity size={12} className="text-emerald-400" />
        <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wide">Pre-Visit Assessment</span>
      </div>
      {assessment.summary && (
        <p className="text-[12px] text-slate-300 mb-2 italic">"{assessment.summary}"</p>
      )}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {fields.map(f => (
          <div key={f.label}>
            <span className="text-[10px] text-slate-500">{f.label}: </span>
            <span className="text-[11px] text-slate-300">{f.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem('admin-key'));
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const adminKey = () => sessionStorage.getItem('admin-key');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        sessionStorage.setItem('admin-key', password);
        setAuthed(true);
      } else {
        setLoginError('Invalid password');
      }
    } catch {
      setLoginError('Connection error');
    }
  };

  const fetchAppointments = () => {
    setLoading(true);
    fetch(`${API_BASE}/api/admin/appointments`, {
      headers: { 'x-admin-key': adminKey() },
    })
      .then(r => { if (r.status === 401) { setAuthed(false); sessionStorage.removeItem('admin-key'); } return r.json(); })
      .then(data => setAppointments(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!authed) return;

    fetchAppointments();

    // Auto-poll every 30 s
    const interval = setInterval(fetchAppointments, 30_000);

    // Instant refresh when the chat widget confirms a booking (same-page event)
    const onBooking = () => fetchAppointments();
    window.addEventListener('kyronmed:booking-confirmed', onBooking);

    return () => {
      clearInterval(interval);
      window.removeEventListener('kyronmed:booking-confirmed', onBooking);
    };
  }, [authed]);

  const cancelAppointment = async (sessionId) => {
    if (!window.confirm('Cancel this appointment? The slot will be released.')) return;
    setCancellingId(sessionId);
    try {
      await fetch(`${API_BASE}/api/admin/appointments/${sessionId}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminKey() },
      });
      fetchAppointments();
    } catch (err) {
      console.error(err);
    } finally {
      setCancellingId(null);
    }
  };

  if (!authed) {
    return (
      <GlassCard className="p-6 max-w-xs mx-auto" delay={0.1}>
        <h3 className="text-[15px] font-semibold text-white mb-4 text-center">Admin Login</h3>
        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
            className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-white text-[13px]
                       placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors"
            autoFocus
          />
          {loginError && <p className="text-red-400 text-[11px]">{loginError}</p>}
          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-blue-600/30 border border-blue-500/25 text-blue-300 text-[13px]
                       font-medium hover:bg-blue-600/40 transition-all"
          >
            Login
          </button>
        </form>
      </GlassCard>
    );
  }

  const confirmed = appointments.filter(a => a.booking?.status !== 'cancelled');
  const stats = {
    total: confirmed.length,
    today: confirmed.filter(a => a.booking?.date === new Date().toISOString().split('T')[0]).length,
    upcoming: confirmed.filter(a => a.booking?.date > new Date().toISOString().split('T')[0]).length,
  };

  return (
    <div className="space-y-4 w-full max-w-2xl mx-auto">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Booked', value: stats.total, icon: Calendar, color: 'text-blue-400' },
          { label: 'Today', value: stats.today, icon: Clock, color: 'text-emerald-400' },
          { label: 'Upcoming', value: stats.upcoming, icon: Users, color: 'text-violet-400' },
        ].map((stat, i) => (
          <GlassCard key={stat.label} className="p-4" delay={i * 0.1}>
            <div className="flex items-center gap-2 mb-2">
              <stat.icon size={14} className={stat.color} />
              <span className="text-[11px] text-slate-500 uppercase tracking-wide">{stat.label}</span>
            </div>
            <p className="text-2xl font-semibold text-white">{stat.value}</p>
          </GlassCard>
        ))}
      </div>

      {/* Table */}
      <GlassCard className="overflow-hidden" delay={0.3}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <h3 className="text-[13px] font-semibold text-white">Appointments</h3>
          <button
            onClick={fetchAppointments}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] text-slate-400
                       hover:text-white hover:bg-white/[0.05] transition-all disabled:opacity-40"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Refresh
          </button>
        </div>

        {appointments.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            {loading ? 'Loading...' : 'No appointments yet. Book one through the chat!'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full admin-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((apt, i) => (
                  <Fragment key={apt.sessionId || i}>
                    <motion.tr
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                      className="cursor-pointer hover:bg-white/[0.02]"
                    >
                      <td>
                        <div>
                          <p className="font-medium text-white text-[13px]">{apt.patient?.name || 'Unknown'}</p>
                          <p className="text-[11px] text-slate-500">{apt.patient?.email || ''}</p>
                          {apt.patient?.phone && (
                            <p className="text-[11px] text-slate-600">{apt.patient.phone}</p>
                          )}
                        </div>
                      </td>
                      <td>
                        <div>
                          <p className="text-[13px]">{apt.doctor?.name || '—'}</p>
                          <p className="text-[11px] text-slate-500">{apt.doctor?.specialty || ''}</p>
                        </div>
                      </td>
                      <td>{formatDate(apt.booking?.date)}</td>
                      <td>{formatTime(apt.booking?.time)}</td>
                      <td>
                        <span className="text-[12px] text-slate-400">
                          {apt.symptomAssessment?.chiefComplaint || apt.patient?.reason || '—'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant={apt.booking?.status === 'confirmed' ? 'success' : 'warning'}>
                            {apt.booking?.status || 'pending'}
                          </Badge>
                          {apt.symptomAssessment && (
                            expandedRow === i
                              ? <ChevronUp size={12} className="text-slate-500" />
                              : <ChevronDown size={12} className="text-slate-500" />
                          )}
                          {apt.booking?.status === 'confirmed' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); cancelAppointment(apt.sessionId); }}
                              disabled={cancellingId === apt.sessionId}
                              className="px-1.5 py-0.5 rounded text-[10px] text-red-400 border border-red-400/30
                                         hover:bg-red-500/10 transition-all disabled:opacity-40"
                            >
                              {cancellingId === apt.sessionId ? '…' : 'Cancel'}
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                    {expandedRow === i && apt.symptomAssessment && (
                      <tr key={`${apt.sessionId}-detail`}>
                        <td colSpan={6} className="p-0">
                          <AnimatePresence>
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="px-4 pb-3"
                            >
                              <AssessmentCard assessment={apt.symptomAssessment} />
                            </motion.div>
                          </AnimatePresence>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
