const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const DEAD_ACTIONS = ['thrash', 'writhe', 'struggle', 'breathe', 'speak', 'crawl', 'flee', 'attack', 'stand', 'recover'];

export function buildCompletedCombatContext(combat) {
  const combatants = (combat?.combatants || []).map((entry) => {
    const hp = Math.max(0, Number(entry.hp_current ?? entry.hp ?? 0) || 0);
    const defeated = entry.type === 'enemy' && (hp === 0 || entry.is_conscious === false);
    return { entity_id: entry.id, name: entry.name || 'Unknown combatant', type: entry.type, hp, is_conscious: entry.is_conscious !== false, status: defeated ? 'dead' : 'active', can_act: !defeated };
  });
  const defeated = combatants.filter((entry) => entry.type === 'enemy' && !entry.can_act);
  return {
    combat_id: combat?.id || null,
    result: combat?.result || null,
    outcome: combat?.result === 'victory' ? 'victory' : 'completed',
    combatants,
    defeated_enemies: defeated,
    narrative_constraint: defeated.length
      ? `Authoritative aftermath: ${defeated.map(entry => entry.name).join(', ')} ${defeated.length === 1 ? 'is' : 'are'} defeated at 0 HP and cannot act, speak, flee, struggle, or trigger combat.`
      : 'No defeated enemies are recorded.',
  };
}

export async function readCompletedCombatContext(base44, session) {
  const stored = session?.world_state?.last_completed_combat;
  const combatId = String(stored?.combat_id || '').trim();
  if (!combatId) return stored || null;
  let combat = null;
  try { combat = await base44.asServiceRole.entities.CombatLog.get(combatId); } catch {}
  if (!combat || combat.is_active || !['victory', 'defeat', 'fled', 'resolved'].includes(combat.result)) return stored || null;
  return buildCompletedCombatContext(combat);
}

export async function persistCompletedCombatContext(base44, sessionId, combat) {
  const context = buildCompletedCombatContext(combat);
  const session = await base44.asServiceRole.entities.GameSession.get(sessionId);
  if (!session) return context;
  const current = session.world_state?.last_completed_combat;
  if (current?.combat_id === context.combat_id) return current;
  await base44.asServiceRole.entities.GameSession.update(sessionId, {
    world_state: { ...(session.world_state || {}), last_completed_combat: context },
  });
  return context;
}

const deadAliases = (entry) => {
  const words = normalize(entry.name).split(' ').filter(Boolean);
  const aliases = [normalize(entry.name)];
  if (words.length > 1) aliases.push(words.filter(word => word !== 'reinforcement').join(' '));
  return aliases.filter(Boolean);
};

export function findDeadCombatantContradictions(narrative, context) {
  const text = normalize(narrative);
  const dead = (context?.defeated_enemies || []).filter(entry => entry.status === 'dead' || entry.status === 'defeated' || entry.can_act === false);
  const contradictions = [];
  for (const entry of dead) {
    for (const alias of deadAliases(entry)) {
      const action = DEAD_ACTIONS.find((verb) => new RegExp(`\\b${alias.replace(/ /g, '\\s+')}\\b.{0,45}\\b${verb}\\w*\\b|\\b${verb}\\w*\\b.{0,45}\\b${alias.replace(/ /g, '\\s+')}\\b`).test(text));
      if (action) contradictions.push({ entity_id: entry.entity_id, name: entry.name, action });
    }
  }
  return contradictions;
}

const safeNarrativeName = (name, index) => {
  const cleaned = String(name || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || `Defeated enemy ${index + 1}`;
};

export function factualAftermathFallback(context) {
  const dead = Array.isArray(context?.defeated_enemies) ? context.defeated_enemies : [];
  const bodyFacts = dead.map((entry, index) => `${safeNarrativeName(entry.name, index)} is dead and motionless at 0 HP.`);
  const summary = bodyFacts.length
    ? bodyFacts.join(' ')
    : 'The battlefield is still; no defeated enemy is recorded.';
  return `${summary} The living magistrate and witnesses can now address the player’s next action.`;
}