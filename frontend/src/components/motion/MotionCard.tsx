import React from 'react';
import { motion } from 'framer-motion';

interface MotionCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverScale?: number;
}

export const MotionCard: React.FC<MotionCardProps> = ({
  children,
  className = '',
  onClick,
  hoverScale = 1.015,
}) => {
  return (
    <motion.div
      whileHover={{
        scale: hoverScale,
        y: -3,
        transition: { type: 'spring', stiffness: 400, damping: 25 },
      }}
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className={`gpu-accelerate ${className} ${onClick ? 'cursor-pointer' : ''}`}
    >
      {children}
    </motion.div>
  );
};
