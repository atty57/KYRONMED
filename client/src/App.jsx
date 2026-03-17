import { useState } from 'react';
import { motion } from 'framer-motion';
import { Stethoscope, LayoutDashboard } from 'lucide-react';
import ChatWidget from './components/ChatWidget.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import LiquidBackground from './components/LiquidBackground.jsx';
import { BRAND } from './lib/constants.js';

export default function App() {
  const [view, setView] = useState('chat'); // 'chat' | 'admin'

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* ── Liquid WebGL background ─────────── */}
      <LiquidBackground />

      {/* Ambient glows — slowly breathing, layered above liquid */}
      <div className="ambient-glow ambient-pulse-1 w-[500px] h-[500px] bg-blue-600 -top-[15%] -left-[10%]" />
      <div className="ambient-glow ambient-pulse-2 w-[400px] h-[400px] bg-cyan-500 -bottom-[15%] -right-[10%]" />
      <div className="ambient-glow ambient-pulse-3 w-[300px] h-[300px] bg-violet-600 top-[50%] right-[5%]" />

      {/* ── Header ─────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="text-center mb-6 relative z-10"
      >
        <div className="flex items-center justify-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-900/30">
            <Stethoscope size={16} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-gradient-animated">{BRAND.name}</span>
          </h1>
        </div>
        <p className="text-slate-500 text-[13px]">{BRAND.tagline}</p>

        {/* View toggle */}
        <div className="flex items-center justify-center gap-1 mt-4 p-0.5 rounded-lg glass w-fit mx-auto">
          <button
            onClick={() => setView('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
              view === 'chat'
                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Stethoscope size={12} />
            Chat
          </button>
          <button
            onClick={() => setView('admin')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
              view === 'admin'
                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LayoutDashboard size={12} />
            Admin
          </button>
        </div>
      </motion.div>

      {/* ── Main Content ───────────────────── */}
      <div className="relative z-10 w-full max-w-lg">
        {/* Keep ChatWidget mounted so it preserves state; hide with CSS */}
        <div style={{ display: view === 'chat' ? 'block' : 'none' }}>
          <ChatWidget />
        </div>
        {view === 'admin' && <AdminPanel />}
      </div>

      {/* ── Footer ─────────────────────────── */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-5 text-[11px] text-slate-700 relative z-10"
      >
        Powered by AI &middot; Not a substitute for emergency services &middot; Call 911 for emergencies
      </motion.p>
    </div>
  );
}
