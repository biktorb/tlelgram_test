# Коты против пылесосов

Игра для Telegram Mini App в духе Vampire Survivors: кот бегает по комнате, оружие стреляет само, игрок ведёт кота пальцем и выбирает улучшения. Сейчас идёт переход с прошлой игры «Отряд» (автобаттлер, его код ещё в репозитории), прототип новой игры лежит в `packages/client/public/proto/survivors.html`.

- План разработки: [docs/PLAN.md](docs/PLAN.md)
- Сервер, API и развёртывание: [docs/server.md](docs/server.md)
- Прошлая игра «Отряд»: [docs/archive/](docs/archive/)

## Структура

- `packages/core` — правила игры: бой, лавка, бойцы. Один код для клиента и сервера.
- `packages/client` — игра (Vite), работает в Telegram и в браузере, онлайн и офлайн.
- `packages/server` — сервер: вход через Telegram, забеги, бои, соперники (Fastify + PostgreSQL).
- `tools/cats-balance.ts` — баланс по забегам ботов (`npm run balance:cats`), `tools/load.ts` — нагрузочная проверка сервера.

## Команды

Нужен Node.js 22.18 или новее (запускает TypeScript без сборки).

```sh
npm install
npm test          # автотесты ядра
npm run typecheck # проверка типов
npm run balance   # симуляция баланса, по умолчанию 3000 забегов
npm run dev       # прототип на http://localhost:5173
npm run build     # сборка прототипа в packages/client/dist
```

## Графика

Кот, пёс и мышь в «Котах против пылесосов» взяты из набора [«Animals pack»](https://opengameart.org/content/animals-pack) Ольги Бикмуллиной (Olga Bikmullina), лицензия [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/). Из исходного SVG вырезаны три головы: `packages/client/public/sprites/`. Пылесос, швабра, рыба и клубок нарисованы в коде в том же стиле (`packages/client/src/cats/sprites.ts`).
