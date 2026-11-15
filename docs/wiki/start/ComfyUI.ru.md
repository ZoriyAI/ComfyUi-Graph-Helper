[English](ComfyUI.md)
[Главная](../Home.ru.md) › [Начало](README.ru.md)

# ComfyUI и где его взять

ComfyUI это бесплатная программа, которая делает картинки и видео с помощью моделей ИИ. Работа строится как граф:
блоки (ноды), соединённые проводами (связями). CozyGraph учит собирать и читать такие графы, а запускает их ComfyUI.
Нужны оба.

## Что такое ComfyUI

- Он работает на вашем компьютере и использует видеокарту. Чем больше у неё памяти, тем больше модели можно
  запускать.
- Работают с ним в браузере: ComfyUI запускает небольшой веб-сервер, обычно по адресу `http://127.0.0.1:8188`.
- Что он умеет, зависит от моделей и паков нод, которые вы к нему добавили. См. [Чекпойнт](../concepts/Checkpoint.ru.md)
  и [Паки нод](../concepts/Node-Packs.ru.md).
- Его делает отдельный проект, не связанный с CozyGraph.

## Как его получить

Официальная инструкция лежит на [docs.comfy.org](https://docs.comfy.org/) (раздел об установке). Коротко:
<!-- verify: the names of the official installers and the address of the instructions -->

| Способ | Для | Что это |
|---|---|---|
| ComfyUI Desktop | Windows, macOS | Установщик, который всё настраивает сам. |
| Переносная сборка (portable) | Windows | Папка, которую распаковывают и запускают. |
| Установка вручную | Linux, любая система | Взять исходники через Git, поставить пакеты Python, запустить `main.py`. |
| comfy-cli | Linux, любая система | Программа для командной строки, которая ставит и запускает ComfyUI за вас. |

На Linux установка вручную выглядит так (подробности для вашей видеокарты есть в официальной инструкции):

```bash
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI
python3 -m venv venv
. venv/bin/activate
pip install torch torchvision torchaudio   # команда под вашу видеокарту есть в официальной инструкции
pip install -r requirements.txt
python main.py
```

<!-- verify: the repository address of ComfyUI and the torch install line -->

Через comfy-cli:

```bash
pip install comfy-cli
comfy install
comfy launch
```

## Узнайте его адрес

При запуске ComfyUI пишет в терминале свой адрес, например `To see the GUI go to: http://127.0.0.1:8188`. Откройте
его в браузере, чтобы убедиться, что ComfyUI работает. Этот адрес и нужен CozyGraph.

- На этом же компьютере адрес обычно `http://127.0.0.1:8188`.
- Чтобы достучаться до ComfyUI с другого компьютера дома, запустите его с `--listen` (например,
  `python main.py --listen 0.0.0.0`) и берите адрес этого компьютера в сети, например `http://192.168.1.50:8188`.
  Делайте так только в сети, которой доверяете: у ComfyUI нет пароля.

Как подключается CozyGraph, описано на странице [Подключение к ComfyUI](../connect/Connecting.ru.md).

## Первая модель

В свежем ComfyUI моделей нет. Для первой картинки нужен один чекпойнт (главный файл модели):

1. Скачайте чекпойнт (файл `.safetensors`) того семейства, которое потянет ваша видеокарта. Модели SD 1.5 самые
   маленькие, SDXL нужно больше памяти. См. [Семейства моделей](../concepts/Model-Families.ru.md).
2. Положите его в папку `ComfyUI/models/checkpoints`.
3. В ComfyUI обновите страницу, в CozyGraph прочитайте ComfyUI ещё раз («Синхронизация ▸ Синхронизировать
   сейчас»), чтобы файл появился в библиотеке.

Куда кладётся каждый вид файлов: [Где лежат файлы ComfyUI](../concepts/Where-Files-Live.ru.md).

## Паки нод

Многие уроки и workflow используют ноды, которых нет в самом ComfyUI, например WanVideoWrapper для видео. Они
приходят в паках нод, которые ставят через ComfyUI Manager или вручную. CozyGraph их никогда не ставит; если знает,
он скажет, из какого пака недостающая нода. См. [Паки нод](../concepts/Node-Packs.ru.md).

## См. также

- [Начало](README.ru.md)
- [Быстрый старт](Quick-Start.ru.md)
- [Подключение к ComfyUI](../connect/Connecting.ru.md)
- [Где лежат файлы ComfyUI](../concepts/Where-Files-Live.ru.md)
- [Память видеокарты](../concepts/Graphics-Card-Memory.ru.md)
