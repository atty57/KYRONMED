import { motion } from 'framer-motion';

const variantStyles = {
  default: 'glass',
  light: 'glass-light',
  strong: 'glass-strong',
};

export default function GlassCard({
  children,
  className = '',
  variant = 'default',
  animate = true,
  delay = 0,
  ...props
}) {
  if (!animate) {
    return (
      <div className={`${variantStyles[variant]} rounded-2xl ${className}`} {...props}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`${variantStyles[variant]} rounded-2xl ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}
