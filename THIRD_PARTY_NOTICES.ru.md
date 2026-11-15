[English](THIRD_PARTY_NOTICES.md)

# Сторонние компоненты

NodeWise Studio поставляется вместе с компонентами с открытым кодом, которые сделали другие люди. У каждого
своя лицензия.

## Где полный список

Полный список с версией, лицензией и текстом лицензии каждого компонента, который идёт с приложением, пишется при
сборке:

- в приложении: «Справка ▸ О программе ▸ Сторонние компоненты»;
- в установленном пакете: `/usr/share/doc/nodewise-studio/copyright` (сначала лицензия приложения, затем
  список);
- в сборке из исходников: `dist/notices/THIRD_PARTY_NOTICES.txt` и `dist/notices/third-party.json`, их пишет
  `scripts/build-assets.js` во время `npm run build`.

Список охватывает пакеты, которые главный процесс использует при работе, пакеты, из которых собрано окно, и
Electron. У Chromium, который входит в Electron, свой список: `LICENSES.chromium.html` рядом с программой
(«О программе ▸ Сторонние компоненты ▸ Лицензии Chromium»).

## О чём стоит сказать здесь

- Шрифт **Geist** (`@fontsource/geist`): SIL Open Font License 1.1.
- **React Flow** (`@xyflow/react`, `@xyflow/system`): MIT. Его подпись на холсте остаётся видна.
- Значки **lucide** (`lucide-react`): ISC.
- **Vercel AI SDK** (`ai`, `@ai-sdk/*`) и SDK **Model Context Protocol** (`@modelcontextprotocol/*`):
  Apache License 2.0.
- **Electron**: MIT; **better-sqlite3**: MIT.

## Интерфейс ComfyUI

Чтобы сохранённый здесь workflow открывался в ComfyUI таким же, приложение следует формату файла и поведению
интерфейса ComfyUI (`Comfy-Org/ComfyUI_frontend`, GPL-3.0): порядку значений полей, номерам слотов, определениям
субграфов. Кода этого проекта в приложении нет. Одна таблица фактов (какая встроенная нода-загрузчик читает какую
папку моделей) взята из его файла `modelNodeMappings.ts`; источник указан в `src/shared/catalog/modelFolders.ts`.

Лицензия самого приложения: [LICENSE](LICENSE).
