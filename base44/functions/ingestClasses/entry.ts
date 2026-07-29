import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const OPEN5E = 'https://api.open5e.com/v1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fetch all classes from Open5e
    const res = await fetch(`${OPEN5E}/classes/?limit=100`);
    if (!res.ok) throw new Error('Failed to fetch classes');
    const data = await res.json();
    const classes = data.results || [];

    // Idempotent upsert: for each Open5e class, query DnDClass by exact name;
    // update the existing canonical record if found (no duplicate creation),
    // otherwise create a new record.
    const db = base44.asServiceRole.entities.DnDClass;
    let created = 0;
    let updated = 0;
    const skipped = [];

    for (const c of classes) {
      const name = c.name;
      if (!name) { skipped.push({ reason: 'missing name', data: c }); continue; }

      const transformed = {
        name,
        description: c.desc || '',
        hit_die: parseInt(c.hit_die) || 8,
        primary_ability: c.primary_ability || 'strength',
        saving_throw_proficiencies: c.saving_throws || [],
        armor_proficiencies: c.armor_proficiencies || [],
        weapon_proficiencies: c.weapon_proficiencies || [],
        skill_choices: c.skill_choices || [],
        skill_count: c.skill_count || 2,
        subclasses: c.subclasses || [],
        features_by_level: c.features_by_level || {},
        spell_slots_by_level: c.spell_slots_by_level || {},
        spellcasting_ability: c.spellcasting_ability || '',
        raw_data: c
      };

      // Query existing records by exact name
      const existing = await db.filter({ name }, undefined, 50);
      if (existing.length > 0) {
        // Update only the canonical record (first match); leave any duplicates untouched.
        const canonical = existing[0];
        await db.update(canonical.id, transformed);
        updated++;
        if (existing.length > 1) {
          skipped.push({ reason: `${existing.length - 1} duplicate(s) left untouched`, name });
        }
      } else {
        await db.create(transformed);
        created++;
      }
    }

    return Response.json({
      success: true,
      created,
      updated,
      skipped,
      total: classes.length,
      message: `Created ${created}, updated ${updated} of ${classes.length} classes`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});