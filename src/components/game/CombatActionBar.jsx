import React from 'react';

/**
 * CombatActionBar — the row of action-type buttons in the combat panel.
 *
 * Attack / Spell / Item are mutually-exclusive "modes" (the selected one is
 * highlighted via the `action` prop). Grapple / Dodge / Flee are one-shot
 * actions that fire their handler immediately.
 *
 * Pure presentational component — all state lives in the parent CombatPanel.
 *
 * Props:
 *  - action            current selected action mode ('attack' | 'spell' | 'item')
 *  - isCaster          whether to show the Spell tab
 *  - loading           disables one-shot actions while a turn resolves
 *  - actionsRemaining  remaining actions this turn (0 disables Grapple/Dodge)
 *  - selectedTarget    target id (Grapple requires a target)
 *  - onSelectAction(mode)  switch attack/spell/item mode
 *  - onGrapple / onDodge / onFlee   one-shot action handlers
 */
export default function CombatActionBar({
  action,
  isCaster,
  loading,
  actionsRemaining,
  selectedTarget,
  onSelectAction,
  onGrapple,
  onDodge,
  onFlee,
}) {
  return (
    <div className="flex gap-1.5">
      <button onClick={() => onSelectAction('attack')}
        className="flex-1 py-2 rounded-lg text-xs font-fantasy transition-all"
        style={action === 'attack' ? {
          background: 'rgba(80,5,5,0.75)', border: '1px solid rgba(220,50,50,0.55)', color: '#fca5a5',
          boxShadow: '0 0 8px rgba(180,30,30,0.15)'
        } : { background: 'rgba(15,5,5,0.5)', border: '1px solid rgba(180,50,50,0.15)', color: 'rgba(180,100,100,0.5)' }}>
        ⚔️ Attack
      </button>
      {isCaster && (
        <button onClick={() => onSelectAction('spell')}
          className="flex-1 py-2 rounded-lg text-xs font-fantasy transition-all"
          style={action === 'spell' ? {
            background: 'rgba(50,10,90,0.75)', border: '1px solid rgba(160,80,255,0.55)', color: '#d4b3ff',
            boxShadow: '0 0 8px rgba(130,60,220,0.15)'
          } : { background: 'rgba(10,5,20,0.5)', border: '1px solid rgba(120,60,200,0.15)', color: 'rgba(160,100,220,0.4)' }}>
          🔮 Spell
        </button>
      )}
      <button onClick={() => onSelectAction('item')}
        className="flex-1 py-2 rounded-lg text-xs font-fantasy transition-all"
        style={action === 'item' ? {
          background: 'rgba(10,50,20,0.7)', border: '1px solid rgba(40,160,80,0.5)', color: '#86efac'
        } : { background: 'rgba(5,15,10,0.5)', border: '1px solid rgba(40,120,60,0.15)', color: 'rgba(80,160,100,0.4)' }}>
        🧪 Item
      </button>
      <button onClick={onGrapple} disabled={loading || actionsRemaining === 0 || !selectedTarget}
        title="Grapple — opposed Athletics check; on success the target's speed drops to 0 (uses one attack)"
        className="px-2 py-2 rounded-lg text-xs font-fantasy transition-all"
        style={{ background: 'rgba(30,18,8,0.6)', border: '1px solid rgba(200,140,60,0.3)', color: 'rgba(230,180,110,0.85)',
          opacity: (!selectedTarget || actionsRemaining === 0) ? 0.4 : 1 }}>
        🤼
      </button>
      <button onClick={onDodge} disabled={loading || actionsRemaining === 0}
        title="Dodge — attacks against you have disadvantage until your next turn (uses your action)"
        className="px-2 py-2 rounded-lg text-xs font-fantasy transition-all"
        style={{ background: 'rgba(8,20,40,0.6)', border: '1px solid rgba(80,140,220,0.3)', color: 'rgba(147,197,253,0.8)' }}>
        🛡️
      </button>
      <button onClick={onFlee}
        className="px-2 py-2 rounded-lg text-xs font-fantasy transition-all"
        style={{ background: 'rgba(20,15,5,0.5)', border: '1px solid rgba(200,130,20,0.25)', color: 'rgba(220,150,30,0.6)' }}>
        🏃
      </button>
    </div>
  );
}