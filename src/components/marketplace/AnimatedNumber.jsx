import { useEffect } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';

// Compteur anime (solde, KPIs).
export default function AnimatedNumber({ value = 0, format = (n) => n, className = '' }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => format(Math.round(v)));

  useEffect(() => {
    const controls = animate(mv, Number(value) || 0, { duration: 0.9, ease: 'easeOut' });
    return () => controls.stop();
  }, [mv, value]);

  return <motion.span className={className}>{text}</motion.span>;
}
