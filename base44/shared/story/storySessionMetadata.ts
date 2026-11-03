// Metadata written with the staged story entry, never re-applied by recovery.
export default function storySessionMetadata({ session, action, customInput, result, updatedLog }) {
  const patch = {};
  const existingMemory = session.campaign_memory && session.campaign_memory !== 'This is still early in the campaign. Major events and relationships will be tracked here.' ? session.campaign_memory : '';
  const lines = existingMemory ? existingMemory.split('\n').filter(Boolean) : [];
  if (action === 'choice' && typeof customInput === 'string' && customInput.trim()) lines.push(`• Player chose to: ${customInput.trim().slice(0, 160)}`);
  else if (updatedLog.length % 10 === 0 || action === 'start') lines.push(`• ${(result.narrative || '').slice(0, 200)}`);
  if (lines.length) patch.campaign_memory = lines.slice(-25).join('\n');
  if (typeof result.key_event === 'string' && result.key_event.trim()) {
    const events = Array.isArray(session.key_events) ? session.key_events : [], summary = result.key_event.trim();
    if (!events.some(event => (event.summary || '').toLowerCase() === summary.toLowerCase())) patch.key_events = [...events, { summary, timestamp: new Date().toISOString(), turn: updatedLog.length }];
  }
  if (action === 'start' && result.opening_signature) patch.opening_signature = result.opening_signature;
  if (result.reputation_change) patch.reputation = (session.reputation || 0) + result.reputation_change;
  if (result.plot_flag) patch.plot_flags = { ...(session.plot_flags || {}), [result.plot_flag]: true };
  if (result.quest_update) {
    const active = [...(session.active_quests || [])], completed = [...(session.completed_quests || [])];
    if (result.quest_update.new_quest) { active.push({ title: result.quest_update.new_quest, timestamp: new Date().toISOString() }); patch.active_quests = active; }
    if (result.quest_update.completed_quest) {
      const index = active.findIndex(quest => quest.title === result.quest_update.completed_quest);
      if (index >= 0) { const done = active.splice(index, 1)[0]; completed.push({ ...done, completed_at: new Date().toISOString() }); patch.active_quests = active; patch.completed_quests = completed; }
    }
  }
  return patch;
}