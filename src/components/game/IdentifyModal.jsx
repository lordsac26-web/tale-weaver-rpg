import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Sparkles, Loader2 } from 'lucide-react';

export default function IdentifyModal({ item, character, onIdentified, onClose }) {
  const [selectedSkill, setSelectedSkill] = useState('Arcana');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const skills = ['Arcana', 'Investigation'];

  const handleIdentify = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('identifyMagicItemSkillCheck', {
        character_id: character.id,
        item_id: item.id,
        skill_type: selectedSkill
      });

      setResult(response.data);

      if (response.data.success) {
        setTimeout(() => {
          onIdentified(response.data);
          onClose();
        }, 2000);
      }
    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="rounded-xl p-6 max-w-sm w-full mx-4"
        style={{ background: 'rgba(15,10,5,0.95)', border: '1px solid rgba(201,169,110,0.3)' }}>

        {!result ? (
          <>
            <h2 className="font-fantasy font-bold text-lg mb-2" style={{ color: '#f0c040' }}>
              Identify Item
            </h2>
            <p className="text-sm mb-4" style={{ color: 'rgba(201,169,110,0.7)', fontFamily: 'EB Garamond, serif' }}>
              {item.name}
            </p>

            {item.unidentified_description && (
              <p className="text-xs mb-3 p-2 rounded-lg" 
                style={{ background: 'rgba(10,6,3,0.8)', color: 'rgba(201,169,110,0.5)', fontFamily: 'EB Garamond, serif' }}>
                {item.unidentified_description}
              </p>
            )}

            <div className="mb-4">
              <label className="text-xs font-fantasy mb-2 block" style={{ color: 'rgba(180,140,90,0.6)' }}>
                Choose skill:
              </label>
              <div className="flex gap-2">
                {skills.map(skill => (
                  <button
                    key={skill}
                    onClick={() => setSelectedSkill(skill)}
                    className="flex-1 py-2 rounded-lg text-xs font-fantasy transition-all"
                    style={selectedSkill === skill ? {
                      background: 'rgba(80,50,10,0.8)',
                      border: '1px solid rgba(201,169,110,0.5)',
                      color: '#f0c040'
                    } : {
                      background: 'rgba(15,10,5,0.6)',
                      border: '1px solid rgba(180,140,90,0.2)',
                      color: 'rgba(201,169,110,0.5)'
                    }}>
                    {skill}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleIdentify}
                disabled={loading}
                className="flex-1 py-2 rounded-lg text-sm font-fantasy btn-fantasy disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loading ? 'Identifying...' : 'Attempt'}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ border: '1px solid rgba(180,140,90,0.2)', color: 'rgba(201,169,110,0.5)' }}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-center mb-4">
              {result.error ? (
                <>
                  <div className="text-lg mb-2">❌</div>
                  <h3 className="font-fantasy font-bold text-base mb-2" style={{ color: '#fca5a5' }}>
                    Failed
                  </h3>
                  <p className="text-xs" style={{ color: 'rgba(201,169,110,0.6)', fontFamily: 'EB Garamond, serif' }}>
                    {result.error}
                  </p>
                </>
              ) : result.success ? (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.6 }}
                    className="text-3xl mb-2">
                    ✨
                  </motion.div>
                  <h3 className="font-fantasy font-bold text-lg mb-2" style={{ color: '#c084fc' }}>
                    Success!
                  </h3>
                  <p className="text-sm mb-2" style={{ color: 'rgba(201,169,110,0.7)', fontFamily: 'EB Garamond, serif' }}>
                    {result.message}
                  </p>
                  <p className="text-xs" style={{ color: 'rgba(180,140,90,0.5)', fontFamily: 'EB Garamond, serif' }}>
                    Roll: {result.diceRoll} {result.skillModifier > 0 ? '+' : ''}{result.skillModifier} = {result.totalRoll} vs DC {result.dc}
                  </p>
                </>
              ) : (
                <>
                  <div className="text-3xl mb-2">❌</div>
                  <h3 className="font-fantasy font-bold text-base mb-2" style={{ color: '#fca5a5' }}>
                    Not Quite
                  </h3>
                  <p className="text-xs mb-2" style={{ color: 'rgba(201,169,110,0.6)', fontFamily: 'EB Garamond, serif' }}>
                    {result.message}
                  </p>
                  <p className="text-xs" style={{ color: 'rgba(180,140,90,0.5)', fontFamily: 'EB Garamond, serif' }}>
                    Roll: {result.diceRoll} {result.skillModifier > 0 ? '+' : ''}{result.skillModifier} = {result.totalRoll} vs DC {result.dc}
                  </p>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2 rounded-lg text-sm font-fantasy"
                style={{ background: 'rgba(80,50,10,0.7)', border: '1px solid rgba(201,169,110,0.3)', color: '#f0c040' }}>
                Close
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}