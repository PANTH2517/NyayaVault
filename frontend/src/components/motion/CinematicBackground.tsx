import React from 'react';
import { motion } from 'framer-motion';

export const CinematicBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none bg-[#060911]">
      {/* Subtle Restrained Ambient Depth Spheres */}
      <motion.div
        animate={{
          opacity: [0.15, 0.25, 0.15],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute -top-40 left-1/3 w-[600px] h-[600px] rounded-full bg-slate-800/30 blur-[120px]"
      />

      <motion.div
        animate={{
          opacity: [0.03, 0.08, 0.03],
          scale: [1, 1.08, 1],
        }}
        transition={{
          duration: 16,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute top-1/4 -right-40 w-[500px] h-[500px] rounded-full bg-amber-500/10 blur-[140px]"
      />

      {/* Structured Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />
    </div>
  );
};
