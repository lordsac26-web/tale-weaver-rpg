import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Download, CheckCircle2, XCircle, Search, Filter } from 'lucide-react';

// ─── Races currently defined in gameData.js RACES object ────────────────────
const IN_GAME = new Set([
  'Human', 'Elf', 'Dwarf', 'Halfling', 'Gnome', 'Half-Elf', 'Half-Orc',
  'Tiefling', 'Dragonborn', 'Aasimar', 'Genasi', 'Goliath', 'Firbolg',
  'Tabaxi', 'Kenku', 'Triton', 'Lizardfolk', 'Yuan-ti Pureblood',
  'Minotaur', 'Tortle', 'Warforged',
]);

// ─── In DB but NOT in gameData.js ───────────────────────────────────────────
const IN_DB_ONLY = new Set(['Gearforged']);

// ─── Full D&D 5e race roster across all official + popular sourcebooks ───────
// Format: { name, source, tier, notes }
// tier: 'core' | 'official' | 'popular' | '3rdparty'
const ALL_RACES = [
  // ── Player's Handbook (PHB) ──────────────────────────────────────────────
  { name: 'Dwarf',            source: 'PHB',          tier: 'core',     notes: 'Mountain & Hill subraces' },
  { name: 'Elf',              source: 'PHB',          tier: 'core',     notes: 'High, Wood, Dark (Drow) subraces' },
  { name: 'Halfling',         source: 'PHB',          tier: 'core',     notes: 'Lightfoot & Stout subraces' },
  { name: 'Human',            source: 'PHB',          tier: 'core',     notes: 'Standard & Variant Human' },
  { name: 'Dragonborn',       source: 'PHB',          tier: 'core',     notes: '10 draconic ancestry options' },
  { name: 'Gnome',            source: 'PHB',          tier: 'core',     notes: 'Forest & Rock subraces' },
  { name: 'Half-Elf',         source: 'PHB',          tier: 'core',     notes: '' },
  { name: 'Half-Orc',         source: 'PHB',          tier: 'core',     notes: '' },
  { name: 'Tiefling',         source: 'PHB',          tier: 'core',     notes: 'Infernal Legacy' },

  // ── Elemental Evil Player's Companion (EEPC) ─────────────────────────────
  { name: 'Aarakocra',        source: 'EEPC',         tier: 'official', notes: 'Bird-folk, fly speed 50 ft' },
  { name: 'Genasi',           source: 'EEPC',         tier: 'official', notes: 'Air, Earth, Fire, Water subraces' },
  { name: 'Goliath',          source: 'EEPC',         tier: 'official', notes: "Stone's Endurance, Powerful Build" },

  // ── Volo's Guide to Monsters (VGtM) ─────────────────────────────────────
  { name: 'Aasimar',          source: "Volo's",       tier: 'official', notes: 'Protector, Scourge, Fallen subraces' },
  { name: 'Firbolg',          source: "Volo's",       tier: 'official', notes: 'Hidden Step, Speech of Beast and Leaf' },
  { name: 'Goliath',          source: "Volo's",       tier: 'official', notes: '(reprinted from EEPC)' },
  { name: 'Kenku',            source: "Volo's",       tier: 'official', notes: 'Mimicry, Expert Forgery' },
  { name: 'Lizardfolk',       source: "Volo's",       tier: 'official', notes: 'Natural Armor, Cunning Artisan' },
  { name: 'Tabaxi',           source: "Volo's",       tier: 'official', notes: 'Feline Agility, Cat\'s Claws' },
  { name: 'Triton',           source: "Volo's",       tier: 'official', notes: 'Amphibious, Control Air and Water' },
  { name: 'Yuan-ti Pureblood',source: "Volo's",       tier: 'official', notes: 'Magic Resistance, Poison Immunity' },
  { name: 'Bugbear',          source: "Volo's",       tier: 'official', notes: 'Surprise Attack, Long-Limbed' },
  { name: 'Goblin',           source: "Volo's",       tier: 'official', notes: 'Fury of the Small, Nimble Escape' },
  { name: 'Hobgoblin',        source: "Volo's",       tier: 'official', notes: 'Martial Training, Saving Face' },
  { name: 'Kobold',           source: "Volo's",       tier: 'official', notes: 'Pack Tactics, Sunlight Sensitivity' },
  { name: 'Orc',              source: "Volo's",       tier: 'official', notes: 'Aggressive, Powerful Build' },

  // ── Xanathar's Guide to Everything (XGtE) ───────────────────────────────
  // (No new races, but racial feats)

  // ── Mordenkainen's Tome of Foes (MToF) ──────────────────────────────────
  { name: 'Gith (Githyanki)', source: 'MToF',         tier: 'official', notes: 'Martial Prodigy, Psionics' },
  { name: 'Gith (Githzerai)', source: 'MToF',         tier: 'official', notes: 'Monastic Training, Psionics' },
  { name: 'Elf (Eladrin)',    source: 'MToF',         tier: 'official', notes: 'Seasonal Fey Step' },
  { name: 'Elf (Sea Elf)',    source: 'MToF',         tier: 'official', notes: 'Child of the Sea, swim 30 ft' },
  { name: 'Elf (Shadar-kai)', source: 'MToF',         tier: 'official', notes: 'Blessing of the Raven Queen' },
  { name: 'Dwarf (Duergar)',  source: 'MToF',         tier: 'official', notes: 'Superior Darkvision, Psionic Fortitude' },
  { name: 'Tiefling (variants)', source: 'MToF',      tier: 'official', notes: '9 variant Tiefling bloodlines' },
  { name: 'Halfling (Ghostwise)', source: 'MToF',     tier: 'official', notes: 'Silent Speech (telepathy 30 ft)' },

  // ── Eberron: Rising from the Last War (ERLW) ────────────────────────────
  { name: 'Warforged',        source: 'ERLW',         tier: 'official', notes: 'Integrated Protection, Constructed Resilience' },
  { name: 'Changeling',       source: 'ERLW',         tier: 'official', notes: 'Shapechanger, Unsettling Visage' },
  { name: 'Kalashtar',        source: 'ERLW',         tier: 'official', notes: 'Dual Mind, Mental Discipline' },
  { name: 'Shifter',          source: 'ERLW',         tier: 'official', notes: 'Shifting (Beasthide/Longtooth/Swiftstride/Wildhunt)' },

  // ── Mythic Odysseys of Theros (MOoT) ────────────────────────────────────
  { name: 'Centaur',          source: 'MOoT',         tier: 'official', notes: 'Charge, Equine Build' },
  { name: 'Leonin',           source: 'MOoT',         tier: 'official', notes: 'Daunting Roar, Hunter\'s Instincts' },
  { name: 'Minotaur',         source: 'MOoT',         tier: 'official', notes: 'Goring Rush, Hammering Horns' },
  { name: 'Satyr',            source: 'MOoT',         tier: 'official', notes: 'Magic Resistance, Ram, Reveler' },
  { name: 'Triton',           source: 'MOoT',         tier: 'official', notes: '(reprinted from Volo\'s)' },

  // ── Explorer's Guide to Wildemount (EGtW) ────────────────────────────────
  { name: 'Elf (Pallid)',     source: 'EGtW',         tier: 'official', notes: 'Incisive Sense, Blessing of the Moon Weaver' },
  { name: 'Elf (Mark of Shadow)', source: 'EGtW',    tier: 'official', notes: 'Dragonmarks variant' },
  { name: 'Human (Hollow One)', source: 'EGtW',      tier: 'official', notes: 'Supernatural Gift, Unsettling Presence' },
  { name: 'Draconblood Dragonborn', source: 'EGtW',  tier: 'official', notes: 'Forceful Presence (Dragonborn variant)' },
  { name: 'Ravenite Dragonborn', source: 'EGtW',     tier: 'official', notes: 'Vengeful Assault (Dragonborn variant)' },

  // ── Ravnica / Guildmasters' Guide to Ravnica (GGtR) ─────────────────────
  { name: 'Centaur',          source: 'GGtR',         tier: 'official', notes: '(also in MOoT)' },
  { name: 'Goblin',           source: 'GGtR',         tier: 'official', notes: '(reprinted from Volo\'s)' },
  { name: 'Loxodon',          source: 'GGtR',         tier: 'official', notes: 'Natural Armor, Loxodon Serenity, Trunk' },
  { name: 'Minotaur',         source: 'GGtR',         tier: 'official', notes: '(also in MOoT)' },
  { name: 'Simic Hybrid',     source: 'GGtR',         tier: 'official', notes: 'Animal Enhancement (choose from list)' },
  { name: 'Vedalken',         source: 'GGtR',         tier: 'official', notes: 'Vedalken Dispassion, Tireless Precision' },

  // ── Acquisitions Incorporated (AI) ──────────────────────────────────────
  // No new races.

  // ── Theros (MOoT extras already listed above) ────────────────────────────

  // ── Icewind Dale: Rime of the Frostmaiden (IDRF) ─────────────────────────
  // No new PC races.

  // ── Tasha's Cauldron of Everything (TCoE) ────────────────────────────────
  { name: 'Custom Lineage',   source: 'TCoE',         tier: 'official', notes: 'Build-your-own race system, 1 feat at lvl 1' },

  // ── Van Richten's Guide to Ravenloft (VRGtR) ────────────────────────────
  { name: 'Dhampir',          source: 'VRGtR',        tier: 'official', notes: 'Vampiric Bite, Spider Climb' },
  { name: 'Hexblood',         source: 'VRGtR',        tier: 'official', notes: 'Eerie Token, Hex Magic' },
  { name: 'Reborn',           source: 'VRGtR',        tier: 'official', notes: 'Deathless Nature, Knowledge from a Past Life' },

  // ── Fizban's Treasury of Dragons (FToD) ─────────────────────────────────
  { name: 'Dragonborn (Chromatic)', source: "Fizban's", tier: 'official', notes: 'Chromatic Warding, new Breath Weapon' },
  { name: 'Dragonborn (Metallic)',  source: "Fizban's", tier: 'official', notes: 'Metallic Breath Weapon (enervating/repulsion)' },
  { name: 'Dragonborn (Gem)',       source: "Fizban's", tier: 'official', notes: 'Psionic Mind, Gem Flight' },

  // ── Strixhaven: A Curriculum of Chaos (SCC) ──────────────────────────────
  // No new races.

  // ── The Wild Beyond the Witchlight (WBtW) ────────────────────────────────
  // No new races.

  // ── Monsters of the Multiverse (MotM) — major reprint + new ─────────────
  { name: 'Aarakocra',        source: 'MotM',         tier: 'official', notes: 'Updated (reprinted from EEPC)' },
  { name: 'Aasimar',          source: 'MotM',         tier: 'official', notes: 'Updated (reprinted from Volo\'s)' },
  { name: 'Astral Elf',       source: 'MotM',         tier: 'official', notes: 'Astral Fire, Radiant Soul, Trance' },
  { name: 'Autognome',        source: 'MotM',         tier: 'official', notes: 'Construct creature type, Healing Machine' },
  { name: 'Bugbear',          source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Centaur',          source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Changeling',       source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Deep Gnome (Svirfneblin)', source: 'MotM', tier: 'official', notes: 'Updated, Stone Camouflage' },
  { name: 'Duergar',          source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Eladrin',          source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Fairy',            source: 'MotM',         tier: 'official', notes: 'NEW — Fairy Flight, Fey, Pixie Dust' },
  { name: 'Firbolg',          source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Githyanki',        source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Githzerai',        source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Goblin',           source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Goliath',          source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Hadozee',          source: 'MotM',         tier: 'official', notes: 'NEW — Glide, Dexterous Feet' },
  { name: 'Harengon',         source: 'MotM',         tier: 'official', notes: 'NEW — Hare-Trigger, Leporine Senses' },
  { name: 'Hobgoblin',        source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Kenku',            source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Kobold',           source: 'MotM',         tier: 'official', notes: 'Updated — Dragon\'s Gift' },
  { name: 'Leonin',           source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Lizardfolk',       source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Loxodon',          source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Minotaur',         source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Orc',              source: 'MotM',         tier: 'official', notes: 'Updated — Adrenaline Rush' },
  { name: 'Owlin',            source: 'MotM',         tier: 'official', notes: 'NEW — Flight, Keen Senses, Silent Feathers' },
  { name: 'Plasmoid',         source: 'MotM',         tier: 'official', notes: 'NEW — Amorphous, Ooze creature type' },
  { name: 'Satyr',            source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Sea Elf',          source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Shadar-kai',       source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Shifter',          source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Simic Hybrid',     source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Tabaxi',           source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Thri-kreen',       source: 'MotM',         tier: 'official', notes: 'NEW — Chameleon Carapace, Secondary Arms, Telepathy' },
  { name: 'Tortle',           source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Triton',           source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Vedalken',         source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Warforged',        source: 'MotM',         tier: 'official', notes: 'Updated' },
  { name: 'Yuan-ti',          source: 'MotM',         tier: 'official', notes: 'Updated (formerly Pureblood)' },

  // ── Spelljammer: Adventures in Space (SiS) ──────────────────────────────
  { name: 'Giff',             source: 'Spelljammer',  tier: 'official', notes: 'Hippo-folk, Hippo Build, Firearms proficiency' },
  { name: 'Grung',            source: 'Spelljammer',  tier: 'official', notes: 'Poison skin, Amphibious, arboreal' },
  { name: 'Reigar',           source: 'Spelljammer',  tier: 'official', notes: 'Etherealness, Innate Spellcasting' },
  { name: 'Thri-kreen',       source: 'Spelljammer',  tier: 'official', notes: '(reprinted from MotM)' },

  // ── Dragonlance: Shadow of the Dragon Queen (DSotDQ) ────────────────────
  { name: 'Kender',           source: 'Dragonlance',  tier: 'official', notes: 'Taunt, Fearless, Kender Ace' },

  // ── Keys from the Golden Vault / other adventures ────────────────────────
  // No new races.

  // ── One D&D / D&D 2024 Player's Handbook (2024 PHB) ─────────────────────
  { name: 'Aasimar (2024)',   source: '2024 PHB',     tier: 'official', notes: 'Revised — Celestial Revelation, Life, Light, or Death form' },
  { name: 'Dragonborn (2024)',source: '2024 PHB',     tier: 'official', notes: 'Revised — Draconic Flight at level 5' },
  { name: 'Dwarf (2024)',     source: '2024 PHB',     tier: 'official', notes: 'Revised — Stonecunning at will, Darkvision 120 ft' },
  { name: 'Elf (2024)',       source: '2024 PHB',     tier: 'official', notes: 'Revised — Elven Lineage (High, Wood, Drow)' },
  { name: 'Gnome (2024)',     source: '2024 PHB',     tier: 'official', notes: 'Revised — Gnomish Lineage (Forest, Rock, Deep)' },
  { name: 'Goliath (2024)',   source: '2024 PHB',     tier: 'official', notes: 'Revised — Giant Ancestry (Cloud, Fire, Frost, Hill, Stone, Storm)' },
  { name: 'Halfling (2024)',  source: '2024 PHB',     tier: 'official', notes: 'Revised — Luck, Brave, Naturally Stealthy' },
  { name: 'Human (2024)',     source: '2024 PHB',     tier: 'official', notes: 'Revised — Resourceful, Skillful, Versatile' },
  { name: 'Orc (2024)',       source: '2024 PHB',     tier: 'official', notes: 'Revised — Adrenaline Rush, Darkvision' },
  { name: 'Tiefling (2024)',  source: '2024 PHB',     tier: 'official', notes: 'Revised — Fiendish Lineage (Abyssal, Chthonic, Infernal)' },

  // ── Popular 3rd Party / Tome of Heroes ───────────────────────────────────
  { name: 'Gearforged',       source: 'Tome of Heroes', tier: '3rdparty', notes: 'Mechanical construct race — IN YOUR DB' },
  { name: 'Alseid',           source: 'Tome of Heroes', tier: '3rdparty', notes: 'Deer-centaur forest guardians' },
  { name: 'Catfolk',          source: 'Tome of Heroes', tier: '3rdparty', notes: 'Malkin & Pantheran subraces' },
  { name: 'Darakhul',         source: 'Tome of Heroes', tier: '3rdparty', notes: 'Undead ghouls with Heritage subraces' },
  { name: 'Derro',            source: 'Tome of Heroes', tier: '3rdparty', notes: 'Mad deep-dwellers, Unsettling Presence' },
  { name: 'Dust Goblin',      source: 'Tome of Heroes', tier: '3rdparty', notes: 'Desert-adapted goblinoids' },
  { name: 'Edjet',            source: 'Tome of Heroes', tier: '3rdparty', notes: 'Gnoll warriors, Rampage' },
  { name: 'Kobold (Midgard)', source: 'Tome of Heroes', tier: '3rdparty', notes: '3rd party kobold variant' },
  { name: 'Ravenfolk (Huginn)',source: 'Tome of Heroes', tier: '3rdparty', notes: 'Raven-headed, Prophetic Sight' },
  { name: 'Shadow Fey',       source: 'Tome of Heroes', tier: '3rdparty', notes: 'Court of Shadow variants' },
  { name: 'Weremage (Skinchanger)', source: 'Tome of Heroes', tier: '3rdparty', notes: 'Bestial shapeshifter' },
];

// Deduplicate by name for status checks
const uniqueRaces = [];
const seen = new Set();
ALL_RACES.forEach(r => {
  const key = r.name.toLowerCase().replace(/\s*\(.*\)/, '').trim();
  if (!seen.has(key)) {
    seen.add(key);
    uniqueRaces.push(r);
  }
});

const SOURCES = ['All', 'PHB', 'EEPC', "Volo's", 'MToF', 'ERLW', 'MOoT', 'GGtR', 'TCoE', 'VRGtR', "Fizban's", 'MotM', 'Spelljammer', 'Dragonlance', '2024 PHB', 'Tome of Heroes', 'EGtW'];
const TIERS = ['All', 'core', 'official', '3rdparty'];
const TIER_LABELS = { core: 'Core PHB', official: 'Official WotC', '3rdparty': '3rd Party' };
const TIER_COLORS = {
  core:     'bg-amber-900/50 border-amber-500/40 text-amber-300',
  official: 'bg-blue-900/50 border-blue-500/40 text-blue-300',
  '3rdparty': 'bg-purple-900/50 border-purple-500/40 text-purple-300',
};

function getStatus(race) {
  if (IN_GAME.has(race.name)) return 'ingame';
  if (IN_DB_ONLY.has(race.name)) return 'dbonly';
  return 'missing';
}

export default function RaceReport() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [tierFilter, setTierFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const filtered = ALL_RACES.filter(r => {
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.source.toLowerCase().includes(search.toLowerCase());
    const matchSource = sourceFilter === 'All' || r.source === sourceFilter;
    const matchTier = tierFilter === 'All' || r.tier === tierFilter;
    const status = getStatus(r);
    const matchStatus = statusFilter === 'All' || status === statusFilter;
    return matchSearch && matchSource && matchTier && matchStatus;
  });

  const inGameCount = ALL_RACES.filter(r => getStatus(r) === 'ingame').length;
  const dbOnlyCount = ALL_RACES.filter(r => getStatus(r) === 'dbonly').length;
  const missingCount = ALL_RACES.filter(r => getStatus(r) === 'missing').length;

  const handleDownloadCSV = () => {
    const header = 'Race Name,Source,Tier,Status,Notes';
    const rows = ALL_RACES.map(r => {
      const status = IN_GAME.has(r.name) ? 'In Game (gameData.js)' : IN_DB_ONLY.has(r.name) ? 'In DB Only' : 'Not Implemented';
      return `"${r.name}","${r.source}","${TIER_LABELS[r.tier]}","${status}","${r.notes}"`;
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dnd5e_race_report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen parchment-bg p-4 md:p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/')} className="text-amber-400/60 hover:text-amber-400 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-fantasy text-2xl text-glow-gold" style={{ color: 'var(--brass-gold)' }}>
              D&D 5E Race Report
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-dim)', fontFamily: 'EB Garamond, serif' }}>
              All official + popular sourcebook races vs. what's implemented in your game
            </p>
          </div>
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-lg btn-fantasy text-sm font-fantasy"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="glass-panel rounded-xl p-4 text-center cursor-pointer hover:border-glow-gold transition-all"
            onClick={() => setStatusFilter(statusFilter === 'ingame' ? 'All' : 'ingame')}>
            <div className="text-2xl font-fantasy font-bold text-green-400">{inGameCount}</div>
            <div className="text-xs mt-1 font-fantasy tracking-widest" style={{ color: 'rgba(134,239,172,0.6)' }}>IN GAME</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-dim)', fontFamily: 'EB Garamond, serif' }}>Implemented in gameData.js</div>
          </div>
          <div className="glass-panel rounded-xl p-4 text-center cursor-pointer hover:border-glow-gold transition-all"
            onClick={() => setStatusFilter(statusFilter === 'dbonly' ? 'All' : 'dbonly')}>
            <div className="text-2xl font-fantasy font-bold text-amber-400">{dbOnlyCount}</div>
            <div className="text-xs mt-1 font-fantasy tracking-widest" style={{ color: 'rgba(251,191,36,0.6)' }}>DB ONLY</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-dim)', fontFamily: 'EB Garamond, serif' }}>In Race entity, not in code</div>
          </div>
          <div className="glass-panel rounded-xl p-4 text-center cursor-pointer hover:border-glow-gold transition-all"
            onClick={() => setStatusFilter(statusFilter === 'missing' ? 'All' : 'missing')}>
            <div className="text-2xl font-fantasy font-bold" style={{ color: 'var(--text-dim)' }}>{missingCount}</div>
            <div className="text-xs mt-1 font-fantasy tracking-widest" style={{ color: 'rgba(154,122,88,0.6)' }}>NOT ADDED</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-dim)', fontFamily: 'EB Garamond, serif' }}>Available to add</div>
          </div>
        </div>

        {/* Filters */}
        <div className="glass-panel rounded-xl p-4 mb-5 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-dim)' }} />
            <input
              className="w-full pl-9 pr-3 py-2 rounded-lg input-fantasy text-sm"
              placeholder="Search races..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" style={{ color: 'var(--text-dim)' }} />
            <select className="select-fantasy px-3 py-2 rounded-lg text-sm"
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="All">All Status</option>
              <option value="ingame">In Game</option>
              <option value="dbonly">DB Only</option>
              <option value="missing">Not Added</option>
            </select>
            <select className="select-fantasy px-3 py-2 rounded-lg text-sm"
              value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
              {TIERS.map(t => <option key={t} value={t}>{t === 'All' ? 'All Tiers' : TIER_LABELS[t]}</option>)}
            </select>
            <select className="select-fantasy px-3 py-2 rounded-lg text-sm"
              value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
              {SOURCES.map(s => <option key={s} value={s}>{s === 'All' ? 'All Sources' : s}</option>)}
            </select>
          </div>
          <div className="text-xs" style={{ color: 'var(--text-dim)', fontFamily: 'EB Garamond, serif' }}>
            Showing {filtered.length} of {ALL_RACES.length} entries
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4 text-xs" style={{ fontFamily: 'EB Garamond, serif' }}>
          <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-green-400" /><span style={{ color: 'var(--text-mid)' }}>In Game (gameData.js)</span></div>
          <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-amber-400" /><span style={{ color: 'var(--text-mid)' }}>In DB only</span></div>
          <div className="flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" style={{ color: 'var(--text-dim)' }} /><span style={{ color: 'var(--text-mid)' }}>Not implemented</span></div>
          <span className="mx-2" style={{ color: 'var(--text-dim)' }}>|</span>
          {Object.entries(TIER_LABELS).map(([k, v]) => (
            <span key={k} className={`px-2 py-0.5 rounded border text-xs ${TIER_COLORS[k]}`}>{v}</span>
          ))}
        </div>

        {/* Table */}
        <div className="glass-panel rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(184,115,51,0.25)', background: 'rgba(10,5,2,0.6)' }}>
                <th className="text-left px-4 py-3 font-fantasy text-xs tracking-widest" style={{ color: 'var(--text-dim)' }}>STATUS</th>
                <th className="text-left px-4 py-3 font-fantasy text-xs tracking-widest" style={{ color: 'var(--text-dim)' }}>RACE NAME</th>
                <th className="text-left px-4 py-3 font-fantasy text-xs tracking-widest" style={{ color: 'var(--text-dim)' }}>SOURCE</th>
                <th className="text-left px-4 py-3 font-fantasy text-xs tracking-widest hidden md:table-cell" style={{ color: 'var(--text-dim)' }}>TIER</th>
                <th className="text-left px-4 py-3 font-fantasy text-xs tracking-widest hidden lg:table-cell" style={{ color: 'var(--text-dim)' }}>NOTES</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((race, i) => {
                const status = getStatus(race);
                return (
                  <tr key={`${race.name}-${race.source}-${i}`}
                    style={{
                      borderBottom: '1px solid rgba(184,115,51,0.1)',
                      background: i % 2 === 0 ? 'rgba(0,0,0,0.1)' : 'transparent',
                    }}>
                    <td className="px-4 py-2.5">
                      {status === 'ingame' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                      {status === 'dbonly' && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                      {status === 'missing' && <XCircle className="w-4 h-4" style={{ color: 'var(--text-dim)' }} />}
                    </td>
                    <td className="px-4 py-2.5 font-medium" style={{
                      color: status === 'ingame' ? 'var(--parchment)' : status === 'dbonly' ? 'var(--brass-gold)' : 'var(--text-dim)',
                      fontFamily: 'EB Garamond, serif',
                    }}>
                      {race.name}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'rgba(184,115,51,0.7)', fontFamily: 'EB Garamond, serif' }}>
                      {race.source}
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      <span className={`px-2 py-0.5 rounded border text-xs ${TIER_COLORS[race.tier]}`}>
                        {TIER_LABELS[race.tier]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs hidden lg:table-cell" style={{ color: 'var(--text-dim)', fontFamily: 'EB Garamond, serif', maxWidth: '280px' }}>
                      {race.notes}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12" style={{ color: 'var(--text-dim)', fontFamily: 'EB Garamond, serif' }}>
              No races match your filters.
            </div>
          )}
        </div>

        {/* Recommendation Section */}
        <div className="mt-6 glass-panel rounded-xl p-5">
          <h2 className="font-fantasy text-lg mb-3" style={{ color: 'var(--brass-gold)' }}>💡 Recommended Additions</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-mid)', fontFamily: 'EB Garamond, serif' }}>
            These popular official races are commonly seen in 5E play and not yet in your game:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { name: 'Aarakocra', reason: 'Very popular — bird-folk with fly speed. Player favorite.' },
              { name: 'Changeling', reason: 'Unique shapeshifter. Great for roleplay-heavy campaigns.' },
              { name: 'Goblin', reason: 'Hugely popular for villain-turned-hero arcs. Small but fierce.' },
              { name: 'Kobold', reason: 'Pack Tactics + Dragon Sorcerer combos are very popular.' },
              { name: 'Harengon', reason: 'Rabbit-folk from Wild Beyond Witchlight. Hare-Trigger initiative.' },
              { name: 'Fairy',    reason: 'Flight + Fey type. Very popular in MotM and newer campaigns.' },
              { name: 'Owlin',    reason: 'Owl-folk with flight and Keen Senses. Easy to implement.' },
              { name: 'Shifter',  reason: 'Werewolf-adjacent. Shifting mechanic is simple but flavorful.' },
              { name: 'Dhampir',  reason: 'Vampire-blooded. Great for dark / gothic campaign tones.' },
            ].map(r => (
              <div key={r.name} className="rounded-lg p-3"
                style={{ background: 'rgba(30,15,5,0.6)', border: '1px solid rgba(184,115,51,0.2)' }}>
                <div className="font-fantasy text-sm mb-1" style={{ color: 'var(--brass-gold)' }}>{r.name}</div>
                <div className="text-xs" style={{ color: 'var(--text-dim)', fontFamily: 'EB Garamond, serif' }}>{r.reason}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}