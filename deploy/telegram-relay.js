// Cloudflare Worker that forwards Bot API calls to api.telegram.org, for a
// server whose network blocks Telegram. Set BOT_ID to the number before the
// colon in the bot token (it is not secret); calls for other bots are refused.
// Setup steps: docs/server.md, "Если сервер не достаёт до Telegram".
const BOT_ID = '0000000000';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/bot(\d+):[\w-]+\/\w+$/);
    if (!match || match[1] !== BOT_ID) return new Response('Not found', { status: 404 });
    return fetch(`https://api.telegram.org${url.pathname}${url.search}`, {
      method: request.method,
      headers: { 'content-type': request.headers.get('content-type') ?? 'application/json' },
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
    });
  },
};
