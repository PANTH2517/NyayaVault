import React, { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  className?: string;
  duration?: number;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  className = '',
}) => {
  const spring = useSpring(0, {
    mass: 0.8,
    stiffness: 75,
    damping: 15,
  });

  const display = useTransform(spring, (current) => Math.round(current));

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span className={className}>{display}</motion.span>;
};
