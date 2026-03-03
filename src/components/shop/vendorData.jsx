// ─── Vendor Seed Data ─────────────────────────────────────────────────────────

export const VENDOR_TYPE_META = {
  alchemist:    { icon: '⚗️',  label: 'Alchemist',         color: '#86efac', borderColor: 'rgba(40,160,80,0.3)',   bg: 'rgba(10,40,15,0.75)' },
  blacksmith:   { icon: '🔨',  label: 'Blacksmith',        color: '#fca5a5', borderColor: 'rgba(180,30,30,0.3)',   bg: 'rgba(40,10,10,0.75)' },
  armorer:      { icon: '🛡️',  label: 'Armorer',           color: '#93c5fd', borderColor: 'rgba(60,120,220,0.3)',  bg: 'rgba(10,25,50,0.75)' },
  general:      { icon: '🛒',  label: 'General Store',     color: '#fde68a', borderColor: 'rgba(200,150,20,0.3)',  bg: 'rgba(40,30,5,0.75)' },
  tavern_inn:   { icon: '🏨',  label: 'Tavern & Inn',      color: '#fb923c', borderColor: 'rgba(200,80,20,0.3)',   bg: 'rgba(40,20,5,0.75)' },
  tavern_pub:   { icon: '🍺',  label: 'Tavern',            color: '#fdba74', borderColor: 'rgba(180,100,10,0.3)',  bg: 'rgba(35,18,3,0.75)' },
  brothel:      { icon: '🌹',  label: 'Establishment',     color: '#f9a8d4', borderColor: 'rgba(220,60,120,0.3)',  bg: 'rgba(40,8,20,0.75)' },
  traveling:    { icon: '🐪',  label: 'Traveling Merchant', color: '#c084fc', borderColor: 'rgba(140,60,220,0.3)',  bg: 'rgba(30,8,50,0.75)' },
};

export const ITEM_CATEGORY_ICONS = {
  Weapon: '⚔️', Armor: '🛡️', Potion: '🧪', Scroll: '📜', Food: '🍖',
  Drink: '🍺', Service: '🛏️', Tool: '🔧', Clothing: '👘', Trinket: '💎',
  Component: '🌿', Poison: '☠️', Bomb: '💣', Ammunition: '🏹', Misc: '📦',
};

export const RARITY_META = {
  common:    { color: '#e8d5b7', border: 'rgba(180,150,100,0.3)', glow: 'none',                         label: 'Common',    icon: '○' },
  uncommon:  { color: '#86efac', border: 'rgba(40,160,80,0.4)',   glow: '0 0 8px rgba(40,160,80,0.15)', label: 'Uncommon',  icon: '●' },
  rare:      { color: '#93c5fd', border: 'rgba(60,120,220,0.4)',  glow: '0 0 10px rgba(60,120,220,0.2)',label: 'Rare',      icon: '◆' },
  legendary: { color: '#f0c040', border: 'rgba(201,169,110,0.5)', glow: '0 0 14px rgba(201,169,110,0.25)',label:'Legendary', icon: '★' },
};

export const BUY_BACK_CATEGORIES = {
  alchemist:  ['Potion','Component','Poison','Bomb'],
  blacksmith: ['Weapon','Ammunition'],
  armorer:    ['Armor','Shield','Tool'],
  general:    ['Tool','Clothing','Trinket','Misc','Food','Ammunition'],
  tavern_inn: ['Food','Drink'],
  tavern_pub: ['Food','Drink'],
  brothel:    [],
  traveling:  ['Weapon','Armor','Potion','Tool','Trinket','Misc','Clothing'],
};

