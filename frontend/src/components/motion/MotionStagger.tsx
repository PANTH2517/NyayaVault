import React from 'react';
import { motion, Variants } from 'framer-motion';

interface MotionStaggerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
  staggerMs?: number;
}

export const MotionStagger: React.FC<MotionStaggerProps> = ({
  children,
  className = '',
  staggerDelay = 0.06,
  staggerMs,
}) => {
  const actualDelay = staggerMs !== undefined ? staggerMs / 1000 : staggerDelay;

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: actualDelay,
        delayChildren: 0.05,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  );
};

export const MotionStaggerItem: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 14, scale: 0.98 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.35,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return <motion.div variants={itemVariants} className={className}>{children}</motion.div>;
};
