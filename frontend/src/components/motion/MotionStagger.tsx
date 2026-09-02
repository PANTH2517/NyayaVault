import React from 'react';

interface MotionStaggerProps {
  children: React.ReactNode;
  className?: string;
  staggerMs?: number;
}

export const MotionStagger: React.FC<MotionStaggerProps> = ({
  children,
  className = '',
  staggerMs = 40,
}) => {
  const childrenArray = React.Children.toArray(children);

  return (
    <div className={className}>
      {childrenArray.map((child, index) => {
        if (!React.isValidElement(child)) return child;

        return (
          <div
            key={child.key ?? index}
            className="animate-fade-in-up gpu-accelerate"
            style={{
              animationDelay: `${index * staggerMs}ms`,
              animationFillMode: 'both',
            }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
};
