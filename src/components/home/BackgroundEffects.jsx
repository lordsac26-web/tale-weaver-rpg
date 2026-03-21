import React, { useEffect, useRef, useState } from 'react';

// Canvas-based particle system for magical dust motes / sparks
function ParticleCanvas({ enabled }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particlesRef = useRef([]);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Reduce particle count on mobile for better performance
    const isMobile = window.innerWidth < 768;
    const COUNT = isMobile ? 25 : 60;
    particlesRef.current = Array.from({ length: COUNT }, () => createParticle(canvas));

    const animate = () => {
      // Skip rendering when tab is not visible to save battery/CPU on mobile
      if (document.hidden) { animRef.current = requestAnimationFrame(animate); return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current.forEach((p, i) => {
        p.y -= p.vy;
        p.x += p.vx;
        p.life -= p.decay;
        p.angle += p.spin;

        if (p.life <= 0 || p.y < -20) {
          particlesRef.current[i] = createParticle(canvas, true);
          return;
        }

        const alpha = Math.min(p.life, 1) * p.opacity;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

        if (p.type === 'spark') {
          // Tiny diamond spark
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size * 0.4, 0);
          ctx.lineTo(0, p.size);
          ctx.lineTo(-p.size * 0.4, 0);
          ctx.closePath();
          ctx.fill();
        } else {
          // Soft dust mote
          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
          grad.addColorStop(0, p.color);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.55 }}
    />
  );
}

function createParticle(canvas, fromBottom = false) {
  const colors = [
    'rgba(201,169,110,0.9)',
    'rgba(240,192,64,0.9)',
    'rgba(180,140,220,0.8)',
    'rgba(255,255,255,0.7)',
    'rgba(160,100,255,0.7)',
  ];
  const isSpark = Math.random() < 0.35;
  return {
    x: Math.random() * (canvas?.width || window.innerWidth),
    y: fromBottom ? (canvas?.height || window.innerHeight) + 10 : Math.random() * (canvas?.height || window.innerHeight),
    vx: (Math.random() - 0.5) * 0.4,
    vy: 0.15 + Math.random() * 0.5,
    size: isSpark ? 1.5 + Math.random() * 2 : 2 + Math.random() * 4,
    opacity: 0.15 + Math.random() * 0.5,
    color: colors[Math.floor(Math.random() * colors.length)],
    life: 0.5 + Math.random() * 0.5,
    decay: 0.0008 + Math.random() * 0.001,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.03,
    type: isSpark ? 'spark' : 'dust',
  };
}

// Animated shifting gradient overlay
function GradientOverlay({ enabled }) {
  if (!enabled) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 15% 40%, rgba(120,50,0,0.07) 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, rgba(100,50,150,0.06) 0%, transparent 50%), radial-gradient(ellipse at 60% 80%, rgba(80,30,120,0.05) 0%, transparent 50%)',
          animation: 'gradientShift 18s ease-in-out infinite alternate',
        }}
      />
      <style>{`
        @keyframes gradientShift {
          0%   { opacity: 0.6; transform: scale(1) translateY(0px); }
          33%  { opacity: 0.9; transform: scale(1.04) translateY(-8px); }
          66%  { opacity: 0.7; transform: scale(0.98) translateY(4px); }
          100% { opacity: 1;   transform: scale(1.02) translateY(-4px); }
        }
      `}</style>
    </div>
  );
}

export default function BackgroundEffects({ enabled, onToggle }) {
  return (
    <>
      <GradientOverlay enabled={enabled} />
      <ParticleCanvas enabled={enabled} />

      {/* Toggle button */}
      <button
        onClick={onToggle}
        title={enabled ? 'Disable background effects' : 'Enable background effects'}
        className="fixed bottom-4 right-4 z-20 p-2 rounded-full transition-all"
        style={{
          background: 'rgba(15,10,4,0.75)',
          border: `1px solid ${enabled ? 'rgba(201,169,110,0.4)' : 'rgba(100,80,40,0.25)'}`,
          color: enabled ? 'rgba(201,169,110,0.8)' : 'rgba(100,80,40,0.5)',
          fontSize: '0.75rem',
          fontFamily: 'Cinzel, serif',
          backdropFilter: 'blur(6px)',
          letterSpacing: '0.05em',
          boxShadow: enabled ? '0 0 12px rgba(201,169,110,0.1)' : 'none',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(201,169,110,0.6)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = enabled ? 'rgba(201,169,110,0.4)' : 'rgba(100,80,40,0.25)'}
      >
        {enabled ? '✨' : '○'}
      </button>
    </>
  );
}