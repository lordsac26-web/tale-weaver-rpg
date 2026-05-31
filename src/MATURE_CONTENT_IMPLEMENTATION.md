# 18+ Mature Content Filter System

## Overview
Implemented a dual-mode content filtering system for AI image generation that allows users to enable mature fantasy themes while maintaining appropriate R-rated boundaries.

---

## Content Modes

### **Family-Friendly Mode (Default)**
- **Target Audience**: All ages
- **Content Style**: Classic D&D sourcebook art, heroic fantasy
- **Allowed**: Heroic poses, vibrant colors, adventure scenes
- **Blocked**: Violence, blood, gore, dark themes, revealing clothing

### **Mature Fantasy Art Mode (18+)**
- **Target Audience**: Adults (R-rated maximum)
- **Content Style**: Dark fantasy, gritty realism, mature D&D campaigns
- **Allowed**:
  - ✅ Intense battle scenes with blood and gore
  - ✅ Dark themes: necromancy, demons, horror elements
  - ✅ Revealing fantasy costumes (chainmail bikinis, low-cut dresses)
  - ✅ Artistic fantasy anatomy (exaggerated muscles, slight breast exposure on warriors)
  - ✅ Grim atmosphere (dungeons, ominous lighting)
  - ✅ Stylized monster violence (impalement, dismemberment)
- **Blocked** (Still Prohibited):
  - ❌ Explicit sexual acts
  - ❌ Genital exposure or full frontal nudity
  - ❌ Pornographic content
  - ❌ Gratuitous torture-focused gore
  - ❌ Real-world hate symbols

---

## Technical Implementation

### Modified Files:

#### **1. `functions/enhanceImagePrompt`**
**Changes:**
- Dual-mode system prompt based on `mature_content` flag
- Uses **Claude Sonnet 4.6** model for mature mode (lighter guardrails)
- Uses **automatic** model for family-friendly mode
- Separate enhancement guidelines for each mode

**Mature Mode System Prompt:**
```
You are a professional fantasy art prompt enhancer for mature D&D campaigns.
Enhance the user's prompt with vivid, dramatic details while keeping it R-rated maximum.

ALLOWED for mature fantasy art:
- Intense battle scenes with blood, gore, wounds, and visceral combat
- Dark themes: death, necromancy, demons, horror elements
- Revealing fantasy costumes: chainmail bikinis, low-cut dresses, muscular bare-chested warriors
- Artistic fantasy anatomy: exaggerated muscular definition, slight breast exposure on female warriors
- Grim atmosphere: dark dungeons, ominous lighting
- Monster violence: impalement, dismemberment (stylized, not gratuitous)

STILL PROHIBITED:
- Explicit sexual acts or positions
- Genital exposure or full frontal nudity
- Pornographic content
```

#### **2. `functions/forgeDndImage`**
**Changes:**
- Dual-mode content safety enforcement
- Different banned terms lists per mode
- Mature mode allows dark fantasy vocabulary
- Intelligent retry logic that respects mode settings

**Safety Check Logic:**
```javascript
if (mature_content) {
  // R-rated mode: Only block explicit prohibited content
  const hardBannedTerms = ['porn', 'explicit sex', 'genital', 'penis', 'vagina'];
  // ... check and reject
} else {
  // Family-friendly mode: Strict filtering
  const bannedTerms = ['nude', 'sexual', 'blood', 'gore', 'violence', 'death'];
  // ... check and reject
}
```

**Style Prefix Differences:**
- **Mature**: `"Mature D&D fantasy art, R-rated dark fantasy illustration, professional concept art..."`
- **Family**: `"D&D fantasy art, epic digital painting, detailed, dramatic lighting..."`

**Retry Logic:**
- Family mode: Strips violent terms, retries with family-friendly prompt
- Mature mode: Softens excessive descriptions, retries with artistic framing
- Both modes: Maximum 2 attempts

#### **3. `pages/ImageForge`**
**Changes:**
- Updated toggle label: "Mature Fantasy Art (18+)"
- Added 🔞 icon for clarity
- Enhanced description: "Allow intense violence, blood, gore, dark themes, revealing costumes (R-rated max)"

