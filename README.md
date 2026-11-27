# Попутного ветра

Браузерная игра о торговле и плаваниях в Средиземном море около 1550 года. Сейчас в репозитории находится основа проекта: монорепозиторий, пустое ядро симуляции и клиент с полноэкранным Phaser-канвасом и слоем Preact.

## Запуск

Нужны Node.js 24 и pnpm 11. На Windows в PowerShell, если запуск `pnpm.ps1` запрещён политикой выполнения, используйте `pnpm.cmd`.

```text
corepack enable
pnpm install
pnpm dev
```

Откройте адрес, который напечатает Vite. Для проверки сборки выполните `pnpm build`, затем `pnpm preview` и откройте `http://localhost:4173`.

На каждом PR GitHub Actions запускает `lint`, `typecheck`, `test` и `build`. Архив `client-dist` доступен на странице прогона CI в разделе Artifacts. Чтобы проверить скачанную сборку, распакуйте содержимое архива в `packages/client/dist`, выполните `pnpm install --frozen-lockfile` и `pnpm preview`, затем откройте `http://localhost:4173`.

Проверки: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`.
На системах без Microsoft Edge перед `pnpm e2e` установите браузер тестов командой `pnpm exec playwright install chromium`.

## Структура

- `packages/core` — чистое TypeScript-ядро симуляции.
- `packages/client` — Vite-клиент с Phaser и Preact.
- `data` — исходные игровые данные; будут добавлены в следующих задачах.
- `tools` — конвейеры данных, карты и проверки баланса.
- `docs` — прогресс, решения, отчёты и проектная документация.

Дизайн и план: [диздок](docs/design/Попутного%20ветра%20%E2%80%94%20диздок.md), [задачи прототипа](docs/design/Попутного%20ветра%20%E2%80%94%20задачи%20прототипа.md).

Лицензия: [MIT](LICENSE). Лицензии внешних материалов и прямых зависимостей — в [THIRD_PARTY.md](THIRD_PARTY.md).
