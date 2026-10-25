// Thin wrapper over the Telegram WebApp SDK. Everything is a no-op outside
// Telegram, so the same build runs in a plain browser.

interface ThemeParams {
  bg_color?: string;
  secondary_bg_color?: string;
  section_bg_color?: string;
  text_color?: string;
  hint_color?: string;
  button_color?: string;
  button_text_color?: string;
  destructive_text_color?: string;
}

interface WebApp {
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: ThemeParams;
  initData: string;
  initDataUnsafe: { user?: { first_name?: string }; start_param?: string };
  ready(): void;
  expand(): void;
  isVersionAtLeast(v: string): boolean;
  requestFullscreen?(): void;
  disableVerticalSwipes?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  onEvent(name: string, cb: () => void): void;
  openTelegramLink?(url: string): void;
  shareToStory?(mediaUrl: string, params?: { text?: string }): void;
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: WebApp };
  }
}

const tg: WebApp | null = window.Telegram?.WebApp ?? null;
// The SDK script also loads in a plain browser; only an actual Telegram launch has a platform.
const inTelegram = !!tg && tg.platform !== 'unknown';

const THEME_TOKENS: [keyof ThemeParams, string][] = [
  ['bg_color', '--bg'],
  ['section_bg_color', '--surface'],
  ['text_color', '--ink'],
  ['hint_color', '--muted'],
  ['button_color', '--accent'],
  ['button_text_color', '--accent-ink'],
  ['destructive_text_color', '--bad'],
];

function applyTheme(): void {
  if (!tg) return;
  const root = document.documentElement;
  const p = tg.themeParams;
  for (const [key, token] of THEME_TOKENS) {
    const value = p[key];
    if (value) root.style.setProperty(token, value);
  }
  if (!p.section_bg_color && p.secondary_bg_color) root.style.setProperty('--surface', p.secondary_bg_color);
  root.dataset.scheme = tg.colorScheme;
  root.style.colorScheme = tg.colorScheme;
  if (p.bg_color) {
    tg.setHeaderColor?.(p.bg_color);
    tg.setBackgroundColor?.(p.bg_color);
  }
}

export function initTelegram(): void {
  if (!tg || !inTelegram) return;
  document.documentElement.classList.add('tg');
  applyTheme();
  tg.onEvent('themeChanged', applyTheme);
  tg.ready();
  tg.expand();
  const mobile = tg.platform === 'ios' || tg.platform === 'android';
  if (mobile && tg.isVersionAtLeast('8.0')) tg.requestFullscreen?.();
  if (tg.isVersionAtLeast('7.7')) tg.disableVerticalSwipes?.();
}

// Signed launch data for the server; empty outside Telegram.
export function initData(): string {
  return inTelegram ? tg!.initData : '';
}

// The startapp parameter of the link the game was opened with, e.g. "d_AbC123xy".
export function startParam(): string {
  if (inTelegram) return tg!.initDataUnsafe.start_param ?? '';
  return new URLSearchParams(location.search).get('startapp') ?? '';
}

// Opens Telegram's "share to chat" picker with a link and a message.
export function shareLink(url: string, text: string): void {
  const share = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  if (inTelegram && tg!.openTelegramLink) tg!.openTelegramLink(share);
  else window.open(share, '_blank', 'noopener');
}

export function canShareStory(): boolean {
  return inTelegram && !!tg!.shareToStory && tg!.isVersionAtLeast('7.8');
}

// Opens Telegram's story editor with a picture (a public https URL) and a caption.
export function shareStory(mediaUrl: string, text: string): void {
  if (canShareStory()) tg!.shareToStory!(mediaUrl, { text });
}

export function playerName(): string {
  return tg?.initDataUnsafe.user?.first_name || 'Ваш отряд';
}

export const haptic = {
  tap(): void {
    if (inTelegram) tg!.HapticFeedback?.selectionChanged();
  },
  hit(): void {
    if (inTelegram) tg!.HapticFeedback?.impactOccurred('light');
  },
  result(type: 'error' | 'success' | 'warning'): void {
    if (inTelegram) tg!.HapticFeedback?.notificationOccurred(type);
  },
};

let backHandler: (() => void) | null = null;

// Shows Telegram's native back button with the given action, or hides it.
export function setBack(handler: (() => void) | null): void {
  if (!inTelegram) return;
  if (backHandler) tg!.BackButton.offClick(backHandler);
  backHandler = handler;
  if (handler) {
    tg!.BackButton.onClick(handler);
    tg!.BackButton.show();
  } else {
    tg!.BackButton.hide();
  }
}
