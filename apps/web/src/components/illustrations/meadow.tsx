// Ilustrasi padang (bukit, kandang, pohon, sapi, matahari, awan) untuk mengisi ruang kosong.
// Bergerak pelan dan jarang (awan bergeser, matahari berdenyut, sapi menunduk merumput).
// Animasi otomatis berhenti bila HP disetel "kurangi gerakan" (MotionConfig di main.tsx).
// Murni hiasan: aria-hidden; teks penjelas selalu ada di luar ilustrasi.
import { motion } from 'motion/react';

import { cn } from '@/lib/utils';

export function Meadow({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 360 150"
      preserveAspectRatio="xMidYMax slice"
      className={cn('block w-full', className)}
    >
      {/* matahari */}
      <motion.circle
        cx="288"
        cy="44"
        r="20"
        fill="var(--straw)"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '288px 44px' }}
      />
      {/* awan */}
      <motion.g
        fill="#ffffff"
        animate={{ x: [0, 22, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ellipse cx="70" cy="34" rx="26" ry="10" />
        <ellipse cx="88" cy="28" rx="18" ry="11" />
        <ellipse cx="190" cy="22" rx="20" ry="7" opacity="0.85" />
      </motion.g>
      {/* bukit */}
      <path d="M0 110 C60 78 120 86 180 98 S300 82 360 92 V150 H0Z" fill="var(--hill-back)" />
      <path d="M0 128 C80 104 170 112 240 120 S330 112 360 116 V150 H0Z" fill="var(--hill-front)" />
      {/* kandang */}
      <g transform="translate(46 78)">
        <path d="M0 18 L18 4 L36 18 V40 H0Z" fill="var(--barn)" />
        <path
          d="M-3 19 L18 2 L39 19"
          fill="none"
          stroke="var(--barn-roof)"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <rect x="12" y="24" width="12" height="16" fill="#ffffff" opacity="0.9" />
        <path d="M12 24 L24 40 M24 24 L12 40" stroke="var(--barn)" strokeWidth="1.5" />
      </g>
      {/* pohon */}
      <g transform="translate(118 70)">
        <rect x="9" y="22" width="5" height="22" rx="2" fill="var(--soil)" />
        <motion.circle
          cx="11.5"
          cy="16"
          r="16"
          fill="var(--tree)"
          animate={{ rotate: [0, 1.5, 0, -1.5, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '11.5px 40px' }}
        />
      </g>
      {/* sapi */}
      <g transform="translate(222 92)">
        <rect
          x="0"
          y="6"
          width="34"
          height="16"
          rx="7"
          fill="#ffffff"
          stroke="var(--ink)"
          strokeWidth="1.5"
        />
        <path d="M8 7 c3 4 9 4 11 0" fill="var(--ink)" opacity="0.85" />
        <ellipse cx="24" cy="15" rx="5" ry="4" fill="var(--ink)" opacity="0.85" />
        <path
          d="M5 21 v9 M12 21 v9 M24 21 v9 M30 21 v9"
          stroke="var(--ink)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <motion.g
          animate={{ rotate: [0, 0, 24, 24, 0] }}
          transition={{ duration: 6, repeat: Infinity, times: [0, 0.55, 0.65, 0.9, 1] }}
          style={{ transformOrigin: '34px 10px' }}
        >
          <rect
            x="32"
            y="2"
            width="13"
            height="11"
            rx="4"
            fill="#ffffff"
            stroke="var(--ink)"
            strokeWidth="1.5"
          />
          <rect
            x="38"
            y="8"
            width="8"
            height="6"
            rx="3"
            fill="#f2c4b8"
            stroke="var(--ink)"
            strokeWidth="1.2"
          />
          <path
            d="M33 3 l-3 -3 M44 3 l3 -3"
            stroke="var(--ink)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </motion.g>
      </g>
      {/* rumput */}
      <g stroke="var(--tree)" strokeWidth="2" strokeLinecap="round" opacity="0.7">
        <path d="M190 140 l2 -8 M196 140 l-1 -9 M300 136 l2 -7 M306 136 l-1 -8 M20 142 l2 -8" />
      </g>
    </svg>
  );
}
