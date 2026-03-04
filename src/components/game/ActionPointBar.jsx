import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

export default function ActionPointBar({ actionsTotal, actionsUsed, bonusActionUsed, reactionUsed }) {
  const actionsRemaining = Math.max(0, actionsTotal - actionsUsed);

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg"
      style={{ background: 'rgba(10,8,3,0.6)', border: '1px solid rgba(180,140,90,0.1)' }}>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <Zap className="w-3 h-3" style={{ color: 'rgba(240,192,64,0.5)' }} />
        <span className="font-fantasy text-xs" style={{ color: 'rgba(180,140,90,0.4)', fontSize: '0.6rem' }}>ACT</span>
        <div className="flex gap-1">
          {Array.from({ length: actionsTotal }).map((_, i) => (
            <motion.div
              key={i}
              animate={i < actionsRemaining ? {
                boxShadow: ['0 0 4px rgba(240,192,64,0.3)', '0 0 10px rgba(240,192,64,0.6)', '0 0 4px rgba(240,192,64,0.3)']
              } : {}}
              transition={{ repeat: Infinity, duration: 2, delay: i * 0.3 }}
              className="w-4 h-4 rounded-full"
              style={i < actionsRemaining ? {
                background: 'radial-gradient(circle, #f0c040, #c9a96e)',
                border: '1px solid rgba(240,192,64,0.8)',
                boxShadow: '0 0 6px rgba(240,192,64,0.4)'
              } : {
                background: 'rgba(30,20,5,0.8)',
                border: '1px solid rgba(100,70,20,0.3)'
              }}
            />
          ))}
        </div>
        <span className="font-fantasy text-xs font-bold" style={{ color: actionsRemaining > 0 ? '#f0c040' : 'rgba(100,80,30,0.4)', fontSize: '0.65rem' }}>
          {actionsRemaining}/{actionsTotal}
        </span>
      </div>

      {/* Bonus Action */}
      <div className="flex items-center gap-1">
        <span className="font-fantasy text-xs" style={{ color: 'rgba(130,100,200,0.4)', fontSize: '0.6rem' }}>BONUS</span>
        <div className="w-3.5 h-3.5 rounded-sm rotate-45"
          style={!bonusActionUsed ? {
            background: 'rgba(120,80,220,0.7)',
            border: '1px solid rgba(160,100,255,0.6)',
            boxShadow: '0 0 6px rgba(130,60,220,0.3)'
          } : {
            background: 'rgba(20,15,35,0.8)',
            border: '1px solid rgba(80,50,120,0.2)'
          }} />
      </div>

      {/* Reaction */}
      <div className="flex items-center gap-1">
        <span className="font-fantasy text-xs" style={{ color: 'rgba(100,180,100,0.4)', fontSize: '0.6rem' }}>REACT</span>
        <div className="w-3.5 h-3.5 rounded-full"
          style={!reactionUsed ? {
            background: 'rgba(40,160,80,0.7)',
            border: '1px solid rgba(60,200,100,0.5)',
            boxShadow: '0 0 6px rgba(40,160,80,0.3)'
          } : {
            background: 'rgba(10,30,15,0.8)',
            border: '1px solid rgba(30,80,40,0.2)'
          }} />
      </div>

      {/* Movement label */}
      <div className="ml-auto">
        <span className="font-fantasy text-xs" style={{ color: 'rgba(100,140,200,0.4)', fontSize: '0.6rem' }}>
          {actionsRemaining === 0 ? '⏳ End Turn' : '🎯 Choose Action'}
        </span>
      </div>
    </div>
  );
}