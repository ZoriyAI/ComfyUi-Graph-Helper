[English](Package-Formats.md)
[Главная](../Home.ru.md) › [Для разработчиков](README.ru.md)

# Форматы пакетов

Что собирается, как и как проверяется каждый формат. Все пакеты для Linux, 64 бита, x86, без подписи; их
происхождение подтверждают аттестация сборки GitHub и `SHA256SUMS`. Для Windows и macOS вместо пакетов есть скрипты
установки: они собирают приложение из исходного кода выпуска на компьютере человека (см. ниже).

## Четыре формата

| Формат | Чем собирается | Как проверен |
| --- | --- | --- |
| `.deb` | Electron Forge, `@electron-forge/maker-deb` | Собран и запущен здесь: прочитаны предохранители, открыто окно, проверка установленного пакета и обновления на распакованном пакете, `desktop-file-validate`, `lintian --fail-on error`. |
| `.rpm` | `@electron-forge/maker-rpm` с `resources/linux/rpm.spec.ejs` (собирается только там, где есть `rpmbuild`) | Собран и проверен здесь: `chrome-sandbox` SUID root, зависимости, ярлык, проверка установленного пакета на распакованном пакете. Установка через `dnf` в Fedora идёт только в CI. |
| `.tar.gz` с `run.sh`, `install.sh`, `uninstall.sh` | `scripts/make-linux-portable.js` | Собран и запущен здесь: `run.sh --version` и окно, `install.sh` в новую домашнюю папку, установка поверх первой копии, `uninstall.sh` сохраняет профиль, `--purge` удаляет его. |
| AppImage | `scripts/make-linux-portable.js` с `APPIMAGE_RUNTIME=<runtime-x86_64>` | Содержимое образа собрано и запущено здесь; готовый файл `.AppImage` и загрузка его runtime делаются и проверяются только в CI. |

Пакетов для Linux на ARM нет, пакетов для Windows и macOS тоже.

## Windows и macOS: скрипты установки

| Скрипт | Чем собирает | Куда ставит | Как проверен |
| --- | --- | --- | --- |
| `install-windows.ps1` | `electron-forge package --platform win32 --arch x64`: распакованная папка приложения | `%LOCALAPPDATA%\Programs\NodeWise Studio`, ярлык в меню «Пуск», запись в «Установленных приложениях» (для пользователя) | `.github/workflows/install-scripts.yml` на `windows-latest` (Windows PowerShell 5.1) и `windows-2022` (PowerShell 7); тесты Pester и PSScriptAnalyzer. |
| `install-macos.sh` | `electron-forge package --platform darwin --arch arm64` или `x64`: неподписанный `.app`, затем подпись ad hoc | `~/Applications/NodeWise Studio.app` | Тот же сценарий на `macos-latest` (Apple silicon) и `macos-15-intel` (Intel), с `/bin/bash` 3.2; shellcheck. |

**Ещё не проверено.** Оба скрипта появились в 1.0.0 и на настоящих компьютерах не проверялись, а сценарий ниже
пока не проходит: его ещё доводят. Когда он пройдёт, он запускает каждый скрипт так, как его запустит человек, из
исходного кода коммита и один раз из последнего выпуска: пробный прогон ничего не меняет; установленное приложение отвечает на `--version`, открывается и проходит
`scripts/smoke-installed-app.js` (снимок окна выкладывается); второй запуск обновляет приложение и сохраняет файл-метку
в папке с данными; удаление убирает приложение и оставляет данные. Пакет для Mac с Intel можно собрать и на машине с
Linux: его имя, значок, модуль базы данных и предохранители так и проверены. [Установка на Windows](../start/Installing-On-Windows.ru.md),
[Установка на macOS](../start/Installing-On-macOS.ru.md)

## Файлы выпуска

| Файл | Что это |
| --- | --- |
| `nodewise-studio_<версия>_amd64.deb` | Пакет для Debian и Ubuntu. |
| `nodewise-studio-<версия>-1.x86_64.rpm` | Пакет для Fedora и openSUSE. |
| `nodewise-studio-<версия>-x86_64.AppImage` | Один файл, который запускается в большинстве дистрибутивов. |
| `nodewise-studio-<версия>-linux-x64.tar.gz` | Распакованное приложение с `run.sh`, `install.sh` и `uninstall.sh`. |
| `nodewise-studio-<версия>.cdx.json` | SBOM: каждый компонент, который поставляется, в форме CycloneDX. |
| `install-windows.ps1` | Скрипт установки для Windows: собирает и ставит приложение из исходного кода этого выпуска. |
| `install-macos.sh` | Скрипт установки для macOS: собирает и ставит приложение из исходного кода этого выпуска. |
| `SHA256SUMS` | Контрольные суммы всех файлов выше. |

Версия 0.9 называла свои файлы старым именем приложения; её уведомление о новой версии ищет файлы под этим именем,
поэтому в выпуске 1.0 прямого скачивания оно, вероятно, не найдёт. Пока не проверено.

## Песочница

`.deb` и `.rpm` ставят помощник `chrome-sandbox` из Chromium с SUID root и всегда сохраняют песочницу. У
распакованного приложения (`.tar.gz`, AppImage) не может быть SUID-помощника, а Ubuntu 24.04 и новее ограничивают
другой способ песочницы; там `run.sh` и AppImage запускают приложение с `--no-sandbox` и пишут почему. Иначе
приложение там не запустилось бы вовсе.

## Установка для одного пользователя

`install.sh` ставит в `~/.local/share/nodewise-studio`, команду запуска в `~/.local/bin`, пункт меню и значки в
`~/.local/share`. Он не перезаписывает команду запуска, которую сделал не он, не работает, пока приложение запущено, и
заменяет старую копию одним шагом. Копию версии 0.9, которую её `install.sh` поставил в домашнюю папку под старым
названием приложения, он удаляет её же `uninstall.sh` (настройки остаются, их заберёт приложение); если та копия
запущена, она остаётся, и `install.sh` об этом говорит. `uninstall.sh` удаляет только то, что поставил `install.sh`, и сохраняет профиль;
`--purge` удаляет и профиль.

## Что попадает в пакет

Только то, что работает: `dist/` (main, preload, сборка окна, лицензии, встроенная справка), `node_modules` для main,
`package.json` и значок окна (`packagerConfig.ignore` в `forge.config.js`). От `better-sqlite3` идёт только модуль
целевой системы: в пакетах для Linux это `linux-x64` (`scripts/lib/forge-target.js`). Предохранители (`@electron-forge/plugin-fuses`) выключают запуск как Node, `NODE_OPTIONS`, параметры
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
