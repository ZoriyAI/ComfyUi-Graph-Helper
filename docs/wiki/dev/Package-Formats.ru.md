[English](Package-Formats.md)
[Главная](../Home.ru.md) › [Для разработчиков](README.ru.md)

# Форматы пакетов

Что собирается, как и как проверяется каждый формат. Все форматы для Linux, 64 бита, x86, без подписи; их
происхождение подтверждают аттестация сборки GitHub и `SHA256SUMS`.

## Четыре формата

| Формат | Чем собирается | Как проверен |
| --- | --- | --- |
| `.deb` | Electron Forge, `@electron-forge/maker-deb` | Собран и запущен здесь: прочитаны предохранители, открыто окно, проверка установленного пакета и обновления на распакованном пакете, `desktop-file-validate`, `lintian --fail-on error`. |
| `.rpm` | `@electron-forge/maker-rpm` с `resources/linux/rpm.spec.ejs` (собирается только там, где есть `rpmbuild`) | Собран и проверен здесь: `chrome-sandbox` SUID root, зависимости, ярлык, проверка установленного пакета на распакованном пакете. Установка через `dnf` в Fedora идёт только в CI. |
| `.tar.gz` с `run.sh`, `install.sh`, `uninstall.sh` | `scripts/make-linux-portable.js` | Собран и запущен здесь: `run.sh --version` и окно, `install.sh` в новую домашнюю папку, установка поверх первой копии, `uninstall.sh` сохраняет профиль, `--purge` удаляет его. |
| AppImage | `scripts/make-linux-portable.js` с `APPIMAGE_RUNTIME=<runtime-x86_64>` | Содержимое образа собрано и запущено здесь; готовый файл `.AppImage` и загрузка его runtime делаются и проверяются только в CI. |

Пакетов для ARM нет, для Windows и macOS тоже.

## Песочница

`.deb` и `.rpm` ставят помощник `chrome-sandbox` из Chromium с SUID root и всегда сохраняют песочницу. У
распакованного приложения (`.tar.gz`, AppImage) не может быть SUID-помощника, а Ubuntu 24.04 и новее ограничивают
другой способ песочницы; там `run.sh` и AppImage запускают приложение с `--no-sandbox` и пишут почему. Иначе
приложение там не запустилось бы вовсе.

## Установка для одного пользователя

`install.sh` ставит в `~/.local/share/cozygraph`, команду запуска в `~/.local/bin`, пункт меню и значки в
`~/.local/share`. Он не перезаписывает команду запуска, которую сделал не он, не работает, пока приложение запущено, и
заменяет старую копию одним шагом. `uninstall.sh` удаляет только то, что поставил `install.sh`, и сохраняет профиль;
`--purge` удаляет и профиль. <!-- verify: technical rename -->

## Что попадает в пакет

Только то, что работает: `dist/` (main, preload, сборка окна, лицензии, встроенная справка), `node_modules` для main,
`package.json` и значок окна (`packagerConfig.ignore` в `forge.config.js`). От `better-sqlite3` идёт только модуль для
Linux x64. Предохранители (`@electron-forge/plugin-fuses`) выключают запуск как Node, `NODE_OPTIONS`, параметры
отладчика и загрузку приложения не из `app.asar`; `scripts/check-fuses.js` читает их из каждого собранного файла.
Файл copyright обоих пакетов: лицензия приложения, а за ней лицензии всего, что идёт вместе с ним.

## Команды

```bash
xvfb-run -a npm run package:linux   # сборка, все форматы, их проверки
npm run make:linux                  # .deb (и .rpm, где есть rpmbuild), затем tar.gz (и AppImage)
npm run smoke:linux                 # проверки собранных пакетов
node scripts/check-fuses.js <exe>   # предохранители файла
node scripts/make-sbom.js out.cdx.json
SMOKE_PACKAGE=deb node scripts/smoke-installed-package.js check
```

Файлы появляются в `out/make/deb/x64/`, `out/make/rpm/x64/` и `out/make/portable/`. Инструменты: `fakeroot` и `dpkg`
для `.deb`, `rpm` для `.rpm`, `squashfs-tools` и runtime AppImage type 2 для AppImage, `desktop-file-utils`,
`lintian` и `shellcheck` для проверок. [Сборка из исходников](Building-From-Source.ru.md)

## См. также

- [Для разработчиков](README.ru.md)
- [Выпуск версии](Releasing.ru.md)
- [Установка](../start/Installing.ru.md)
