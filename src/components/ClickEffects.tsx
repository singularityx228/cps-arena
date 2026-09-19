import React from 'react';

export interface ClickParticle {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
}

interface ClickEffectsProps {
  particles: ClickParticle[];
}

export const ClickEffects: React.FC<ClickEffectsProps> = ({ particles }) => {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute font-black text-sm md:text-base animate-ping select-none drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
          style={{
            left: `${p.x}px`,
            top: `${p.y}px`,
            color: p.color,
            transform: 'translate(-50%, -50%)',
            animationDuration: '600ms',
          }}
        >
          {p.text}
        </div>
      ))}
    </div>
  );
};
