[English](Installing.md)
[Главная](../Home.ru.md) › [Начало](README.ru.md)

# Установка

CozyGraph собирается для Linux на 64-битных x86 в четырёх форматах: `.deb`, `.rpm`, AppImage и `.tar.gz`, который
ставится только для вашего пользователя. Скачивайте только файлы, которые действительно приложены к выбранному
выпуску. Пакетов для ARM нет. Windows и macOS не поддерживаются; можно попробовать запустить приложение из
исходников (не проверено).

## Что нужно

- Linux, 64 бита, x86. Для `.deb`: Ubuntu 22.04 и новее, Debian 12 и новее, Linux Mint 21 и новее и другие на их
  основе; для `.rpm`: Fedora, openSUSE и другие с пакетами rpm; AppImage и `.tar.gz` работают в большинстве
  дистрибутивов.
- Около 320 МБ на диске для приложения.
- Рабочий стол (X11 или Wayland).
- По желанию: хранилище паролей (GNOME Keyring, KWallet), чтобы приложение помнило ключи между запусками.

## Установка .deb

1. Откройте страницу выпусков проекта и скачайте файл `cozygraph_<версия>_amd64.deb` последней версии.
   <!-- verify: technical rename -->
2. По желанию, но разумно: скачайте `SHA256SUMS` из того же выпуска в ту же папку и проверьте файл:

   ```bash
   sha256sum -c SHA256SUMS --ignore-missing
   ```

   Должно быть написано `OK`.
3. Установите через apt, он заодно поставит то, что нужно приложению из вашего дистрибутива:

   ```bash
   sudo apt install ./cozygraph_*_amd64.deb
   ```
   <!-- verify: technical rename -->

   `./` важно: так apt ставит именно этот файл, а не ищет пакет по имени.

## Другие форматы

| Формат | Как |
|---|---|
| `.rpm` | `sudo dnf install ./cozygraph-*.rpm` (или менеджером пакетов вашего дистрибутива). |
| AppImage | Сделайте файл исполняемым (`chmod +x`) и откройте его. |
| `.tar.gz` | Распакуйте. `./run.sh` запускает приложение на месте; `./install.sh` ставит его только для вашего пользователя, без root; `~/.local/share/cozygraph/uninstall.sh` удаляет (`--purge` удаляет и папку с данными). |

<!-- verify: technical rename -->

`.deb` и `.rpm` сохраняют песочницу Chromium. Распакованные форматы (AppImage, `.tar.gz`) в Ubuntu 24.04 и новее
запускаются без неё и при запуске говорят почему. Установка `.rpm` через dnf и готовый файл AppImage проверены только
автоматическими сборками проекта, на настоящем рабочем столе ещё нет.

## Запуск

- Из меню приложений: «CozyGraph».
- Из терминала: `cozygraph`. <!-- verify: technical rename -->

`cozygraph --version` печатает версию, `cozygraph --help` перечисляет параметры
([Командная строка](../reference/Command-Line.ru.md)). <!-- verify: technical rename -->

Не запускайте его через `sudo`: от имени root приложение не работает. См.
[Решение проблем](../reference/Troubleshooting.ru.md).

## Что и куда кладёт пакет

| Где | Что |
|---|---|
| `/usr/lib/cozygraph/` | Сама программа. <!-- verify: technical rename --> |
| `/usr/bin/cozygraph` | Ссылка для запуска из терминала. <!-- verify: technical rename --> |
| `/usr/share/applications/` | Пункт в меню. |
| `/usr/share/icons/hicolor/` | Значок размером от 16 до 512 точек. |
| `/usr/share/doc/cozygraph/copyright` | Лицензия и список сторонних компонентов. <!-- verify: technical rename --> |

Ваши настройки, ключи, проекты и журналы в пакет не входят: приложение хранит их в домашней папке, см.
[Папка с данными](../reference/Data-Folder.ru.md).

## Другие способы

- **Из исходников на Linux**: [Сборка из исходников](../dev/Building-From-Source.ru.md).
- **Windows**: [Сборка и запуск на Windows](../dev/Building-On-Windows.ru.md) (не проверено).
- **macOS**: [Сборка и запуск на macOS](../dev/Building-On-macOS.ru.md) (не проверено).

## См. также

- [Начало](README.ru.md)
- [Обновление](Updating.ru.md)
- [Удаление](Removing.ru.md)
- [Папка с данными](../reference/Data-Folder.ru.md)
- [Форматы пакетов](../dev/Package-Formats.ru.md)
