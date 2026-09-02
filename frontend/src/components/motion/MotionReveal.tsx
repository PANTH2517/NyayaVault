import React from 'react';

interface MotionRevealProps {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}

export const MotionReveal: React.FC<MotionRevealProps> = ({
  children,
  className = '',
  delayMs = 0,
}) => {
  return (
    <div
      className={`animate-fade-in-up gpu-accelerate ${className}`}
      style={{
        animationDelay: `${delayMs}ms`,
        animationFillMode: 'both',
      }}
    >
      {children}
    </div>
  );
};