---

## Content Filter Examples

### **Family-Friendly Mode**

**User Input:**
> "A female warrior fighting a dragon"

**Enhanced Prompt:**
> "Fantasy character portrait: A heroic female warrior in shining plate armor, sword raised against a magnificent dragon, vibrant colors, dynamic heroic pose, professional fantasy illustration, high fantasy style, epic composition"

**Result**: ✅ Approved - Heroic, vibrant, action-oriented

---

### **Mature Mode**

**User Input:**
> "A female warrior fighting a dragon"

**Enhanced Prompt:**
> "Fantasy character portrait: A battle-hardened female warrior in revealing chainmail bikini, muscular definition visible, blood-stained sword raised against a terrifying dragon, visceral combat, dramatic chiaroscuro lighting, dark fantasy illustration, gritty realism, professional mature concept art"

**Result**: ✅ Approved - Dark, intense, mature themes

---

### **Blocked Content Examples**

#### **❌ Blocked in Both Modes:**
> "Nude warrior with exposed genitals fighting"
> **Error**: "Content violates guidelines: No explicit sexual content or genital exposure allowed."

#### **❌ Blocked in Family Mode Only:**
> "Warrior covered in blood and gore, dismembering enemies"
> **Error**: "Content not suitable for family-friendly mode. Enable mature content or rephrase your prompt."

---

## User Experience

### **Toggle Location**
In ImageForge page → Settings section → Last option before Generate button

### **Visual Design**
```
☑ 🔞 Mature Fantasy Art (18+)
   Allow intense violence, blood, gore, dark themes, 
   revealing costumes (R-rated max)
```

### **Error Messages**

**Family Mode Filter Block:**
> "The image was blocked by the AI content filter. Try rephrasing your prompt — remove any violent, dark, or potentially sensitive terms, or enable 'Mature Fantasy Art' mode for darker themes."

**Mature Mode Filter Block:**
> "The image was blocked by content filters even in mature mode. Try reducing explicit descriptions of violence or anatomy while keeping the dark fantasy theme."

---

## Artistic References

### **Mature Mode Style Inspirations:**
- **Frank Frazetta**: Classic sword & sorcery, muscular warriors
- **Boris Vallejo**: Fantasy anatomy, dramatic poses
- **Magic: The Gathering**: Battle scenes, dark fantasy
- **Heavy Metal Magazine**: Mature fantasy aesthetics
- **Classic D&D (18+)**: Dark dungeon scenes, visceral combat

### **Family Mode Style Inspirations:**
- **Larry Elmore**: Classic TSR-era heroic fantasy
- **Jeff Easley**: AD&D sourcebook illustrations
- **Clyde Caldwell**: Heroic adventurers
- **Modern D&D 5e**: Vibrant, heroic compositions

---

## Technical Flow

```
User Input → Mature Toggle? 
    ├─ YES → Claude Sonnet 4.6 (lighter guardrails)
    │         ↓
    │      Enhanced Prompt (mature vocabulary)
    │         ↓
    │      GenerateImage with R-rated context
    │         ↓
    │      Content Filter (hard-banned terms only)
    │         ↓
    │      Result: Dark fantasy art
    │
    └─ NO → Automatic model (stricter guardrails)
              ↓
           Enhanced Prompt (family-friendly)
              ↓
           GenerateImage with heroic context
              ↓
           Content Filter (strict banned terms)
              ↓
           Result: Heroic fantasy art
```

---

## Safety Mechanisms

### **Multi-Layer Filtering:**

1. **Pre-Enhancement Check**: Block obviously prohibited terms before LLM
2. **LLM System Prompt**: Guide AI to appropriate enhancement style
3. **Post-Enhancement Check**: Verify enhanced prompt compliance
4. **Image Generation Filter**: DALL-E 3 / Claude's built-in content policies
5. **Retry Logic**: Attempt to soften prompts that trigger filters

