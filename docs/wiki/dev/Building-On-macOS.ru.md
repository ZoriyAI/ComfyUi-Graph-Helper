[English](Building-On-macOS.md)
[Главная](../Home.ru.md) › [Для разработчиков](README.ru.md)

# Сборка и запуск на macOS

Эти шаги следуют из того, как устроена сборка проекта, но на macOS их ещё никто не проверял: если что-то не работает,
пожалуйста, напишите, что случилось, в обращениях (Issues) проекта.

## Что установить

- **Git**: входит в Xcode Command Line Tools (`xcode-select --install`) или ставится из Homebrew (`brew install git`).
- **Node.js 22**, версию из `.nvmrc` (с nodejs.org, из Homebrew или через nvm: `nvm install && nvm use`).
- **Компилятор для самого приложения не нужен.** Модуль базы `better-sqlite3` 13 приносит готовые файлы N-API для
  Apple Silicon и Intel (`darwin-arm64.node`, `darwin-x64.node`), поэтому ничего не компилируется.

## Получите исходники

```bash
git clone <адрес проекта>.git cozygraph
cd cozygraph
npm ci
```
<!-- verify: technical rename; the project address is set in src/main/identity.ts -->

`npm ci` заодно скачивает Electron для вашего Mac.

## Сборка и запуск

```bash
npm run build
npm start          # собирает и открывает приложение
npm run dev        # Vite с живой перезагрузкой и Electron
```

## Где окажутся ваши данные

`~/Library/Application Support/cozygraph` (например, `/Users/you/Library/Application Support/cozygraph`).
<!-- verify: technical rename --> Чтобы держать проверочный профиль отдельно:
`npx electron . --user-data-dir=/Users/you/cozygraph-test` после `npm run build`.

Ключи шифруются ключом, который Electron хранит в вашей связке ключей (Keychain).

## Приложение, которое запускается без npm

Electron Forge, инструмент упаковки проекта, может сделать пакет `.app`:

```bash
npm run build
npx electron-forge package
```

Пакет появится в `out/`. Прежде чем запускать, откройте `forge.config.js`: одно правило `ignore` оставляет только
файл базы для Linux (`prebuilds/(?!linux-x64\.node$)`). Пропустите и файл для вашего Mac (например,
`(?!(linux-x64|darwin-arm64)\.node$)` на Apple Silicon), иначе упакованное приложение не откроет свою базу. Пакет не
подписан: macOS спросит перед первым открытием (щелчок с Control ▸ «Открыть»).
<!-- verify: the bundle name; the missing .icns icon -->

## Обновление исходников

```bash
git pull
npm ci
npm run build
```

## Как удалить всё

1. В приложении: «Настройки ▸ Приватность ▸ Забыть все ключи и токены».
2. Удалите папку проекта (`cozygraph`) и, если делали, пакет в `out/`.
3. Удалите `~/Library/Application Support/cozygraph`.
4. В «Связке ключей» удалите запись, которая кончается на «Safe Storage» и несёт имя приложения.
   <!-- verify: the Keychain item name on macOS -->

## Известные ограничения на этой системе

- **Нет меню приложения macOS.** Приложение рисует строку меню внутри окна и не задаёт системного меню. Без системного
  меню «Правка» `Cmd+C`, `Cmd+V`, `Cmd+X` и `Cmd+A` могут не работать в текстовых полях, и нет `Cmd+Q`, `Cmd+H`,
  `Cmd+M` и `Cmd+W`. Чтобы выйти, выберите «Файл ▸ Выход».
- **Нет подписи и нотаризации.** Нет подписи кода, нотаризации и `.dmg`.
- **Тексты написаны для Linux.** Настройка хранилища паролей, её подсказки и «Решение проблем» говорят о GNOME
  Keyring и KWallet; в macOS Electron использует связку ключей.
- **Проверки пакета только для Linux**: `scripts/smoke-linux-package.js`, `scripts/smoke-installed-deb.js` и
  `xvfb-run` в командах тестов. Сквозные тесты запускайте как `npx playwright test`, без `xvfb-run`.

## См. также

- [Для разработчиков](README.ru.md)
- [Сборка из исходников](Building-From-Source.ru.md)
- [Сборка и запуск на Windows](Building-On-Windows.ru.md)
