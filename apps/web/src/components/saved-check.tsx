// Centang yang "tergambar" sekali saat catatan tersimpan (diam bila "kurangi gerakan").
import { motion } from 'motion/react';

export function SavedCheck({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
      <motion.path
        d="m8 12.5 2.8 2.8L16.5 9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, delay: 0.35, ease: 'easeOut' }}
      />
    </svg>
  );
}
