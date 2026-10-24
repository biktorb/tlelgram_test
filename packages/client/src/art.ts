// Placeholder art for the meme-cats setting: a cat face plus a prop that
// hints at the unit's role. Replaced by drawn sprites later.
export const ART: Record<string, { face: string; prop?: string }> = {
  recruit: { face: '🐱' },
  scout: { face: '😼', prop: '🔭' },
  squire: { face: '🐈', prop: '🎒' },
  cook: { face: '😺', prop: '🍲' },
  militia: { face: '🐈‍⬛', prop: '🗑️' },
  drummer: { face: '😸', prop: '🥁' },
  archer: { face: '😾', prop: '🏹' },
  healer: { face: '😽', prop: '🌿' },
  banner: { face: '😺', prop: '🚩' },
  shield: { face: '😿', prop: '🛡️' },
  merchant: { face: '😼', prop: '💰' },
  avenger: { face: '😾', prop: '🗡️' },
  sniper: { face: '😼', prop: '🎯' },
  giant: { face: '🦁' },
  priest: { face: '😽', prop: '🕯️' },
  berserker: { face: '🙀', prop: '🔥' },
  bard: { face: '😸', prop: '🎻' },
  bomber: { face: '😹', prop: '💣' },
  knight: { face: '😼', prop: '👢' },
  mage: { face: '🐈‍⬛', prop: '🔮' },
  champion: { face: '🐯' },
  summoner: { face: '😼', prop: '🪶' },
  warlord: { face: '😾', prop: '🎖️' },
  assassin: { face: '🐈‍⬛', prop: '🥷' },
  spirit: { face: '👻' },
};

export function art(id: string): { face: string; prop?: string } {
  return ART[id] ?? { face: '❔' };
}
