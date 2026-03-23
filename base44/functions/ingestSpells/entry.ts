import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const OPEN5E_V1 = 'https://api.open5e.com/v1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const clearFirst = body.clear_first === true;

    // Optionally clear existing spells
    if (clearFirst) {
      const existing = await base44.asServiceRole.entities.Spell.list();
      for (const s of existing) {
        await base44.asServiceRole.entities.Spell.delete(s.id);
      }
    }

    // Fetch all spells from Open5e v1 (1400+ spells)
    let allSpells = [];
    let url = `${OPEN5E_V1}/spells/?limit=100&format=json`;

    while (url) {
      const res = await fetch(url);
      if (!res.ok) break;
      const data = await res.json();
      allSpells = [...allSpells, ...(data.results || [])];
      url = data.next || null;
    }

    // Filter to only core SRD spells (wotc-srd source) to avoid duplicates
    // unless they are from a5e or other well-known sources
    const SRD_DOCS = ['wotc-srd', 'phb', 'xge', 'tce', 'srd'];
    const coreSpells = allSpells.filter(s =>
      SRD_DOCS.some(d => (s.document__slug || '').toLowerCase().includes(d)) ||
      (s.page && s.page.startsWith('phb'))
    );

    // If we got nothing from filtering, use all spells (fallback)
    const spellsToProcess = coreSpells.length > 50 ? coreSpells : allSpells;

    // Deduplicate by name (keep first occurrence)
    const seen = new Set();
    const unique = spellsToProcess.filter(s => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    });

    // Transform to Spell entity schema
    const transformed = unique.map(s => {
      const classesRaw = s.dnd_class || '';
      const classes = classesRaw
        ? classesRaw.split(',').map(c => c.trim()).filter(Boolean)
        : (s.spell_lists || []).map(c => c.charAt(0).toUpperCase() + c.slice(1));

      const concentration = s.concentration === 'yes' || s.requires_concentration === true;
      const ritual = s.ritual === 'yes' || s.can_be_cast_as_ritual === true;

      // Determine attack type from description
      let attack_type = 'utility';
      const desc = (s.desc || '').toLowerCase();
      if (s.damage_type || desc.includes('damage')) {
        if (desc.includes('ranged spell attack')) attack_type = 'ranged_spell_attack';
        else if (desc.includes('melee spell attack')) attack_type = 'melee_spell_attack';
        else if (desc.includes('saving throw') || desc.includes('save')) attack_type = 'saving_throw';
        else attack_type = 'auto_hit';
      } else if (desc.includes('heal') || desc.includes('restore') || desc.includes('regain')) {
        attack_type = 'healing';
      }

      return {
        name: s.name,
        level: s.level_int ?? s.spell_level ?? 0,
        school: (s.school || 'Evocation').charAt(0).toUpperCase() + (s.school || 'Evocation').slice(1),
        casting_time: s.casting_time || '1 action',
        range: s.range || 'Self',
        components: s.components || '',
        duration: s.duration || 'Instantaneous',
        description: s.desc || '',
        higher_level_scaling: s.higher_level || '',
        classes,
        ritual,
        concentration,
        damage_type: s.damage_type || '',
        damage_dice: '',
        save_type: '',
        attack_type,
        raw_data: {
          slug: s.slug,
          page: s.page,
          document: s.document__title,
          material: s.material || '',
          higher_level: s.higher_level || '',
        }
      };
    });

    // Batch insert in chunks of 50
    const CHUNK = 50;
    let inserted = 0;
    for (let i = 0; i < transformed.length; i += CHUNK) {
      const chunk = transformed.slice(i, i + CHUNK);
      await base44.asServiceRole.entities.Spell.bulkCreate(chunk);
      inserted += chunk.length;
    }

    return Response.json({
      success: true,
      total_fetched: allSpells.length,
      after_filter: spellsToProcess.length,
      unique_spells: unique.length,
      inserted,
      message: `Successfully ingested ${inserted} spells.`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});