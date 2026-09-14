import React from 'react';
import { motion } from 'framer-motion';

const paths = [
  ['8vw', '18vh', 540], ['24vw', '72vh', -420], ['42vw', '28vh', 610],
  ['60vw', '68vh', -560], ['78vw', '22vh', 470], ['90vw', '62vh', -650],
];

export default function DiceSpillOverlay({ active }) {
  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden="true">
      {paths.map(([x, y, rotate], index) => (
        <motion.span key={index} className="absolute text-4xl drop-shadow-2xl"
          initial={{ left: '50vw', top: '45vh', scale: 0.25, rotate: 0, opacity: 0 }}
          animate={{ left: x, top: y, scale: [0.25, 1.3, 0.9], rotate, opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.9, delay: index * 0.06, ease: 'easeOut' }}>🎲</motion.span>
      ))}
    </div>
  );
}