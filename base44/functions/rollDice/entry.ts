/**
 * Roll Dice Engine — pure math, no auth/session required.
 *
 * Accepts: { dice, modifier, advantage, disadvantage }
 *   - dice: string like "1d20" or "2d6"
 *   - modifier: number added to the final result (default 0)
 *   - advantage: boolean — roll twice, take higher (single d20 only, PHB p.173)
 *   - disadvantage: boolean — roll twice, take lower (single d20 only, PHB p.173)
 *
 * Returns: { rolls, total, modifier, final_result }
 *   - rolls: array of raw die values (includes both rolls when adv/disadv)
 *   - total: sum of kept dice (higher/lower die for adv/disadv on d20)
 *   - modifier: the modifier passed in
 *   - final_result: total + modifier
 */
Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { dice, modifier = 0, advantage = false, disadvantage = false } = body;

    if (!dice || typeof dice !== 'string') {
      return Response.json({ error: 'dice notation required (e.g. "1d20", "2d6")' }, { status: 400 });
    }

    const match = dice.match(/^(\d+)d(\d+)$/i);
    if (!match) {
      return Response.json({ error: 'Invalid dice notation. Use format like "1d20" or "2d6".' }, { status: 400 });
    }

    const numDice = parseInt(match[1]);
    const diceSides = parseInt(match[2]);
    const rollDie = () => Math.floor(Math.random() * diceSides) + 1;

    const rolls = [];
    for (let i = 0; i < numDice; i++) rolls.push(rollDie());

    // Advantage/disadvantage: roll a second d20, keep higher/lower (PHB p.173).
    // Only applies to a single d20. Both set = cancel (neither applies).
    const useAdv = !!advantage && !disadvantage;
    const useDis = !!disadvantage && !advantage;
    if (diceSides === 20 && numDice === 1 && (useAdv || useDis)) {
      rolls.push(rollDie());
    }

    let total;
    if (diceSides === 20 && numDice === 1 && useAdv) {
      total = Math.max(rolls[0], rolls[1]);
    } else if (diceSides === 20 && numDice === 1 && useDis) {
      total = Math.min(rolls[0], rolls[1]);
    } else {
      total = rolls.reduce((a, b) => a + b, 0);
    }

    const mod = Number(modifier) || 0;
    const finalResult = total + mod;

    return Response.json({ rolls, total, modifier: mod, final_result: finalResult });
  } catch (error) {
    return Response.json({ error: error.message || 'Dice roll failed' }, { status: 500 });
  }
});