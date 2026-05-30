import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Coins, Calendar, Loader2, CheckCircle, Briefcase, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const PROFESSIONS = [
  {
    name: 'Laborer',
    icon: '🔨',
    description: 'Manual labor, carrying goods, construction',
    daily_wage: { min: 2, max: 5 },
    skill: 'Strength',
    color: 'badge-gold'
  },
  {
    name: 'Craftsman',
    icon: '⚒️',
    description: 'Skilled craftwork, blacksmithing, carpentry',
    daily_wage: { min: 5, max: 10 },
    skill: 'Intelligence',
    color: 'badge-arcane'
  },
  {
    name: 'Performer',
    icon: '🎭',
    description: 'Entertainment through music, acting, storytelling',
    daily_wage: { min: 3, max: 8 },
    skill: 'Charisma',
    color: 'badge-green'
  },
  {
    name: 'Guard',
    icon: '🛡️',
    description: 'Standing watch, protecting property',
    daily_wage: { min: 4, max: 7 },
    skill: 'Constitution',
    color: 'badge-blood'
  },
  {
    name: 'Scribe',
    icon: '📜',
    description: 'Copying documents, record keeping',
    daily_wage: { min: 4, max: 8 },
    skill: 'Intelligence',
    color: 'badge-arcane'
  },
  {
    name: 'Hunter',
    icon: '🏹',
    description: 'Tracking and hunting game for market',
    daily_wage: { min: 3, max: 6 },
    skill: 'Wisdom',
    color: 'badge-green'
  },
  {
    name: 'Sailor',
    icon: '⚓',
    description: 'Ship work, docking, sailing assistance',
    daily_wage: { min: 3, max: 6 },
    skill: 'Strength',
    color: 'badge-gold'
  },
  {
    name: 'Tavern Worker',
    icon: '🍺',
    description: 'Serving drinks, cleaning, kitchen work',
    daily_wage: { min: 2, max: 4 },
    skill: 'Dexterity',
    color: 'badge-green'
  }
];

