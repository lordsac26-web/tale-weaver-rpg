import { evaluateEffectDuration } from '../effectDuration.ts';
import { resolveAuthoritativeSkillModifier } from '../skills/authoritativeSkillModifier.ts';
import { isPassWithoutTraceIdentity } from '../spells/conditionIdentity.js';

export const PWT_CONSEQUENCE_AUDIT_VERSION = 'pwt-consequence-recovery-audit-v1.0.0';
const IDS = Object.freeze({ character: '6a6825cd07a490fa70a46852', session: '6a6825edd695bd65a4322256', combat: '6aa7d6840d6ccc68948480df', check: 'story-choice:6a6825edd695bd65a4322256:0d2f6d5f-2a8a-4a6c-9bbe-22627168a512' });
const hash = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))).map((byte) => byte.toString(16).padStart(2, '0')).join('');

export async function auditPwtConsequenceRecoveryOptions(db) {
  const [character, session, combat] = await Promise.all([db.entities.Character.get(IDS.character), db.entities.GameSession.get(IDS.session), db.entities.CombatLog.get(IDS.combat)]);
  const skillReceipts = session.world_state?.__skill_check_receipts || [];
  const receipt = skillReceipts.find((entry) => entry?.request_id === IDS.check);
  const storyIndex = (session.story_log || []).findIndex((entry) => entry?.request_id === IDS.check);
  const laterStory = storyIndex < 0 ? [] : (session.story_log || []).slice(storyIndex + 1);
  const pwtCondition = (character.conditions || []).find(isPassWithoutTraceIdentity);
  const pwtModifier = (character.active_modifiers || []).find(isPassWithoutTraceIdentity);
  const concentration = session.world_state?.active_concentration;
  const duration = evaluateEffectDuration({ entry: pwtCondition || concentration || {}, session, name: 'Pass without Trace' });
  const corrected = resolveAuthoritativeSkillModifier({ character, session, skill: 'Stealth' });
  const laterAttack = (combat.log_entries || []).find((entry) => entry?.request_id && Date.parse(entry.timestamp || combat.created_date || '') >= Date.parse(receipt?.at || '')) || (combat.log_entries || []).find((entry) => entry?.action === 'attack');
  const ammoReceipt = (combat.world_state?.__ammo_receipts || []).find((entry) => entry?.request_id === laterAttack?.request_id) || null;
  const combatReceipt = (combat.world_state?.__receipts || []).find((entry) => entry?.id === laterAttack?.request_id) || null;
  const arrows = (character.inventory || []).map((item, index) => ({ item, index })).find(({ item }) => /^arrows$/i.test(String(item?.name || '')));
  const guards = {
    exact_ids: character.id === IDS.character && session.id === IDS.session && combat.id === IDS.combat,
    linkage: session.character_id === character.id && session.combat_state?.combat_id === combat.id && combat.session_id === session.id,
    exact_check: !!receipt && receipt.raw_d20 === 2 && receipt.modifier_total === 7 && receipt.dc === 17 && receipt.final_total === 9 && receipt.success === false,
    pwt_identity: !!pwtCondition && !!pwtModifier && isPassWithoutTraceIdentity(concentration),
    pwt_conservative_active: duration.active === true && duration.expired === false,
    corrected_total: corrected.ok && corrected.pwt_active === true && corrected.total === 17 && receipt.raw_d20 + corrected.total === 19,
    later_consequences_exist: laterStory.length > 0 && !!laterAttack && !!ammoReceipt && !!combatReceipt,
    accepted_crit: laterAttack?.raw_d20 === 20 && laterAttack?.attack_roll === 29 && laterAttack?.damage === 15,
    ammunition_chain: ammoReceipt?.quantity_before === 14 && ammoReceipt?.quantity_after === 13 && arrows?.item?.quantity === 13,
  };
  const currentHashes = { character: await hash(character), session: await hash(session), combat: await hash(combat), check_receipt: await hash(receipt), later_attack: await hash(laterAttack) };
  return {
    version: PWT_CONSEQUENCE_AUDIT_VERSION,
    read_only: true,
    writes: 0,
    ids: IDS,
    guards,
    failed_guards: Object.entries(guards).filter(([, pass]) => !pass).map(([name]) => name),
    current_hashes: currentHashes,
    corrected_check: { raw_d20: receipt?.raw_d20, base_modifier: corrected.base_skill, pwt_bonus: corrected.effect_bonus, modifier_total: corrected.total, dc: receipt?.dc, corrected_total: receipt ? receipt.raw_d20 + corrected.total : null, corrected_outcome: receipt ? receipt.raw_d20 + corrected.total >= receipt.dc : null, migration_provenance: duration.migration_provenance, expiration_basis: duration.basis },
    option_1: {
      name: 'minimal_non_destructive', safe_to_prepare: true, applied: false,
      exact_future_impact: { Character: [], GameSession: ['world_state.__pwt_recovery_corrections append one immutable receipt referencing the original check and corrected total 19'], CombatLog: [], story_log: [], inventory: [], narration: [] },
      preserved: ['current story entries', 'active combat', 'natural-20 attack', '15 damage', 'Vanguard 26→11 HP', 'arrow 14→13', 'all original receipts'],
      note: 'The unified evaluator already treats the legacy PWT as active for future checks; a later owner-approved apply would add provenance only, not rewrite history.'
    },
    option_2: {
      name: 'full_destructive_rollback', safe_to_apply: false, applied: false,
      exact_known_impact: { Character: [`inventory[${arrows?.index ?? 'unknown'}].quantity 13→14`, 'remove Detected condition attributable to the failed check'], GameSession: [`story_log remove indexes ${storyIndex}..${(session.story_log || []).length - 1}`, 'world_state.__skill_check_receipts remove original failed receipt', 'world_state story-attack receipts remove later attack', 'in_combat true→false', 'combat_state clear'], CombatLog: [`delete ${combat.id}, including crit, damage, action economy, ammo and attack receipts`], target: [`Obsidian Circle Vanguard HP 11→26 by deleting the encounter record`] },
      conflicts: ['a later player choice and accepted natural-20 attack exist', 'ammo was authoritatively consumed', 'the pre-check full Character/GameSession snapshot was not persisted', 'narrative/world-state side effects cannot be proven field-for-field reversible'],
      requirement: 'Owner must explicitly approve destructive rollback after a separate snapshot-backed precondition audit; current evidence is insufficient for safe apply.'
    }
  };
}