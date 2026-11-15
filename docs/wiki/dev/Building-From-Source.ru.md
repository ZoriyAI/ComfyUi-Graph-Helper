[English](Building-From-Source.md)
[Главная](../Home.ru.md) › [Для разработчиков](README.ru.md)

# Сборка из исходников

По шагам в Linux (x64), системе, на которой проект собирается и проверяется. У Windows и macOS свои страницы:
[Windows](Building-On-Windows.ru.md), [macOS](Building-On-macOS.ru.md).

## Что нужно

- **Git.**
- **Node.js 22** (версия из `.nvmrc`) с npm. С nvm: `nvm install && nvm use` в папке проекта.
- **Компилятор не нужен.** `better-sqlite3` 13 приносит готовый модуль N-API для Linux x64, который работает и в Node,
  и в Electron, поэтому ничего не пересобирается.
- Для окна на сервере без рабочего стола и для сквозных тестов: `xvfb`.
- Для пакета `.deb`: `dpkg` и `fakeroot`; для его проверок `desktop-file-utils` и `lintian`.

В Debian или Ubuntu библиотеки, нужные Electron, и инструменты пакетов, как их ставит CI:

```bash
sudo apt-get install -y --no-install-recommends fakeroot dpkg xvfb libnss3 libatk-bridge2.0-0 libgtk-3-0 \
  libgbm1 libasound2t64 libxss1 desktop-file-utils lintian
```

(В старых выпусках звуковая библиотека называется `libasound2`.)

## Получите исходники и установите зависимости

```bash
git clone https://github.com/ZoriyAI/nodewise-studio.git nodewise-studio
cd nodewise-studio
npm ci
```

## Соберите и запустите

```bash
npm run build      # dist/main, dist/renderer, dist/notices, dist/help
npm start          # собирает и открывает приложение
npm run dev        # Vite с живой перезагрузкой и Electron
```

`npm start` и `npm run dev` берут ту же папку с данными, что и установленное приложение. Чтобы держать проверочный
профиль отдельно, передайте `--user-data-dir`: `npx electron . --user-data-dir=/tmp/nodewise-test` после
`npm run build`.

## Проверьте изменение

```bash
npm test
npm run type-check
xvfb-run -a npx playwright test --trace off --grep-invert "live-local|layout-walk"
```

Подробнее: [Тесты](Testing.ru.md).

## Соберите пакет

```bash
npm run package:linux
```

Собирает `dist/`, делает `.deb` в `out/make/deb/x64/` через Electron Forge и запускает на нём
`scripts/smoke-linux-package.js`. Установка: `sudo apt install ./out/make/deb/x64/<файл>.deb`.
Подробнее: [Форматы пакетов](Package-Formats.ru.md).

## Обновление

```bash
git pull
npm ci
npm run build
```

## См. также

- [Для разработчиков](README.ru.md)
- [Форматы пакетов](Package-Formats.ru.md)
- [Как участвовать](Contributing.ru.md)
