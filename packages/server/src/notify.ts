import type { BattleResult } from '@otryad/core';
import type { Notifier } from './game.ts';
import type { Duel } from './store.ts';

const TEXT: Record<BattleResult, (friend: string) => string> = {
  win: (f) => `${f} принял ваш вызов в «Отряде» и победил ваш отряд. Сыграйте ещё раз и отправьте новый вызов!`,
  loss: (f) => `${f} принял ваш вызов в «Отряде», но ваш отряд победил 💪`,
  draw: (f) => `${f} принял ваш вызов в «Отряде». Ничья!`,
};

// Sends the challenger a private message from the bot. Telegram refuses it when
// the player never opened a chat with the bot; the in-game inbox covers that case.
export class TelegramNotifier implements Notifier {
  private token: string;
  private appLink: string | null;
  private log: (msg: string) => void;

  constructor(token: string, appLink: string | null, log: (msg: string) => void) {
    this.token = token;
    this.appLink = appLink;
    this.log = log;
  }

  duelAnswered(duel: Duel, friendName: string, friendResult: BattleResult): void {
    const body: Record<string, unknown> = { chat_id: duel.challengerId, text: TEXT[friendResult](friendName) };
    if (this.appLink) body.reply_markup = { inline_keyboard: [[{ text: 'Играть', url: this.appLink }]] };
    fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
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
