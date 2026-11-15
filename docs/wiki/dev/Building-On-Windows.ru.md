[English](Building-On-Windows.md)
[Главная](../Home.ru.md) › [Для разработчиков](README.ru.md)

# Сборка и запуск на Windows

Ручной путь, который стоит за `install-windows.ps1`: что делает скрипт, шаг за шагом, для разработчика, который хочет
собирать, запускать и менять приложение на Windows. Чтобы просто установить приложение, возьмите скрипт:
[Установка на Windows](../start/Installing-On-Windows.ru.md). Скрипт проверяется на машинах GitHub с
Windows при каждом изменении, на разных настоящих компьютерах его ещё не пробовали; если он не сработает, эти шаги
остаются запасным путём.

## Что установить

- **Node.js 22**, версию из `.nvmrc` (с nodejs.org или через nvm-windows: `nvm install 22` и `nvm use 22`).
- **Git for Windows** (git-scm.com), только чтобы склонировать репозиторий. `npm ci` Git не нужен: все пакеты берутся
  из реестра npm (за этим следит `tests/unit/installScripts.test.ts`).
- **Ни компилятора, ни инструментов сборки Visual Studio.** Модуль базы данных `better-sqlite3` 13 поставляется с
  готовыми файлами N-API для Windows x64 и ARM64 (`win32-x64.node`, `win32-arm64.node`), поэтому ничего не
  компилируется.

## Получите исходники

В PowerShell или в окне Git Bash:

```powershell
git clone https://github.com/ZoriyAI/nodewise-studio.git nodewise-studio
cd nodewise-studio
npm ci
```

## Соберите и запустите

```powershell
npm run build
npm start
```

`npm start` собирает и открывает приложение. Используйте его, а не `npm run dev`: тот скрипт задаёт переменную
по-юниксовому (`NODE_ENV=development electron .`), а командная строка Windows этого не понимает.

## Папка приложения, как её делает скрипт

```powershell
npm run build
npx electron-forge package --platform win32 --arch x64
```

Папка: `out\NodeWise Studio-win32-x64`, в ней `nodewise-studio.exe`. `forge.config.js` оставляет только модуль базы
данных той системы, для которой идёт сборка (`scripts/lib/forge-target.js`), даёт программе значок
(`resources/icon.ico`, его делает из PNG значка `scripts/make-icon-containers.js`) и имя в диспетчере задач и
выключает те же предохранители Electron, что и на Linux. Пакета-установщика и подписи кода нет.

Затем скрипт копирует эту папку в `%LOCALAPPDATA%\Programs\NodeWise Studio`, добавляет ярлык в меню «Пуск» и запись
`HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\nodewise-studio` и запускает
`node scripts\smoke-installed-app.js --app <exe>`: `--version`, окно с временным профилем, один экземпляр.

Чтобы проверить скрипт на своём изменении без выпуска: `install-windows.ps1 -Source .` собирает из вашей папки.

## Где окажутся ваши данные

`%APPDATA%\nodewise-studio`. Чтобы держать тестовый профиль отдельно: `npx electron . --user-data-dir=C:\Users\you\nodewise-test`
после `npm run build`. Ключи шифрует Windows (DPAPI) через Electron.

## Обновите исходники

```powershell
git pull
npm ci
npm run build
```

## Удалите всё

1. В приложении: «Настройки ▸ Приватность ▸ Забыть все ключи и токены».
2. Удалите папку проекта и, если делали, собранную папку в `out\`.
3. Удалите `%APPDATA%\nodewise-studio`.

Приложение, поставленное скриптом, удаляется командой `install-windows.ps1 -Uninstall` или из «Установленных
приложений».

## Известные ограничения на этой системе

- **Тексты написаны для Linux.** Настройка хранилища паролей, подсказки к ней и «Решение проблем» говорят о
  GNOME Keyring и KWallet; в Windows Electron пользуется DPAPI. Переключатель `--password-store` в Windows приложение не
  добавляет.
- **Права на файлы.** Приложение делает свои файлы доступными «только вашему пользователю» правами Unix. В Windows
  это ничего не меняет, поэтому подсказки, которые это обещают (для ключа или токена в папке приложения), там неверны;
  у файлов обычные права вашей папки профиля.
- **Нет отдельного значка на панели задач.** Приложение не задаёт AppUserModelId, поэтому закрепление на панели задач и
  уведомления могут вести себя странно. Не проверено.
- **`--version` и `--help`** пишутся одной прямой записью в вывод программы. Через канал (как читают скрипт и
  `smoke-installed-app.js`) они доходят; появятся ли они, если набрать команду в окне консоли, не проверено.
- **Проверки пакетов** для Linux (`smoke-linux-package.js`, `smoke-installed-package.js`) работают только в Linux;
  переносимая проверка: `scripts/smoke-installed-app.js`. Сквозные тесты запускайте `npx playwright test`, без
  `xvfb-run`; в Windows это не проверено.

## См. также

- [Для разработчиков](README.ru.md)
- [Установка на Windows](../start/Installing-On-Windows.ru.md)
- [Сборка из исходников](Building-From-Source.ru.md)
- [Сборка и запуск на macOS](Building-On-macOS.ru.md)
