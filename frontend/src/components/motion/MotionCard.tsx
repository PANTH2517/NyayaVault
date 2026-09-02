import React from 'react';

interface MotionCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  isFocused?: boolean;
}

export const MotionCard: React.FC<MotionCardProps> = ({
  children,
  className = '',
  onClick,
  disabled = false,
  isFocused = false,
}) => {
  const isInteractive = Boolean(onClick) && !disabled;

  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`
        rounded-2xl transition-all duration-standard ease-cinematic gpu-accelerate
        ${isFocused ? 'layer-focused' : 'layer-panel'}
        ${
          isInteractive
            ? 'cursor-pointer hover:-translate-y-0.5 hover:border-slate-700 active:scale-[0.985] active:translate-y-0'
            : ''
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};
