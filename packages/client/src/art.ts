// Placeholder art until the setting is chosen: one emoji per unit id.
export const ICONS: Record<string, string> = {
  recruit: '🪖',
  scout: '🔭',
  squire: '🎒',
  cook: '🍲',
  militia: '🪓',
  drummer: '🥁',
  archer: '🏹',
  healer: '🌿',
  banner: '🚩',
  shield: '🛡️',
  merchant: '💰',
  avenger: '🗡️',
  sniper: '🎯',
  giant: '🗿',
  priest: '🕯️',
  berserker: '🔥',
  bard: '🎻',
  bomber: '💣',
  knight: '♞',
  mage: '🔮',
  champion: '👑',
  summoner: '📜',
  warlord: '⚔️',
  assassin: '🥷',
  spirit: '👻',
};

export function icon(id: string): string {
  return ICONS[id] ?? '❔';
}
