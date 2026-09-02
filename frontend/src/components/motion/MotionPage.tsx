import React from 'react';

interface MotionPageProps {
  children: React.ReactNode;
  className?: string;
  viewKey?: string;
}

export const MotionPage: React.FC<MotionPageProps> = ({
  children,
  className = '',
  viewKey,
}) => {
  return (
    <div
      key={viewKey}
      className={`animate-fade-in-up gpu-accelerate w-full ${className}`}
    >
      {children}
    </div>
  );
};