export const HAGGLE_FLAVOR = {
  alchemist: [
    'The alchemist taps her chin thoughtfully, herbs rustling in her apron pockets.',
    '"Hmm. The market price is firm, but I appreciate a customer who knows value..."',
    '"You drive a hard bargain, but I respect that. Fine — just don\'t tell my guild."',
  ],
  blacksmith: [
    'The dwarf sets down his hammer and squints at you with arms crossed.',
    '"I don\'t haggle. ...Fine, I haggle a little."',
    '"That steel cost me twice what you\'re offering. Best I can do is this."',
  ],
  armorer: [
    'The armorer looks you over as if calculating your exact worth.',
    '"Everything here is hand-crafted. But you\'ve got honest eyes. Maybe a small discount."',
  ],
  general: [
    '"Oh, you want to haggle? I LOVE to haggle! My last customer didn\'t haggle at all, it was boring."',
    '"Between you and me, I bought this lot for half that price. So yes, let\'s talk."',
  ],
  tavern_inn: [
    'The innkeeper wipes down the bar and looks at you with a practiced smile.',
    '"Traveling folk need rest. I won\'t send you to sleep in a ditch. Special rate — just tonight."',
  ],
  tavern_pub: [
    '"Aye, another round and a coin off? You speak my language, friend."',
    '"The bard\'s tab is worse than yours. Fine, drinks are on me tonight... one drink."',
  ],
  brothel: [
    'A slow smile. "Persuasion is a rare art. You seem gifted in it."',
    '"I have... discretionary rates for those who impress me."',
  ],
  traveling: [
    '"My friend! You have the eye of a merchant! I like you. Final offer — and I\'m losing money, I swear it."',
    '"These goods came from Calimshan on camel-back! But for you... a traveler\'s discount."',
  ],
};

export const TRANSACTION_FLAVOR = {
  buy: {
    alchemist:  'The alchemist carefully wraps your purchase and adds a sprig of lavender. "For freshness," she explains.',
    blacksmith: 'The blacksmith grunts approvingly, handing over the item with a calloused grip. "Take care of it."',
    armorer:    'The armorer checks the straps one final time before handing it over. "It\'ll hold."',
    general:    '"Excellent choice! Excellent! Come back anytime — I get new stock every fortnight!"',
    tavern_inn: 'The innkeeper slides the key across the bar with a warm smile. "Breakfast at dawn, if you\'re up for it."',
    tavern_pub: '"There you are, friend. Best in the house — which admittedly isn\'t saying much."',
    brothel:    'The proprietress gestures gracefully toward the private corridor. "Right this way."',
    traveling:  '"A pleasure doing business! You\'ve excellent taste — I can tell immediately."',
  },
  sell: {
    alchemist:  'She holds the item to the light, sniffs it, and nods. "I can work with this."',
    blacksmith: '"Decent piece. A bit worn, but the forge can fix that." He drops the coins on the anvil.',
    armorer:    '"I\'ll need to check the rivets. But yes, I\'ll take it."',
    general:    '"Oh, I can sell anything! Even this. ESPECIALLY this!"',
    tavern_inn: '"We\'ll put it to good use. The kitchen is always hungry."',
    tavern_pub: '"The regulars will enjoy this. Or regret it. Either way — here\'s your coin."',
    brothel:    'A raised eyebrow, a brief inspection, and a quiet nod. The coin is counted without comment.',
    traveling:  '"Gold from my own pouch — the highest compliment I can pay! Done!"',
  },
};

export const REST_FLAVOR = [
  'You sink into the bed — real sheets, a real pillow. The ache in your bones fades as sleep takes you.',
  'Dawn finds you restored. The inn\'s hearth crackles, and the smell of fresh bread reaches your room.',
  'A full night\'s rest in a proper bed. You feel... ready for whatever comes next.',
  'The nightmares stay away for once. You wake with renewed purpose and full vitality.',
];

// ─── Vendor Seed Data ─────────────────────────────────────────────────────────

