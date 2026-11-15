[English](Building-On-Windows.md)
[Главная](../Home.ru.md) › [Для разработчиков](README.ru.md)

# Сборка и запуск на Windows

Эти шаги следуют из того, как устроена сборка проекта, но на Windows их ещё никто не проверял: если что-то не
работает, пожалуйста, напишите, что случилось, в обращениях (Issues) проекта.

## Что установить

- **Git for Windows** (git-scm.com).
- **Node.js 22**, версию из `.nvmrc` (с nodejs.org или через nvm-windows: `nvm install 22` и `nvm use 22`).
- **Компилятор и Visual Studio build tools не нужны.** Модуль базы `better-sqlite3` 13 приносит готовые файлы N-API
  для Windows x64 и ARM64 (`win32-x64.node`, `win32-arm64.node`), поэтому ничего не компилируется.

## Получите исходники

В PowerShell или в окне Git Bash:

```powershell
git clone <адрес проекта>.git nodewise-studio
cd nodewise-studio
npm ci
```

`npm ci` заодно скачивает Electron для Windows.

## Сборка и запуск

```powershell
npm run build
npm start
```

`npm start` собирает и открывает приложение. Пользуйтесь им, а не `npm run dev`: тот скрипт задаёт переменную
по-юниксовому (`NODE_ENV=development electron .`), и командная оболочка Windows этого не понимает.

## Где окажутся ваши данные

`C:\Users\you\AppData\Roaming\nodewise-studio` (`%APPDATA%\nodewise-studio`). Чтобы держать
проверочный профиль отдельно: `npx electron . --user-data-dir=C:\Users\you\nodewise-test` после `npm run build`.

Ключи шифрует Windows (DPAPI) через Electron.

## Папка приложения, которая запускается без npm

Electron Forge, инструмент упаковки проекта, может сделать папку с `nodewise-studio.exe` и всем, что ему нужно:

```powershell
npm run build
npx electron-forge package
```

Папка появится в `out\`. Прежде чем запускать, откройте `forge.config.js`: одно правило `ignore` оставляет только
файл базы для Linux (`prebuilds/(?!linux-x64\.node$)`). Пропустите и файл для Windows (например,
`(?!(linux-x64|win32-x64)\.node$)`), иначе упакованное приложение не откроет свою базу. Установщика для Windows нет.
Папка называется `out\NodeWise Studio-win32-x64`. Файла `.ico` в проекте нет, поэтому у программы остаётся значок
самого Electron (не проверялось).

## Обновление исходников

```powershell
git pull
npm ci
npm run build
```

## Как удалить всё

1. В приложении: «Настройки ▸ Приватность ▸ Забыть все ключи и токены».
2. Удалите папку проекта (`nodewise-studio`) и, если делали, упакованную папку в `out\`.
3. Удалите `%APPDATA%\nodewise-studio`.

## Известные ограничения на этой системе

- **Тексты написаны для Linux.** Настройка хранилища паролей, её подсказки и «Решение проблем» говорят о GNOME
  Keyring и KWallet; в Windows Electron использует DPAPI.
- **Права на файлы.** Приложение делает свои файлы доступными «только вашему пользователю» правами Unix. В Windows это
  ничего не делает, поэтому подсказки, которые это обещают (для ключа или токена в папке приложения), там неверны;
  файлы получают обычные права вашей папки профиля.
- **Нет AppUserModelId и установщика.** Приложение не задаёт AppUserModelId и не обрабатывает Squirrel или другой
  установщик, поэтому закрепление на панели задач и уведомления могут вести себя странно.
- **`--version` и `--help` ничего не печатают**: у оконного приложения в Windows нет консоли.
- **Проверки пакета только для Linux**: `scripts/smoke-linux-package.js`, `scripts/smoke-installed-deb.js` и
  `xvfb-run` в командах тестов. Сквозные тесты запускайте как `npx playwright test`, без `xvfb-run`.
- Запуск от имени администратора это то же, что запуск от root в Linux: не делайте так.

## См. также

- [Для разработчиков](README.ru.md)
- [Сборка из исходников](Building-From-Source.ru.md)
- [Сборка и запуск на macOS](Building-On-macOS.ru.md)
