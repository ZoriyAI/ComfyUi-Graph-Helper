[English](Building-On-macOS.md)
[Главная](../Home.ru.md) › [Для разработчиков](README.ru.md)

# Сборка и запуск на macOS

Ручной путь, который стоит за `install-macos.sh`: что делает скрипт, шаг за шагом, для разработчика, который хочет
собирать, запускать и менять приложение на Mac. Чтобы просто установить приложение, возьмите скрипт:
[Установка на macOS](../start/Installing-On-macOS.ru.md). Скрипт проверяется на машинах GitHub с macOS при
каждом изменении, на разных настоящих Mac его ещё не пробовали; если он не сработает, эти шаги остаются запасным путём.

## Что установить

- **Node.js 22**, версию из `.nvmrc` (с nodejs.org, из Homebrew или через nvm: `nvm install && nvm use`).
- **Git**, только чтобы склонировать репозиторий: он есть в Xcode Command Line Tools (`xcode-select --install`) или в
  Homebrew. `npm ci` Git не нужен: все пакеты берутся из реестра npm.
- **Компилятор для самого приложения не нужен.** Модуль базы данных `better-sqlite3` 13 поставляется с готовыми
  файлами N-API для Apple silicon и Intel (`darwin-arm64.node`, `darwin-x64.node`), поэтому ничего не компилируется.

## Получите исходники

```bash
git clone https://github.com/ZoriyAI/nodewise-studio.git nodewise-studio
cd nodewise-studio
npm ci
```

## Соберите и запустите

```bash
npm run build
npm start          # собирает и открывает приложение
npm run dev        # Vite с живой перезагрузкой и Electron
```

## .app, как её делает скрипт

```bash
npm run build
npx electron-forge package --platform darwin --arch arm64   # x64 на Mac с Intel
```

Пакет: `out/NodeWise Studio-darwin-arm64/NodeWise Studio.app`; программа в нём `Contents/MacOS/nodewise-studio`,
идентификатор `com.electron.nodewise-studio`. `forge.config.js` оставляет только модуль базы данных той системы, для
которой идёт сборка (`scripts/lib/forge-target.js`), даёт пакету значок (`resources/icon.icns`, его делает из PNG
значка `scripts/make-icon-containers.js`), относит его к разделу «Образование» и выключает те же предохранители Electron, что и
на Linux. Запись предохранителей ломает подпись Electron; на Apple silicon плагин предохранителей снова подписывает программу ad hoc.
Пакет для Intel, собранный на машине с Linux, получил правильное имя, значок, модуль базы данных и предохранители; это
проверено здесь. Нет `.dmg`, нет подписи Developer ID и нет нотаризации.

Затем скрипт копирует пакет через `ditto` рядом с `~/Applications/NodeWise Studio.app`, подписывает копию ad hoc
(`codesign --force --deep --sign -`), снимает пометку карантина, проверяет подпись, подменяет копию и запускает
`node scripts/smoke-installed-app.js --app <пакет>/Contents/MacOS/nodewise-studio`: `--version`, окно с временным
профилем и `--use-mock-keychain`, один экземпляр.

Чтобы проверить скрипт на своём изменении без выпуска: `bash scripts/install/install-macos.sh --source .`.

## Где окажутся ваши данные

`~/Library/Application Support/nodewise-studio`. Чтобы держать тестовый профиль отдельно:
`npx electron . --user-data-dir=/Users/you/nodewise-test` после `npm run build`. Ключи шифруются ключом, который
Electron хранит в вашей связке ключей под именем «nodewise-studio Safe Storage».

## Обновите исходники

```bash
git pull
npm ci
npm run build
```

## Как удалить всё

1. В приложении: «Настройки ▸ Приватность ▸ Забыть все ключи и токены».
2. Удалите папку проекта и, если делали, пакет в `out/`.
3. Удалите `~/Library/Application Support/nodewise-studio`.
4. В «Связке ключей» удалите «nodewise-studio Safe Storage» (`install-macos.sh --uninstall --purge-data` делает это
   командой `security delete-generic-password`; на Mac пока не проверено).

## Известные ограничения на этой системе

- **Строка меню.** Собственные меню приложения («Файл», «Правка», «Вид» и другие) нарисованы внутри окна. В строке
  меню наверху экрана есть стандартные меню приложения, «Правка» и «Окно» (`src/main/platformMenu.ts`), поэтому
  `Cmd+C`, `Cmd+V`, `Cmd+X`, `Cmd+A` работают в текстовых полях, а `Cmd+Q` закрывает приложение. Что холст сохраняет
  свои `Cmd+C` и `Cmd+Z` рядом с этим меню «Правка», на Mac не проверено.
- **Закрытие окна** оставляет приложение работать, как принято на Mac; щелчок по значку в Dock снова открывает окно.
  На Mac не проверено.
- **Открытие файла** перетаскиванием на значок в Dock или через «Открыть в программе» не обрабатывается (такие файлы
  macOS передаёт событием, которое приложение не слушает); открывайте файлы из самого приложения. Типы файлов
  приложение не регистрирует ни на одной системе.
- **Нет подписи издателя и нотаризации.** Подпись ad hoc не называет издателя. После каждого обновления связка ключей
  видит новую программу и может один раз спросить доступ к «nodewise-studio Safe Storage»; на Mac это пока не видели.
- **Тексты написаны для Linux.** Настройка хранилища паролей, её подсказки и «Решение проблем» говорят о GNOME
  Keyring и KWallet; в macOS Electron пользуется связкой ключей. Переключатель `--password-store` в macOS приложение не
  добавляет.
- **Проверки пакетов** для Linux работают только в Linux; переносимая проверка: `scripts/smoke-installed-app.js`.
  Сквозные тесты запускайте `npx playwright test`, без `xvfb-run`; на Mac это не проверено.

## См. также

- [Для разработчиков](README.ru.md)
- [Установка на macOS](../start/Installing-On-macOS.ru.md)
- [Сборка из исходников](Building-From-Source.ru.md)
- [Сборка и запуск на Windows](Building-On-Windows.ru.md)
