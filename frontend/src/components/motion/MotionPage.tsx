import React from 'react';
import { motion, Variants } from 'framer-motion';

interface MotionPageProps {
  children: React.ReactNode;
  className?: string;
  viewKey?: string;
}

const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 12,
    scale: 0.995,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.35,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.995,
    transition: {
      duration: 0.2,
      ease: [0.7, 0, 0.84, 0],
    },
  },
};

export const MotionPage: React.FC<MotionPageProps> = ({
  children,
  className = '',
  viewKey,
}) => {
  return (
    <motion.div
      key={viewKey}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={`w-full ${className}`}
    >
      {children}
    </motion.div>
  );
};
