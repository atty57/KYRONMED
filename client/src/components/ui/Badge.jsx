const styles = {
  default: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  error: 'bg-red-500/10 text-red-300 border-red-500/20',
  info: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
};

export default function Badge({ children, variant = 'default', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
}
