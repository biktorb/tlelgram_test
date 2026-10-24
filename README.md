# Отряд

Асинхронный автобаттлер для Telegram Mini App: собери отряд в лавке, бой идёт сам, соперники — записанные отряды других игроков.

- Игровой дизайн: [docs/design.md](docs/design.md)
- План разработки: [docs/PLAN.md](docs/PLAN.md)

## Структура

- `packages/core` — правила игры: бой, лавка, бойцы. Один код для клиента и сервера.
- `packages/client` — прототип игры в браузере (Vite).
- `tools/balance.ts` — симуляция баланса ботами, `tools/ghosts.ts` — набор отрядов-соперников для прототипа.

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
