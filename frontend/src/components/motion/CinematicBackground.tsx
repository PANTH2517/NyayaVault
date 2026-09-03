import React, { useEffect, useRef } from 'react';

export const CinematicBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Check reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // 15-20 ultra-subtle nodes for optimal performance across all devices
    const nodeCount = Math.min(Math.floor(width / 90), 18);
    const nodes = Array.from({ length: nodeCount }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      radius: Math.random() * 1.5 + 1,
      alpha: Math.random() * 0.3 + 0.1,
    }));

    const render = () => {
      // Pause rendering if document is hidden to save GPU/battery
      if (document.visibilityState === 'hidden') {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Draw faint connections between nearby nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 180) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(245, 158, 11, ${0.06 * (1 - dist / 180)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Update & draw nodes
      nodes.forEach((node) => {
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245, 158, 11, ${node.alpha})`;
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(245, 158, 11, 0.4)';
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {/* Deep Atmospheric Base Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-br from-amber-500/5 via-indigo-950/10 to-transparent blur-3xl animate-pulse duration-[12000ms]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-tl from-sky-500/5 via-slate-950/20 to-transparent blur-3xl animate-pulse duration-[15000ms]" />

      {/* Technical Grid Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* Subtle Laser Scan Line Sweep */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent animate-scan-sweep opacity-70" />

      {/* Ambient Particle Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60" />
    </div>
  );
};