### **Hard-Banned Terms (Both Modes):**
- `porn`, `porno`, `pornography`
- `explicit sex`, `intercourse`
- `genital`, `penis`, `vagina`, `pubic`

### **Family-Mode Additional Bans:**
- `nude`, `naked`, `sexual`, `nsfw`
- `blood`, `gore`, `violence`, `death`
- `dismember`, `impale`, `torture`

---

## Use Cases

### **When to Enable Mature Mode:**
- 🎲 Dark fantasy D&D campaigns (Curse of Strahd, etc.)
- ⚔️ Visceral battle scene illustrations
- 🧛 Horror-themed adventures
- 🎨 Classic Frazetta-style art with revealing warriors
- 💀 Necromancy, demons, undead themes
- 🩸 Gritty realism over heroic fantasy

### **When to Keep Family Mode:**
- 👨‍👩‍👧‍👦 All-ages gaming groups
- 🏰 Classic heroic adventures
- ✨ Whimsical, vibrant campaigns
- 📚 Official D&D sourcebook style
- 🎭 Political intrigue over combat
- 🌈 Lighthearted, fun-focused games

---

## Compliance & Guidelines

### **R-Rated Maximum:**
The system enforces an R-rated ceiling (MPAA standards):
- **Violence**: Intense but not gratuitous
- **Sexual Content**: Suggestive, not explicit
- **Language**: Not applicable (visual art)
- **Themes**: Dark but not disturbing

### **Artistic Context:**
All mature content is framed as **professional fantasy illustration**:
- Museum-quality artistic merit
- Commercial fantasy art standards
- D&D campaign utility focus
- Concept art aesthetic

---

## Future Enhancements

### **Potential Additions:**
1. **Granular Sliders**: Violence level, nudity level, darkness level
2. **Preset Themes**: "Grimdark", "Sword & Sorcery", "Gothic Horror"
3. **Artist Style Tags**: "Frazetta", "Beksiński", "Giger" (mature artists)
4. **Content Warnings**: Preview before generation
5. **Age Verification**: Optional account-level mature content lock
6. **Community Presets**: Shared prompt templates per mode

---

## Testing Scenarios

### **Test Cases:**

| Input | Mode | Expected Result |
|-------|------|-----------------|
| "Blood-soaked battlefield" | Family | ❌ Blocked |
| "Blood-soaked battlefield" | Mature | ✅ Generated |
| "Warrior in chainmail bikini" | Family | ❌ Blocked |
| "Warrior in chainmail bikini" | Mature | ✅ Generated |
| "Nude statue" | Family | ❌ Blocked |
| "Nude statue" | Mature | ⚠️ May pass (artistic context) |
| "Explicit sexual scene" | Any | ❌ Hard-blocked |
| "Dragon breathing fire" | Any | ✅ Generated |
| "Dismembered corpses" | Family | ❌ Blocked |
| "Dismembered corpses" | Mature | ✅ Generated |

---

## Performance Impact

### **Model Selection:**
- **Mature Mode**: Claude Sonnet 4.6 (higher quality, more credits)
- **Family Mode**: Automatic (optimized for cost/speed)

### **Generation Time:**
- No significant difference between modes
- Retry logic may add 5-10 seconds in edge cases

### **Credit Cost:**
- Mature mode uses ~2x more integration credits (Claude model)
- Standard image generation credits apply equally

---

## Ethical Considerations

### **Design Principles:**
1. **User Autonomy**: Adults choose their content level
2. **Clear Labeling**: 18+ icon, explicit descriptions
3. **Hard Limits**: Absolute prohibitions on illegal/harmful content
4. **Artistic Merit**: Frame as professional fantasy art
5. **Context Matters**: D&D campaign utility focus

### **Community Guidelines:**
- Respect gaming group preferences
- Use appropriate mode for your audience
- Report system abuse
- No real-world person depiction in mature contexts

---

**Implementation Date:** 2026-05-31  
**Files Modified:** 3  
**Content Modes:** 2  
**Hard-Banned Categories:** 6  
**Artistic References:** 8+