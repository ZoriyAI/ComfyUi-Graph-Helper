[English](Testing.md)
[Главная](../Home.ru.md) › [Для разработчиков](README.ru.md)

# Тесты

Четыре вида тестов, от быстрых к медленным. Все работают в Linux; сквозным тестам нужен экран или Xvfb.

## Модульные и интеграционные тесты

```bash
npm test                         # vitest: tests/unit, tests/integration, tests/corpus
npx vitest run tests/unit/wiki.test.ts   # один файл
```

- `tests/unit`: по одному модулю: движок команд, кодек workflow, проверка «только чтение», миграции, тексты, уроки,
  вики.
- `tests/integration`: несколько модулей вместе с настоящей базой SQLite: чат, который строит граф, ход, который
  встречает правку человека, синхронизация с поддельным MCP-сервером (`tests/fixtures/mcp`).
- Вместо настоящей модели отвечает модель с заготовленными ответами (`src/main/testLLMTransport.ts`); в сеть ничего не
  уходит.
- Под большой нагрузкой несколько медленных тестов могут упереться в таймаут vitest; запускайте их отдельно или с
  `--testTimeout=60000`.

## Проверка типов

```bash
npm run type-check               # main и renderer
```

## Сквозные тесты

Они запускают собранное приложение в Electron через Playwright.

```bash
npm run build
xvfb-run -a npx playwright test --trace off --grep-invert "live-local|layout-walk"   # всё, кроме обхода
xvfb-run -a npx playwright test tests/e2e/about-help.test.ts --trace off              # один файл
```

Тесты `live-local` говорят с настоящим сервером модели на этом компьютере (`127.0.0.1:18080`) и пропускаются, если
там никто не слушает.

## Обход экранов

`tests/e2e/layout-walk.test.ts` открывает каждый экран при нескольких размерах окна и ищет то, что вылезло из своего
блока, обрезано, ушло за край окна, наехало на соседа или сжато до нечитаемого, и читает каждый текст: нет ли
незаполненной вставки, «undefined» или голого ключа. Ещё он проверяет, что карточка-описание стоит у своей ноды и
шириной с неё при любом масштабе. Запускайте его отдельно: он подолгу держит открытыми меню, а второе окно приложения
закрыло бы их.

```bash
xvfb-run -a npx playwright test tests/e2e/layout-walk.test.ts --trace off
LAYOUT_FULL=1 xvfb-run -a npx playwright test tests/e2e/layout-walk.test.ts --trace off      # все размеры
LAYOUT_LANG=en …           # по-английски (по умолчанию по-русски, тексты длиннее)
LAYOUT_TEXT=wide …         # текст шире на 4 %
LAYOUT_DPR=1.5 …           # масштаб экрана 150 %
LAYOUT_FONTS=hinted …      # шрифты с хинтингом
LAYOUT_SIZES=800x560,1400x860 …   # только эти размеры окна
LAYOUT_ONLY=canvas,helper …       # только эти части
LAYOUT_OUT=<папка> …              # сохранить отчёт и снимки
```

`tests/e2e/layout-audit.test.ts` проверяет сам обход на нарочно сломанной и на правильной странице.
`tests/e2e/node-size.test.ts` рисует каждую ноду каталога и сравнивает её высоту с той, что приложение рассчитало
заранее (по ней ставятся новые ноды).

## Набор workflow

`tests/corpus/workflowRoundTrip.test.ts` открывает каждый workflow ComfyUI в названных папках, сохраняет обратно и
сравнивает, затем правит каждый так, как это делает холст, и проверяет, что в сохранённом файле ровно эта правка:

```bash
WORKFLOW_CORPUS=/path/a:/path/b npx vitest run tests/corpus
```

Без `WORKFLOW_CORPUS` он пропускается.

## Вики

`tests/unit/wiki.test.ts` проверяет, что у каждой страницы есть оба языка, ссылка на другой язык в первой строке и
путь во второй, что каждая относительная ссылка ведёт на файл, что каждое оглавление перечисляет свои страницы и что у
каждого урока есть страница. `WIKI_STRICT=1 npx vitest run tests/unit/wiki.test.ts` перед выпуском падает ещё и на
комментариях `<!-- verify: … -->` и заготовках.

## Что запускает CI

`.github/workflows/build.yml` на каждый пуш: проверка списка изменений, `npm ci`, `npm test`, `npm run type-check`,
`npm run build`, сквозные тесты, обход экранов по-русски, по-английски и с более широким текстом при 125 %, пакет и
его проверки ([Форматы пакетов](Package-Formats.ru.md)).

## См. также

- [Для разработчиков](README.ru.md)
- [Сборка из исходников](Building-From-Source.ru.md)
- [Как участвовать](Contributing.ru.md)
