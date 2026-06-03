import React from 'react';
import { CLASSES, ALIGNMENTS } from '@/components/game/gameData';
import { Input } from '@/components/ui/input';
import { Dices } from 'lucide-react';
import StepMulticlass from './StepMulticlass';

const RACE_NAMES = {
  Human:    { first: ['Aldric','Brynn','Cassian','Dareth','Elena','Fiona','Gareth','Helena','Ivar','Jorin','Kael','Lyra','Marcus','Nessa','Osric','Petra','Quinn','Rowan','Seren','Theron','Vala','Wren','Xander','Yara','Zara'], last: ['Ashford','Blackwood','Crestfall','Dunmore','Eldergrove','Fairwind','Greystone','Hartwell','Ironforge','Kingsley'] },
  Elf:      { first: ['Aelindra','Caelion','Erevan','Faelora','Galanodel','Ielenia','Lythien','Miriael','Naevys','Quillathe','Rylai','Sylvaris','Thalion','Vaelora','Zephyria','Arannis','Daeron','Haelion','Ivellios','Korrilar'], last: ['Amakiir','Galanodel','Liadon','Meliamne','Naïlo','Siannodel','Xiloscient'] },
  Dwarf:    { first: ['Barendd','Dagnal','Eberk','Falkrunn','Gardain','Helga','Ilikan','Kathra','Orsik','Runyak','Tordek','Vistra','Whurdred','Yuriel','Thoradin','Amber','Gurdis','Kildrak','Mardred','Rangrim'], last: ['Balderk','Battlehammer','Fireforge','Frostbeard','Holderhek','Ironfist','Strakeln','Torunn','Ungart'] },
  Halfling: { first: ['Andry','Bree','Cade','Corrin','Eldon','Garret','Jillian','Lavinia','Merric','Nedda','Osborn','Paela','Roscoe','Seraphina','Wendle','Cora','Finnan','Kithri','Lidda','Wellby'], last: ['Brushgather','Goodbarrel','Greenbottle','Highhill','Leagallow','Tealeaf','Thorngage','Underbough'] },
  Gnome:    { first: ['Alston','Brocc','Dimble','Ellywick','Frug','Gerbo','Jebeddo','Lilli','Namfoodle','Orryn','Roywyn','Scheppen','Warryn','Wrenn','Zook','Bimpnottin','Caramip','Donella','Nissa','Tana'], last: ['Beren','Daergel','Folkor','Garrick','Nackle','Scheppen','Timbers','Turen'] },
  'Half-Elf':  { first: ['Aelric','Brenna','Caelum','Dara','Elowen','Finnian','Galen','Isolde','Kieran','Lirien','Maelis','Riven','Sable','Tanis','Varen'], last: ['Amastacia','Brightwood','Dawntracker','Moonshadow','Starweaver','Windwalker'] },
  'Half-Orc':  { first: ['Baggi','Dench','Feng','Gell','Henk','Holg','Imsh','Keth','Mhurren','Ront','Shump','Thokk','Vola','Yevelda','Krusk','Sutha','Emen','Engong'], last: ['Ashbane','Bonecrusher','Doomhammer','Ironjaw','Skullsplitter','Warbringer'] },
  Tiefling: { first: ['Akta','Bryseis','Criella','Damaia','Ekemon','Kairon','Lerissa','Makos','Nemeia','Orianna','Pelaios','Rieta','Skamos','Therai','Valeria','Zariel','Amnon','Leucis'], last: ['Virtue names are common — also: Ash','Despair','Glory','Hope','Music','Nowhere','Poetry','Quest','Torment','Weary'] },
  Dragonborn: { first: ['Arjhan','Balasar','Bharash','Donaar','Ghesh','Heskan','Kriv','Medrash','Mehen','Nadarr','Pandjed','Patrin','Rhogar','Shamash','Shedinn','Tarhun','Torinn'], last: ['Clethtinthiallor','Daardendrian','Delmirev','Kerrhylon','Kimbatuul','Myastan','Norixius','Shestendeliath','Turnuroth','Verthisathurgiesh'] },
  Aasimar:  { first: ['Auriel','Celestine','Dawneth','Elariel','Hariel','Israphel','Kalael','Lumiel','Mihrael','Raziel','Sariel','Uriel','Vaelith','Zaphiel','Seraphine'], last: ['Dawnbringer','Lightbane','Morningstar','Radiance','Sunwarden'] },
  Goliath:  { first: ['Aukan','Eglath','Gae-Al','Ilikan','Keothi','Kuori','Lo-Kag','Manneo','Nalla','Orilo','Paavu','Thotham','Uthal','Vaunea','Vimak'], last: ['Anakalathai','Elanithino','Gathakanathi','Kolae-Gileana','Ogolakanu','Thuliaga','Uthela-Kaathi','Vaimei-Laga'] },
  Tabaxi:   { first: ['Cloud on the Mountaintop','Dusk Runner','Jade Claw','Lightning on the Branch','Mist Walker','Night Whisper','Rain on Still Water','Seven Thundercloud','Star Gazer','Swift Hunter','Twilight Prowler','Whisper of Wind'], last: [] },
  Kenku:    { first: ['Clatter','Creak','Dagger','Flicker','Hammer','Latch','Pluck','Scratch','Shimmer','Slash','Snap','Squall','Thump','Whistle'], last: [] },
  Firbolg:  { first: ['Adran','Arannis','Beren','Dayereth','Galinndan','Immeral','Mindartis','Riardon','Soveliss','Theren','Varis'], last: [] },
  Warforged:{ first: ['Anchor','Bastion','Bulwark','Clank','Crucible','Forge','Graven','Hammer','Iron','Mason','Pierce','Pivot','Piston','Relic','Sentinel','Torch','Warden'], last: [] },
  Goblin:   { first: ['Blix','Droop','Fizgig','Grik','Krek','Lunk','Midge','Nix','Pog','Ratch','Skrag','Twig','Vex','Yik','Zurk'], last: [] },
  Kobold:   { first: ['Arix','Drak','Eek','Gix','Irk','Kurtulmak','Meepo','Nesk','Pun-Pun','Rix','Sniv','Tik','Urd','Yik'], last: [] },
};
const GENERIC_FIRST = ['Ash','Blade','Cinder','Drake','Echo','Flint','Grey','Hawk','Ivory','Jade','Kaine','Lark','Morrow','Nyx','Onyx','Pike','Raven','Shade','Thorn','Vale','Wolf','Ember','Storm','Dusk'];
const GENERIC_LAST = ['Blackthorn','Coldsteel','Dawnstrider','Farseer','Grimshaw','Hearthstone','Ironveil','Nighthollow','Ravencrest','Shadowmend','Stormwind','Thornwall','Winterborn','Ashvale'];

