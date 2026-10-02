export const corpseIdentity = item => item?.death_provenance?.source === 'narrative_derived' && item.death_provenance.scene_entity_id
  ? item.death_provenance.scene_entity_id : `corpse:${item?.death_provenance?.combat_id}:${item?.death_provenance?.combatant_id}`;
export const verifiedDeadCorpse = item => item?.alive === false && item.death_provenance?.status === 'dead' && (
  (item.death_provenance.source === 'narrative_derived' && item.death_provenance.scene_entity_id && item.death_provenance.source_request_id && item.death_provenance.source_hash)
  || (item.death_provenance.combat_id && item.death_provenance.combatant_id && Number(item.death_provenance.hp) === 0));