export default function ProfessionBoardModal({ character, onClose, onComplete }) {
  const [selectedProfession, setSelectedProfession] = useState(null);
  const [daysToWork, setDaysToWork] = useState(3);
  const [working, setWorking] = useState(false);
  const [workComplete, setWorkComplete] = useState(false);
  const [workResult, setWorkResult] = useState(null);

  const handleWork = async () => {
    if (!selectedProfession) return;
    
    setWorking(true);
    try {
      const result = await base44.functions.invoke('professionWork', {
        character_id: character.id,
        profession_name: selectedProfession.name,
        days: daysToWork
      });

      setWorkResult(result.data);
      setWorkComplete(true);
      toast.success(`Earned ${result.data.breakdown.gold} gp, ${result.data.breakdown.silver} sp, ${result.data.breakdown.copper} cp!`);
      
      if (onComplete) {
        onComplete(result.data);
      }
    } catch (error) {
      console.error('Work failed:', error);
      toast.error(error.message || 'Failed to complete work');
    }
    setWorking(false);
  };

  const getEstimatedEarnings = () => {
    if (!selectedProfession) return { min: 0, max: 0 };
    const min = selectedProfession.daily_wage.min * daysToWork;
    const max = selectedProfession.daily_wage.max * daysToWork;
    return { min, max };
  };

  const estimate = getEstimatedEarnings();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.92, y: 20 }}
          className="relative w-full max-w-4xl rounded-2xl overflow-hidden"
          style={{ 
            border: '1px solid rgba(201,169,110,0.3)', 
            background: 'linear-gradient(160deg, rgba(15,10,7,0.98), rgba(8,5,2,0.99))',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(180,140,90,0.12)', background: 'rgba(15,10,4,0.9)' }}>
            <div>
              <h2 className="font-fantasy text-xl" style={{ color: '#c9a96e' }}>Profession Board</h2>
              <p className="text-xs" style={{ color: 'rgba(212,149,90,0.5)', fontFamily: 'EB Garamond, serif' }}>
                {character.name} · Earn gold through honest work
              </p>
            </div>
            <button onClick={onClose} style={{ color: 'rgba(201,169,110,0.4)' }}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6" style={{ minHeight: '400px' }}>
            {workComplete && workResult ? (
              /* Work Complete Screen */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-12"
              >
                <div className="mb-6">
                  <CheckCircle className="w-20 h-20 mx-auto text-green-500 mb-4" />
                  <h3 className="font-fantasy text-2xl mb-2" style={{ color: '#f0d090' }}>Work Complete!</h3>
                  <p className="text-slate-400 mb-6">
                    You worked as a {workResult.profession} for {workResult.days_worked} days
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-8">
                  <div className="p-4 rounded-xl" style={{ background: 'rgba(184,115,51,0.15)', border: '1px solid rgba(184,115,51,0.3)' }}>
                    <div className="text-2xl font-fantasy font-bold" style={{ color: '#f0d090' }}>{workResult.breakdown.gold}</div>
                    <div className="text-xs text-slate-400">Gold Pieces</div>
                  </div>
                  <div className="p-4 rounded-xl" style={{ background: 'rgba(180,160,140,0.15)', border: '1px solid rgba(180,160,140,0.3)' }}>
                    <div className="text-2xl font-fantasy font-bold" style={{ color: '#d4c4a0' }}>{workResult.breakdown.silver}</div>
                    <div className="text-xs text-slate-400">Silver Pieces</div>
                  </div>
                  <div className="p-4 rounded-xl" style={{ background: 'rgba(160,130,100,0.15)', border: '1px solid rgba(160,130,100,0.3)' }}>
                    <div className="text-2xl font-fantasy font-bold" style={{ color: '#a08264' }}>{workResult.breakdown.copper}</div>
                    <div className="text-xs text-slate-400">Copper Pieces</div>
                  </div>
                </div>

                <div className="text-sm text-slate-500 mb-8">
                  Total: <span className="font-bold text-amber-400">{workResult.total_earned_cp} cp</span>
                </div>

                <Button onClick={onClose} className="btn-fantasy px-8">
                  Continue
                </Button>
              </motion.div>
            ) : (
              /* Profession Selection Screen */
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <p className="text-sm" style={{ color: 'rgba(212,149,90,0.6)', fontFamily: 'EB Garamond, serif' }}>
                    Choose a profession and how many days you wish to work (1-30 days)
                  </p>
                </div>

                {/* Days Selector */}
                <div className="flex items-center justify-center gap-4 mb-6">
                  <Calendar className="w-5 h-5" style={{ color: 'rgba(212,149,90,0.5)' }} />
                  <label className="text-sm" style={{ color: 'rgba(212,149,90,0.7)' }}>Days to Work:</label>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={daysToWork}
                    onChange={(e) => setDaysToWork(parseInt(e.target.value))}
                    className="w-48 accent-amber-600"
                  />
                  <span className="font-fantasy text-lg min-w-[60px] text-center" style={{ color: '#f0d090' }}>
                    {daysToWork} {daysToWork === 1 ? 'day' : 'days'}
                  </span>
                </div>

                {/* Estimated Earnings */}
                {selectedProfession && (
                  <div className="p-4 rounded-xl mb-6" 
                    style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
                    <div className="flex items-center gap-3 mb-2">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      <span className="text-sm font-medium text-green-300">Estimated Earnings</span>
                    </div>
                    <div className="text-lg font-fantasy" style={{ color: '#86efac' }}>
                      {estimate.min} - {estimate.max} cp ({Math.floor(estimate.min / 100)}-{Math.ceil(estimate.max / 100)} gp)
                    </div>
                  </div>
                )}

                {/* Profession Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {PROFESSIONS.map((profession) => (
                    <button
                      key={profession.name}
                      onClick={() => setSelectedProfession(profession)}
                      className={`p-4 rounded-xl text-left transition-all border-2 ${
                        selectedProfession?.name === profession.name
                          ? 'border-amber-500 bg-amber-900/20'
                          : 'border-slate-700/50 hover:border-slate-600 bg-slate-800/30'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-3xl">{profession.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-fantasy font-bold" style={{ color: '#f0d090' }}>
                              {profession.name}
                            </h4>
                            <Badge className={profession.color} style={{ fontSize: '0.6rem' }}>
                              {profession.skill}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-400 mb-2">{profession.description}</p>
                          <div className="text-xs" style={{ color: 'rgba(212,149,90,0.5)' }}>
                            💰 {profession.daily_wage.min}-{profession.daily_wage.max} cp/day
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {!workComplete && (
            <div className="px-6 py-4 flex justify-end gap-3 flex-shrink-0"
              style={{ borderTop: '1px solid rgba(180,140,90,0.12)', background: 'rgba(15,10,4,0.9)' }}>
              <Button variant="outline" onClick={onClose} className="btn-fantasy">
                Cancel
              </Button>
              <Button
                onClick={handleWork}
                disabled={!selectedProfession || working}
                className="btn-fantasy px-8"
              >
                {working ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Working...
                  </>
                ) : (
                  <>
                    <Coins className="w-4 h-4 mr-2" />
                    Work for {daysToWork} {daysToWork === 1 ? 'day' : 'days'}
                  </>
                )}
              </Button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}