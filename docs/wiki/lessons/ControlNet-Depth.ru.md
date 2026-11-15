[English](ControlNet-Depth.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# ControlNet по карте глубины

<!-- lesson: controlnet-depth -->
Урок «controlnet-depth» в группе **Паки и инструменты** списка уроков. Шагов: 7.

## Чему вы научитесь
Пак comfyui_controlnet_aux превращает картинку в карту глубины, и модель рисует новую сцену в том же пространстве.

## Что понадобится
- Урок продолжает [ControlNet: рисунок по контурам картинки](ControlNet.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Паки нод: **comfyui_controlnet_aux**. Их вы ставите в ComfyUI сами, потом выбираете **Синхронизация ▸ Синхронизировать сейчас**. До тех пор карточка говорит, что урок не подходит, и называет пак.
- Ноды: Load ControlNet Model, Load Image, Apply ControlNet, KSampler, Depth Anything V2 - Relative.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Что даёт карта глубины** (чтение)

   Карта глубины это серая картинка: близкое светлое, далёкое тёмное. С ней модель сохраняет пространство сцены, стены и расстояния, не копируя её линий.

   Своего искателя глубины у ComfyUI нет: он приходит с паком comfyui_controlnet_aux. Пак нод запускает на вашем компьютере чужой код. Ставьте его сами через менеджер ComfyUI, с его официальной страницы, и только если доверяете авторам. Приложение ничего не устанавливает.

   Урок продолжает «ControlNet: рисунок по контурам картинки».

2. **Нужен граф с ControlNet**

   На холсте должны быть **Load ControlNet Model**, **Load Image**, **Apply ControlNet** и **KSampler**, как их оставил урок о ControlNet.

   Если их нет, сначала пройдите тот урок.

3. **Сделайте карту глубины**

   Добавьте ноду **Depth Anything V2 - Relative** и подключите выход ноды **Load Image** к её входу `image`. В поле `resolution` поставьте 1024.

   `resolution` это размер, в котором считается глубина: чем ближе к размеру картинки, тем тоньше детали. Свою модель нода скачает сама при первом запуске графа в ComfyUI.

4. **Отдайте карту глубины ControlNet**

   Подключите выход ноды **Depth Anything V2 - Relative** ко входу `image` ноды **Apply ControlNet**. Контуры заменятся.

   Ноду контуров можно оставить или удалить: её выход теперь никуда не ведёт.

5. **Выберите ControlNet для глубины** (чтение)

   Выберите в `control_net_name` ноды **Load ControlNet Model** ControlNet для глубины: в его названии стоит «depth». ControlNet для контуров читает карту глубины неверно и даёт кашу.

   Подключите карту глубины к ноде Preview Image, чтобы увидеть её до рисования.

6. **Другие ноды пака** (чтение)

   В паке есть нода для каждого вида ControlNet: lineart, OpenPose и DWPose для позы человека, карты нормалей, сегментация. Его нода «AIO Aux Preprocessor» держит их все за одним списком.

   Пак ComfyUI-Advanced-ControlNet добавляет более тонкое управление силой по шагам, для тех, кому это нужно.

7. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

   Что попробовать: фотографию комнаты и описание комнаты в другом стиле.

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 2, **Нужен граф с ControlNet**:
  - нода **Load ControlNet Model**.
  - нода **Load Image**.
  - нода **Apply ControlNet**.
  - нода **KSampler**.
  - `CONTROL_NET` ноды **Load ControlNet Model** во вход `control_net` ноды **Apply ControlNet**.
  - `positive` ноды **Apply ControlNet** во вход `positive` ноды **KSampler** (можно через Apply ControlNet или InpaintModelConditioning или Conditioning (Combine) или ConditioningSetArea или ConditioningSetAreaPercentage или ConditioningSetMask или Apply Style Model или FluxGuidance или ConditioningZeroOut или FluxKontextMultiReferenceLatentMethod).
  - файл в поле `control_net_name` ноды **Load ControlNet Model** сделан для семейства файла из поля `ckpt_name` ноды checkpoint. Почему: loRA и ControlNet работают только с тем семейством моделей, для которого сделаны; с другим они ничего не дают или портят картинку.
- Шаг 3, **Сделайте карту глубины**:
  - нода **Depth Anything V2 - Relative**.
  - `IMAGE` ноды **Load Image** во вход `image` ноды **Depth Anything V2 - Relative** (можно через Upscale Image или Upscale Image By или Scale Image to Total Pixels или FluxKontextImageScale или Resize Image или ImageResizeKJv2 или Pad Image for Outpainting).
  - `resolution` ноды **Depth Anything V2 - Relative**: от 768 до 2048; «Сделать за меня» ставит 1024.
- Шаг 4, **Отдайте карту глубины ControlNet**:
  - `IMAGE` ноды **Depth Anything V2 - Relative** во вход `image` ноды **Apply ControlNet**.

## См. также
- [ControlNet и препроцессоры](../concepts/ControlNet.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