export const VENDOR_SEED = [
  {
    name: "Mirabel's Mundane Miracles",
    type: "alchemist",
    location: "Market District",
    description: "A shop crammed floor-to-ceiling with hanging herbs, bubbling vials, and labeled jars of things you don't want to identify. Mirabel runs it alone, seemingly in seventeen places at once.",
    greeting: '"Oh! A customer! Come in, come in, don\'t touch the blue jar — that one bites. What can I brew for you?"',
    personality: "Excitable, brilliant, slightly chaotic herbalist-alchemist who talks to her plants",
    portrait_emoji: "👩‍🔬",
    gold_reserve: 350,
    reputation_modifier: 0,
    is_traveling: false,
    is_active: true,
    items: [
      { name: "Potion of Healing", category: "Potion", rarity: "common", base_price: 50, stock: 8, weight: 0.5, description: "Drinking this potion restores 2d4+2 hit points. The potion's red liquid glimmers when agitated.", effect: "Heal 2d4+2 HP", icon: "🧪" },
      { name: "Potion of Greater Healing", category: "Potion", rarity: "uncommon", base_price: 150, stock: 3, weight: 0.5, description: "You regain 4d4+4 hit points when you drink this potion. Its liquid is a deeper crimson.", effect: "Heal 4d4+4 HP", icon: "🧪" },
      { name: "Antitoxin", category: "Potion", rarity: "common", base_price: 50, stock: 4, weight: 0.1, description: "A creature that drinks this vial of liquid gains advantage on saving throws against poison for 1 hour.", effect: "Advantage vs poison 1hr", icon: "🧪" },
      { name: "Alchemist's Fire", category: "Bomb", rarity: "common", base_price: 50, stock: 5, weight: 1, description: "This sticky, adhesive fluid ignites when exposed to air. As an action, you can throw this flask up to 20 feet. On hit, the target takes 1d4 fire damage per turn until they use an action to extinguish.", effect: "1d4 fire/turn", icon: "💣" },
      { name: "Acid Flask", category: "Bomb", rarity: "common", base_price: 25, stock: 6, weight: 1, description: "You can splash the contents of this vial onto a creature or object within 5 feet. On a hit, deals 2d6 acid damage.", effect: "2d6 acid", icon: "💣" },
      { name: "Tanglefoot Bag", category: "Bomb", rarity: "common", base_price: 50, stock: 3, weight: 2, description: "A bag of alchemical goo that, when shattered, covers the target in sticky strands. Target must make DC 14 STR save or be restrained for 2 rounds.", effect: "Restrained 2 rds (DC 14 STR)", icon: "💣" },
      { name: "Healer's Kit", category: "Tool", rarity: "common", base_price: 5, stock: 10, weight: 3, description: "This kit is a leather pouch containing bandages, salves, and splints. 10 uses. Action: stabilize a dying creature.", effect: "Stabilize dying (10 uses)", icon: "🌿" },
      { name: "Poison: Basic", category: "Poison", rarity: "uncommon", base_price: 100, stock: 2, weight: 0.1, description: "A creature hit by the poisoned weapon must make a DC 10 CON save or take 1d4 poison damage and be poisoned until the start of your next turn.", effect: "1d4 poison, DC10 CON", icon: "☠️" },
      { name: "Herbalism Kit", category: "Tool", rarity: "common", base_price: 5, stock: 4, weight: 3, description: "Used to identify and apply herbs. Allows identifying herbal substances and harvesting rare components.", effect: "Herbalism proficiency", icon: "🌿" },
      { name: "Potion of Invisibility", category: "Potion", rarity: "rare", base_price: 500, stock: 1, weight: 0.5, description: "Your body becomes invisible until the potion wears off. Anything you wear or carry is invisible with you. The effect ends if you attack or cast a spell.", effect: "Invisible 1hr or until attack", icon: "🧪" },
      { name: "Potion of Speed", category: "Potion", rarity: "rare", base_price: 400, stock: 1, weight: 0.5, description: "When you drink this potion, you gain the effect of the haste spell for 1 minute (no concentration required).", effect: "Haste 1min (no concentration)", icon: "🧪" },
      { name: "Alchemical Residue", category: "Component", rarity: "common", base_price: 5, stock: 20, weight: 0.1, description: "Leftover alchemical compound useful as a base reagent. Required for some crafting recipes.", icon: "🌿" },
    ]
  },
  {
    name: "Ironhammer & Sons",
    type: "blacksmith",
    location: "Craftsmen's Quarter",
    description: "The smell of burning coal and hot metal hits you before you see the sign. Inside, an enormous dwarf hammers at a glowing ingot, barely looking up when you enter.",
    greeting: '"Hmm. Browsing or buying? If browsing, touch nothing. If buying, name your steel and your gold, and we\'ll talk."',
    personality: "Gruff, no-nonsense dwarf blacksmith. Respects craftsmanship. Will warm up if you show knowledge of weapons.",
    portrait_emoji: "🧔",
    gold_reserve: 500,
    reputation_modifier: 0,
    is_traveling: false,
    is_active: true,
    items: [
      { name: "Longsword", category: "Weapon", rarity: "common", base_price: 15, stock: 5, weight: 3, description: "A versatile weapon with a graceful, double-edged blade. Can be wielded one- or two-handed.", effect: "1d8 slashing (1h) / 1d10 slashing (2h)", icon: "⚔️" },
      { name: "Handaxe", category: "Weapon", rarity: "common", base_price: 5, stock: 8, weight: 2, description: "A light, one-handed axe suitable for close combat or throwing. Thrown range 20/60 ft.", effect: "1d6 slashing, Thrown", icon: "⚔️" },
      { name: "Warhammer", category: "Weapon", rarity: "common", base_price: 15, stock: 3, weight: 2, description: "A heavy hammer favored by dwarves and paladins. Deals bludgeoning damage.", effect: "1d8 bludgeoning (1h) / 1d10 (2h)", icon: "⚔️" },
      { name: "Shortsword", category: "Weapon", rarity: "common", base_price: 10, stock: 6, weight: 2, description: "A nimble one-handed blade, ideal for rogues and duelists. Finesse property.", effect: "1d6 piercing, Finesse, Light", icon: "⚔️" },
      { name: "Dagger", category: "Weapon", rarity: "common", base_price: 2, stock: 15, weight: 1, description: "Small and easily concealed. Can be thrown or used in close quarters.", effect: "1d4 piercing, Finesse, Thrown 20/60", icon: "⚔️" },
      { name: "Greataxe", category: "Weapon", rarity: "common", base_price: 30, stock: 2, weight: 7, description: "A massive two-handed axe that strikes with devastating force. Heavy property.", effect: "1d12 slashing, Heavy, Two-Handed", icon: "⚔️" },
      { name: "Rapier", category: "Weapon", rarity: "common", base_price: 25, stock: 3, weight: 2, description: "An elegant thrusting blade favored by duelists and nobles. Finesse.", effect: "1d8 piercing, Finesse", icon: "⚔️" },
      { name: "Arrow Bundle (20)", category: "Ammunition", rarity: "common", base_price: 1, stock: 30, weight: 1, description: "A bundle of 20 standard arrows suitable for any shortbow or longbow.", icon: "🏹" },
      { name: "Bolt Bundle (20)", category: "Ammunition", rarity: "common", base_price: 1, stock: 20, weight: 1.5, description: "A bundle of 20 crossbow bolts.", icon: "🏹" },
      { name: "+1 Longsword", category: "Weapon", rarity: "rare", base_price: 750, stock: 1, weight: 3, description: "A finely balanced blade with a faint enchantment. Glows faintly blue in the presence of orcs and goblins.", effect: "+1 to attack and damage rolls", icon: "⚔️" },
      { name: "Silvered Dagger", category: "Weapon", rarity: "uncommon", base_price: 102, stock: 2, weight: 1, description: "A dagger coated in silver. Effective against lycanthropes and certain undead.", effect: "1d4 piercing, counts as silvered", icon: "⚔️" },
      { name: "Smith's Tools", category: "Tool", rarity: "common", base_price: 20, stock: 3, weight: 8, description: "Hammers, tongs, and files for working metal. Required for blacksmithing checks.", icon: "🔧" },
      { name: "Whetstone", category: "Tool", rarity: "common", base_price: 1, stock: 20, weight: 1, description: "Used to sharpen bladed weapons. One use to add +1 to a single attack roll.", icon: "🔧" },
    ]
  },
  {
    name: "The Tipped Flagon Inn",
    type: "tavern_inn",
    location: "Market Square",
    description: "A warm, bustling inn with low beams, a crackling hearth, and the smell of roasted meats and spilled ale. The innkeeper, Berna, somehow knows everyone's name by the second visit.",
    greeting: '"Welcome, welcome! You look like someone who needs a hot meal and a proper bed. Lucky you — that\'s exactly what we sell."',
    personality: "Warm, maternal innkeeper who remembers every customer and feeds stray cats",
    portrait_emoji: "👩‍🍳",
    gold_reserve: 150,
    reputation_modifier: 5,
    is_traveling: false,
    is_active: true,
    items: [
      { name: "Hearty Meal", category: "Food", rarity: "common", base_price: 1, stock: 99, weight: 1, description: "A full plate of roast pork, root vegetables, and fresh bread. Provides 1 temp HP per character level after a short rest.", effect: "1 temp HP/level (after short rest)", icon: "🍖" },
      { name: "Traveler's Rations (1 day)", category: "Food", rarity: "common", base_price: 5, stock: 30, weight: 2, description: "Dried meat, hard tack, and dried fruit. Sufficient for one day of travel.", icon: "🍖" },
      { name: "Mug of Ale", category: "Drink", rarity: "common", base_price: 1, stock: 99, weight: 1, description: '"The house brew. It\'s not the worst ale in town — that\'s the Rusty Nail down the road." — Berna', icon: "🍺" },
      { name: "Fine Wine (bottle)", category: "Drink", rarity: "uncommon", base_price: 10, stock: 12, weight: 1.5, description: "A bottle of Amnian red, rich and full-bodied. Suitable for celebrations or bribing nobles.", icon: "🍷" },
      { name: "Dwarven Spirits", category: "Drink", rarity: "uncommon", base_price: 8, stock: 8, weight: 1, description: '"One mug will warm you for a mile. Two mugs and you\'ll fight a troll. Three mugs and you\'ll love one." — Old saying', icon: "🥃" },
      { name: "Common Room (1 night)", category: "Service", rarity: "common", base_price: 5, stock: 10, weight: 0, description: "A cot in the common room with other travelers. Counts as a long rest. Restores all HP and spell slots.", effect: "Full long rest (HP + spell slots)", icon: "🛏️" },
      { name: "Private Room (1 night)", category: "Service", rarity: "uncommon", base_price: 15, stock: 4, weight: 0, description: "A private room with a real bed, a wash basin, and a lock on the door. Long rest with advantage on next day's initiative.", effect: "Long rest + Advantage on Initiative (next day)", icon: "🛏️" },
      { name: "Lavish Suite (1 night)", category: "Service", rarity: "rare", base_price: 50, stock: 1, weight: 0, description: "The finest room in the inn, with a bath, feather bed, and a view of the square. Resting here grants +2 to all saving throws until next rest.", effect: "Long rest + +2 saves until next rest", icon: "🛏️" },
      { name: "Hot Bath", category: "Service", rarity: "common", base_price: 3, stock: 5, weight: 0, description: "A copper tub of hot water, soap, and towels. Removes the Exhausted condition (level 1) or reduces exhaustion by 1.", effect: "Remove 1 Exhaustion level", icon: "🛁" },
      { name: "Rumor & Directions", category: "Service", rarity: "common", base_price: 2, stock: 99, weight: 0, description: '"For two copper, I\'ll tell you what the merchants are talking about. For a silver, I\'ll tell you what they\'re not talking about." — Berna', icon: "📜" },
    ]
  },
  {
    name: "Zandros of the Long Road",
    type: "traveling",
    location: "Town Gates (Traveling)",
    description: "A sun-darkened merchant with a loaded camel, a dozen mysterious crates, and the cheerful demeanor of someone who has escaped danger so many times it stopped being interesting.",
    greeting: '"Ahhhh! A buyer! The gods smile today! I have just arrived from — well, does the origin matter? Look at what I HAVE!"',
    personality: "Charming, theatrical Calishite merchant. Haggles with genuine enthusiasm. Prices are negotiable — everything is negotiable.",
    portrait_emoji: "🧙",
    gold_reserve: 400,
    reputation_modifier: -5,
    is_traveling: true,
    is_active: true,
    items: [
      { name: "Bag of Holding", category: "Trinket", rarity: "rare", base_price: 500, stock: 1, weight: 0.5, description: "This bag's interior space is considerably larger than its outside dimensions. It can hold up to 500 lb of material, not exceeding a volume of 64 cubic feet.", effect: "Holds 500lb / 64 cubic ft regardless of bag size", icon: "💎" },
      { name: "Sending Stones (pair)", category: "Trinket", rarity: "uncommon", base_price: 300, stock: 1, weight: 1, description: "These malachite stones come in pairs. You can use one to cast Sending to the holder of the other stone, once per day.", effect: "Cast Sending (1/day per stone)", icon: "💎" },
      { name: "Rope of Climbing", category: "Tool", rarity: "uncommon", base_price: 200, stock: 1, weight: 3, description: "This 60-foot length of silk rope can animate at your command, climbing, knotting, or coiling as needed.", effect: "Climbs 60ft on command", icon: "🔧" },
      { name: "Exotic Spices (pouch)", category: "Misc", rarity: "common", base_price: 20, stock: 5, weight: 0.5, description: "A rich blend from Calimshan: saffron, pepper, and something unidentifiable but fragrant. Trade goods worth 20gp in any city.", icon: "📦" },
      { name: "Silk Rope (50 ft)", category: "Tool", rarity: "common", base_price: 10, stock: 4, weight: 5, description: "Strong, smooth rope that doesn't fray easily. Advantage on checks involving climbing with this rope.", icon: "🔧" },
      { name: "Lantern, Bullseye", category: "Tool", rarity: "common", base_price: 10, stock: 3, weight: 2, description: "A lamp that casts a 60-foot cone of bright light and an additional 60 feet of dim light.", icon: "🔧" },
      { name: "Cloak of Elvenkind", category: "Clothing", rarity: "uncommon", base_price: 800, stock: 1, weight: 1, description: "While you wear this cloak with its hood up, Wisdom (Perception) checks made to see you have disadvantage. Stealth checks made to hide have advantage.", effect: "Advantage on Stealth, Disadvantage on checks to spot you", icon: "👘" },
      { name: "Mysterious Vial", category: "Potion", rarity: "uncommon", base_price: 75, stock: 2, weight: 0.5, description: '"I\'m... fairly certain it\'s a healing potion. 85% certain. Maybe 80%. The label is in Elvish." — Zandros', effect: "Unknown (roll d6: 1-4 Healing Potion, 5 Potion of Poison, 6 Water)", icon: "🧪" },
      { name: "Compass", category: "Tool", rarity: "common", base_price: 15, stock: 2, weight: 0.5, description: "A brass compass that always points to the nearest large body of fresh water — not north, as most people assume until it's too late.", icon: "🔧" },
      { name: "Calishite Carpet (small)", category: "Misc", rarity: "uncommon", base_price: 60, stock: 2, weight: 10, description: "A beautifully woven carpet. Clearly not a flying carpet — Zandros is very insistent about this.", icon: "📦" },
      { name: "Thieves' Tools", category: "Tool", rarity: "common", base_price: 25, stock: 2, weight: 1, description: "This set of tools includes a small file, a set of lock picks, a small mirror, a set of narrow-bladed scissors, and a pair of pliers.", icon: "🔧" },
      { name: "Potion of Climbing", category: "Potion", rarity: "common", base_price: 75, stock: 2, weight: 0.5, description: "When you drink this potion, you gain a climbing speed equal to your walking speed for 1 hour.", effect: "Climbing speed = walking speed, 1hr", icon: "🧪" },
      { name: "Perfume (vial)", category: "Misc", rarity: "common", base_price: 5, stock: 6, weight: 0.1, description: '"From the harems of Calimshan. All three marriages were MY idea." — Zandros', icon: "📦" },
      { name: "Spyglass", category: "Tool", rarity: "uncommon", base_price: 1000, stock: 1, weight: 1, description: "Objects viewed through this lens appear magnified to twice their size.", effect: "2× magnification", icon: "🔧" },
    ]
  },
];