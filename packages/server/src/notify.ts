import type { Notifier } from './game.ts';
import type { Duel } from './store.ts';

const text = (friend: string, beat: boolean) =>
  beat
    ? `${friend} принял ваш вызов в «Котах против пылесосов» и продержался лучше вас. Сыграйте ещё раз и отправьте новый вызов!`
    : `${friend} принял ваш вызов в «Котах против пылесосов», но ваш кот продержался лучше 💪`;

// Sends the challenger a private message from the bot. Telegram refuses it when
// the player never opened a chat with the bot; the in-game inbox covers that case.
export class TelegramNotifier implements Notifier {
  private token: string;
  private apiBase: string;
  private appLink: string | null;
  private log: (msg: string) => void;

  constructor(token: string, apiBase: string, appLink: string | null, log: (msg: string) => void) {
    this.token = token;
    this.apiBase = apiBase;
    this.appLink = appLink;
    this.log = log;
  }

  duelAnswered(duel: Duel, friendName: string, beat: boolean): void {
    const body: Record<string, unknown> = { chat_id: duel.challengerId, text: text(friendName, beat) };
    if (this.appLink) body.reply_markup = { inline_keyboard: [[{ text: 'Играть', url: this.appLink }]] };
    fetch(`${this.apiBase}/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
      .then(async (res) => {
        if (!res.ok) this.log(`duel notification not sent: ${res.status} ${(await res.text()).slice(0, 200)}`);
      })
      .catch((e) => this.log(`duel notification failed: ${e}`));
  }
}
