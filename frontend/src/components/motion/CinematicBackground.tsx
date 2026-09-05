import React from 'react';

export const CinematicBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none bg-slate-950">
      {/* Subtle Restrained Ambient Depth */}
      <div className="absolute top-0 left-1/4 w-[50vw] h-[50vw] rounded-full bg-slate-900/40 blur-3xl" />
      
      {/* Subtle Enterprise Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
      />
    </div>
  );
};

