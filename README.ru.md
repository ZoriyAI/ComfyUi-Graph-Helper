English version: [README.md](README.md)

# NodeWise Studio

**Учебный помощник по графам ComfyUI**

[![Checks](https://github.com/ZoriyAI/ComfyUi-Graph-Helper/actions/workflows/ci.yml/badge.svg)](https://github.com/ZoriyAI/ComfyUi-Graph-Helper/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/ZoriyAI/ComfyUi-Graph-Helper)](https://github.com/ZoriyAI/ComfyUi-Graph-Helper/releases/latest)
[![Лицензия: MIT с Commons Clause](https://img.shields.io/badge/license-MIT%20%2B%20Commons%20Clause-blue)](LICENSE)

![Приложение собирает граф по шагам и объясняет каждый шаг](docs/screenshots/hero.png)

NodeWise Studio помогает учиться работать с ComfyUI и разбираться в графах: он читает запущенный ComfyUI, объясняет каждую
ноду и связь, учит уроками, которые вы проходите руками, и умеет объяснять и собирать граф по шагам вместе с
помощником. Он для тех, кто только начинает с ComfyUI, и для всех, кто хочет понимать, почему граф работает. ComfyUI
он только читает и никогда не меняет.

NodeWise это независимый экспериментальный учебный инструмент. Он не связан с Comfy Org и не одобрен ею. В нём нет
кода ComfyUI, он только читает запущенный ComfyUI и никогда его не меняет.

## Снимки экрана

| | |
| --- | --- |
| [<img src="docs/screenshots/ru/02-canvas-explained.png" width="420" alt="Граф на холсте с объяснением под каждой нодой">](docs/screenshots/ru/02-canvas-explained.png) | [<img src="docs/screenshots/ru/07-lesson-step.png" width="420" alt="Шаг урока на настоящем холсте">](docs/screenshots/ru/07-lesson-step.png) |
| [<img src="docs/screenshots/ru/05-assistant-build.png" width="420" alt="Помощник собирает граф по шагам">](docs/screenshots/ru/05-assistant-build.png) | [<img src="docs/screenshots/ru/08-check.png" width="420" alt="Проверка перед сохранением workflow">](docs/screenshots/ru/08-check.png) |

[Все снимки экрана](docs/screenshots/README.ru.md)

## Что он делает

- **Читает ваш ComfyUI** по его адресу: ноды, паки и файлы моделей; необязательный MCP-сервер добавляет больше.
  [Подключение](docs/wiki/connect/README.ru.md)
- **Холст для графов ComfyUI**: настоящие поля, связи с типами, субграфы, группы, копирование и вставка, отмена и
  повтор. [Работа с графом](docs/wiki/graph/README.ru.md)
- **Объясняет** каждую ноду, вход, выход и связь и говорит, откуда взято объяснение.
  [Окно приложения](docs/wiki/interface/README.ru.md)
- **Около восьмидесяти уроков** в двенадцати группах, которые вы проходите руками на настоящем холсте, с проверкой
  каждого шага, без модели ИИ.
  [Уроки](docs/wiki/lessons/README.ru.md)
- **Помощник**, который отвечает, строит или учит, с облачной моделью и вашим ключом или с моделью на вашем
  компьютере. [Помощник](docs/wiki/assistant/README.ru.md)
- **Проверяет граф** перед сохранением и сохраняет обычный workflow, который вы запускаете в ComfyUI.
  [Проверка графа](docs/wiki/graph/Checking-A-Graph.ru.md)

## Установка

### Linux

64 бита, x86. Скачайте со страницы [выпусков](../../releases) формат для вашей системы:

| Формат | Установка |
| --- | --- |
| `.deb` (Ubuntu, Debian, Mint) | `sudo apt install ./nodewise-studio_*_amd64.deb` |
| `.rpm` (Fedora, openSUSE) | `sudo dnf install ./nodewise-studio-*.rpm` |
| AppImage | `chmod +x` для файла, затем откройте его |
| `.tar.gz` | распакуйте, затем `./install.sh` (для вашего пользователя, без root) или `./run.sh` (на месте) |

У каждого выпуска есть файл `SHA256SUMS`: `sha256sum -c SHA256SUMS --ignore-missing`. Обновление, удаление и что
куда ставится: [Установка](docs/wiki/start/Installing.ru.md).

### Windows 10 22H2 и 11 (x64)

Пакета для Windows пока нет. Скрипт из выпуска собирает приложение на вашем компьютере из исходного кода этого
проекта и ставит его для вашего пользователя, без прав администратора. В PowerShell:

```powershell
Invoke-WebRequest -UseBasicParsing https://github.com/ZoriyAI/ComfyUi-Graph-Helper/releases/latest/download/install-windows.ps1 -OutFile install-windows.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-windows.ps1
```

`-ExecutionPolicy Bypass` действует только для этого одного процесса PowerShell. Добавьте `-DryRun`, чтобы сначала
увидеть все шаги. Что скрипт делает, о чём спрашивает и как удалить приложение:
[Установка на Windows](docs/wiki/start/Installing-On-Windows.ru.md).

### macOS 13 или новее (Apple silicon или Intel)

Пакета для macOS пока нет. Скрипт из выпуска собирает приложение на вашем Mac из исходного кода этого проекта и ставит
его в `~/Applications`. В Терминале:

```bash
curl -fsSL https://github.com/ZoriyAI/ComfyUi-Graph-Helper/releases/latest/download/install-macos.sh -o install-macos.sh && bash install-macos.sh
```

Добавьте `--dry-run`, чтобы сначала увидеть все шаги. Что скрипт делает, о чём спрашивает и как удалить приложение:
[Установка на macOS](docs/wiki/start/Installing-On-macOS.ru.md).

Ни на Windows, ни на macOS приложение не подписано издателем. Скрипты проверяются на машинах GitHub с Windows и macOS
при каждом изменении; на разных настоящих компьютерах их ещё не пробовали.

## Первые шаги

1. Запустите ComfyUI. Его ещё нет? [ComfyUI и где его взять](docs/wiki/start/ComfyUI.ru.md).
2. В NodeWise: «Настройки ▸ Подключение», впишите адрес, по которому открываете ComfyUI в браузере (например,
   `http://127.0.0.1:8188`), или нажмите «Найти на этом компьютере», сохраните и прочитайте.
   [Подключение к ComfyUI](docs/wiki/connect/Connecting.ru.md)
3. Откройте правую панель, выберите «Учиться» и пройдите первый урок. [Быстрый старт](docs/wiki/start/Quick-Start.ru.md)

## Документация

| Глава | Что в ней |
| --- | --- |
| [Начало](docs/wiki/start/README.ru.md) | Что это за приложение, установка, первый час, обновление и удаление. |
| [Подключение](docs/wiki/connect/README.ru.md) | Как подключить приложение к ComfyUI на этом или другом компьютере. |
| [Окно приложения](docs/wiki/interface/README.ru.md) | По странице на каждую часть окна. |
| [Работа с графом](docs/wiki/graph/README.ru.md) | Как собрать, проверить, сохранить и запустить граф. |
| [Помощник](docs/wiki/assistant/README.ru.md) | Спросить, Строить, Учиться, кто отвечает и что уходит. |
| [Уроки](docs/wiki/lessons/README.ru.md) | Встроенные уроки по темам. |
| [Понятия ComfyUI](docs/wiki/concepts/README.ru.md) | Энциклопедия ComfyUI для новичка. |
| [Справочник](docs/wiki/reference/README.ru.md) | Настройки, сочетания клавиш, сообщения, форматы файлов, словарь, решение проблем. |
| [Доверие](docs/wiki/trust/README.ru.md) | Приватность, безопасность, лицензия, выбор темы и доступность. |
| [Для разработчиков](docs/wiki/dev/README.ru.md) | Как устроен код, как его менять, как выходит версия. |

Та же документация есть в приложении: «Справка ▸ Руководство».

## Сборка из исходников

В Linux: [Сборка из исходников](docs/wiki/dev/Building-From-Source.ru.md). На Windows и macOS те же шаги, что делают
скрипты установки, вручную: [Windows](docs/wiki/dev/Building-On-Windows.ru.md), [macOS](docs/wiki/dev/Building-On-macOS.ru.md).

## Что работает сегодня и известные ограничения

NodeWise экспериментальный: от версии к версии многое меняется, некоторые части не доделаны. Чего он пока не
умеет: [Известные ограничения](docs/wiki/reference/Known-Limits.ru.md). Что изменилось:
[CHANGELOG.ru.md](CHANGELOG.ru.md).

Он никогда ничего не устанавливает, не скачивает, не удаляет, не записывает и не ставит в очередь в ComfyUI, не
собирает статистику и не отправляет отчёты о сбоях, а о новых версиях спрашивает, только если вы это включите. Все
места, куда он может обратиться: [Приватность](docs/wiki/trust/Privacy.ru.md).

## Пожелания, вопросы, проблемы

- Идеи, пожелания и вопросы: [обсуждения](../../discussions).
- Проблемы: [обращения](../../issues) («Справка ▸ Сообщить о проблеме…» в приложении впишет версии).
- Проблема безопасности: закрыто, см. [SECURITY.ru.md](SECURITY.ru.md).
- Код: [CONTRIBUTING.ru.md](CONTRIBUTING.ru.md); все участники следуют [правилам поведения](CODE_OF_CONDUCT.ru.md).

## Кто это делает

NodeWise Studio делает Алексей Пономаренко, независимый разработчик, который экспериментирует в области разработки
с ИИ. Приложение один из этих экспериментов: может ли программа научить ComfyUI, объясняя ваш собственный граф, и как
далеко один разработчик может довести настоящее приложение для компьютера, если большую часть инженерной работы под
его руководством делают ИИ-агенты? Большую часть кода и текстов написали ИИ-агенты для программирования под
его руководством и с его проверкой, и за всё, что здесь опубликовано, отвечает он. Подробнее, вместе с
принципами приложения: [Автор и эксперимент](docs/wiki/trust/Author.ru.md).

## Лицензия

MIT с условием Commons Clause: NodeWise можно бесплатно использовать, менять и распространять, но нельзя продавать
его или продукт или услугу, ценность которых в основном в нём. Исходный код открыт для чтения, но это не «открытый
исходный код» в обычном смысле. [LICENSE](LICENSE), [лицензия простыми словами](docs/wiki/trust/Licence.ru.md),
коммерческое использование: [COMMERCIAL.ru.md](COMMERCIAL.ru.md). Сторонние компоненты:
[THIRD_PARTY_NOTICES.ru.md](THIRD_PARTY_NOTICES.ru.md).

Выбор темы и материалы для взрослых: [Правила содержимого](docs/wiki/trust/Content-Rules.ru.md).