const RACE_AGE_PROFILES = {
  Elf: { young: 100, elder: 600 }, Dwarf: { young: 50, elder: 300 }, Gnome: { young: 40, elder: 300 },
  Halfling: { young: 20, elder: 100 }, Dragonborn: { young: 15, elder: 65 }, Aasimar: { young: 20, elder: 130 },
  Goliath: { young: 18, elder: 65 }, Firbolg: { young: 30, elder: 300 }, Tabaxi: { young: 15, elder: 60 },
  Kenku: { young: 12, elder: 50 }, Tortle: { young: 15, elder: 45 }, Warforged: { young: 5, elder: 80 },
  Goblin: { young: 10, elder: 45 }, Kobold: { young: 8, elder: 80 }, Orc: { young: 12, elder: 45 },
  Centaur: { young: 15, elder: 70 }, Leonin: { young: 15, elder: 70 }, Harengon: { young: 10, elder: 55 },
  Owlin: { young: 12, elder: 60 }, Bugbear: { young: 12, elder: 55 }, 'Ogrekin (Half-Ogre)': { young: 14, elder: 60 },
  default: { young: 18, elder: 65 },
};

const YOUNG_BY_RACE = {
  Dwarf: ['Pebble','Cinder','Keg','Spark'], Elf: ['Lira','Fae','Ari','Nim'], Halfling: ['Pip','Merry','Nim','Tilly'],
  Gnome: ['Fizz','Tink','Nib','Widget'], Goblin: ['Nib','Skik','Pip','Zit'], Kobold: ['Tik','Pip','Vix','Nib'],
};
const ELDER_TITLES = ['Elder', 'Old', 'Grey', 'Wise'];

function getAgeCategory(race, age) {
  const numberAge = Number(age);
  if (!numberAge) return 'adult';
  const profile = RACE_AGE_PROFILES[race] || RACE_AGE_PROFILES.default;
  if (numberAge < profile.young) return 'young';
  if (numberAge >= profile.elder) return 'elder';
  return 'adult';
}

function randomName(race, age) {
  const pool = RACE_NAMES[race];
  const ageCategory = getAgeCategory(race, age);
  const firstNames = ageCategory === 'young' && YOUNG_BY_RACE[race]?.length ? YOUNG_BY_RACE[race] : (pool?.first?.length ? pool.first : GENERIC_FIRST);
  const lastNames = pool?.last?.length ? pool.last : GENERIC_LAST;
  const first = firstNames[Math.floor(Math.random() * firstNames.length)];
  const baseName = lastNames.length ? `${first} ${lastNames[Math.floor(Math.random() * lastNames.length)]}` : first;
  if (ageCategory === 'elder') return `${ELDER_TITLES[Math.floor(Math.random() * ELDER_TITLES.length)]} ${baseName}`;
  return baseName;
}

const STAT_LABELS = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' };

const CLASS_ICONS = {
  Fighter: '⚔️', Rogue: '🗡️', Wizard: '🔮', Cleric: '✨', Ranger: '🏹',
  Paladin: '🛡️', Barbarian: '🪓', Bard: '🎵', Druid: '🌿', Monk: '👊', Sorcerer: '💫', Warlock: '👁️'
};

export default function StepClassInfo({ character, set }) {
  const selectedClass = CLASSES[character.class];
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-amber-300 mb-1">Name & Class</h2>
        <p className="text-amber-400/50 text-sm mb-4">Define your hero's identity and calling.</p>
      </div>

      {/* Name + Level + Alignment row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-1">
          <label className="text-amber-400/80 text-xs uppercase tracking-widest mb-1.5 block">Hero Name</label>
          <div className="flex gap-2">
            <Input value={character.name} onChange={e => set('name', e.target.value)}
              placeholder="Enter name..."
              className="bg-slate-800/60 border-slate-600 text-amber-100 placeholder-slate-500 flex-1" />
            <button
              onClick={() => set('name', randomName(character.race, character.age))}
              title="Randomize name using race and age"
              className="px-2.5 rounded-md border border-amber-700/50 bg-amber-900/30 text-amber-400 hover:bg-amber-800/40 hover:border-amber-600/60 transition-all flex-shrink-0">
              <Dices className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div>
          <label className="text-amber-400/80 text-xs uppercase tracking-widest mb-1.5 block">Starting Level</label>
          <div className="flex items-center gap-3 h-10">
            <input type="range" min={1} max={20} value={character.level}
              onChange={e => set('level', Number(e.target.value))}
              className="flex-1 accent-amber-500" />
            <span className="text-amber-300 font-bold text-lg w-8">{character.level}</span>
          </div>
        </div>
        <div>
          <label className="text-amber-400/80 text-xs uppercase tracking-widest mb-1.5 block">Alignment</label>
          <select value={character.alignment} onChange={e => set('alignment', e.target.value)}
            className="w-full bg-slate-800/60 border border-slate-600 rounded-md text-amber-100 px-3 py-2 text-sm outline-none">
            {ALIGNMENTS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* Class Grid */}
      <div>
        <label className="text-amber-400/80 text-xs uppercase tracking-widest mb-2 block">Choose Class</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {Object.entries(CLASSES).map(([cls, data]) => (
            <button key={cls} onClick={() => { set('class', cls); set('subclass', ''); }}
              className={`p-3 rounded-xl border text-left transition-all ${character.class === cls ? 'border-purple-500 bg-purple-900/20' : 'border-slate-700/50 bg-slate-800/30 hover:border-purple-700/50'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{CLASS_ICONS[cls] || '⚡'}</span>
                <span className="font-bold text-purple-200 text-sm">{cls}</span>
              </div>
              <div className="text-slate-500 text-xs">d{data.hit_die} · {data.saves.map(s => STAT_LABELS[s]).join('/')}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Class Details */}
      {selectedClass && (
        <div className="bg-purple-900/10 border border-purple-700/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{CLASS_ICONS[character.class]}</span>
            <div>
              <div className="font-bold text-purple-200">{character.class}</div>
              <div className="text-purple-400/60 text-sm">{selectedClass.description}</div>
            </div>
          </div>
          <div className="text-xs text-slate-400">
            <span className="text-slate-300">Features: </span>
            {Object.entries(selectedClass.features || {}).map(([lvl, feats]) =>
              parseInt(lvl) <= character.level ? `Lv.${lvl}: ${feats.join(', ')}` : null
            ).filter(Boolean).join(' · ')}
          </div>
          <div className="text-xs text-amber-400/50">
            ✨ You'll choose your subclass in the next step.
          </div>
        </div>
      )}

      {/* Multiclass section — only show when a primary class is selected */}
      {character.class && (
        <StepMulticlass character={character} set={set} />
      )}
    </div>
  );
}