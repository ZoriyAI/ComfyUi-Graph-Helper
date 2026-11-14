[English](README.md)
[Главная](../Home.ru.md) › Понятия ComfyUI

# Понятия ComfyUI

Энциклопедия ComfyUI для новичка, по одной идее на страницу. Впервые здесь? Сначала прочитайте [С чего начать](Start-Here.ru.md): там эти страницы стоят по порядку и рядом с уроками.

## Основа
- [С чего начать](Start-Here.ru.md): Страницы в том порядке, в каком они нужны новичку.
- [Что такое ComfyUI](What-Is-ComfyUI.ru.md): Сервер, редактор, очередь, выходные ноды и где появляется результат.
- [Ноды и связи](Nodes-And-Links.ru.md): Как граф складывается из нод и связей.
- [Типы данных](Data-Types.ru.md): MODEL, CLIP, VAE, LATENT, IMAGE, CONDITIONING и другие.
- [Форматы workflow](Workflow-Formats.ru.md): Файл workflow, формат API и картинки с workflow внутри.
- [Где лежат файлы ComfyUI](Where-Files-Live.ru.md): models/, input/, output/ и custom_nodes/.

## Как делается картинка
- [Картинка из текста](Text-To-Image.ru.md): Основной граф из семи нод.
- [Чекпойнт](Checkpoint.ru.md): Главный файл модели.
- [Отдельные загрузчики](Separate-Loaders.ru.md): Диффузионная модель, текстовый энкодер и VAE отдельными файлами.
- [Текстовые энкодеры](Text-Encoders.ru.md): CLIP, T5 и почему у некоторых моделей их два.
- [Conditioning](Conditioning.ru.md): Закодированный промпт, по которому идёт сэмплер.
- [Промпт](Prompt.ru.md): Как модель читает текст: теги или предложения, порядок, длина.
- [Синтаксис промпта и веса](Prompt-Syntax.ru.md): Что ComfyUI понимает в промпте и чего не понимает.
- [Негативный промпт](Negative-Prompt.ru.md): Как сказать, чего не нужно.
- [Латент](Latent.ru.md): Сжатая картинка, с которой работает модель.
- [VAE](VAE.ru.md): Превращение латента в картинку и обратно.
- [Сэмплер](Sampler.ru.md): Нода, которая шаг за шагом делает картинку, и имена сэмплеров.
- [Планировщик](Scheduler.ru.md): Как шум убирается по шагам.
- [Шаги](Steps.ru.md): Сколько шагов и что меняется, если их больше.
- [CFG](CFG.ru.md): Насколько строго модель следует промпту; guidance у Flux.
- [Seed](Seed.ru.md): Число, от которого результат повторяется.
- [Denoise](Denoise.ru.md): Какая часть исходной картинки перерисовывается.
- [Размер и пропорции](Resolution.ru.md): Размеры картинки, которые любит каждое семейство.
- [Пачка (batch)](Batch.ru.md): Несколько картинок за один запуск.

## Приёмы с картинками
- [Картинка из картинки](Image-To-Image.ru.md): Начать с картинки вместо шума.
- [Инпейнтинг](Inpainting.ru.md): Перерисовать только часть картинки, и маски.
- [Аутпейнтинг](Outpainting.ru.md): Продолжить картинку за её края.
- [LoRA](LoRA.ru.md): Небольшая добавка, которая меняет стиль или тему.
- [ControlNet](ControlNet.ru.md): Управление картинкой позой, глубиной или контурами; препроцессоры.
- [Картинки-образцы](Reference-Images.ru.md): IP-Adapter, Redux и модели правки.
- [Увеличение](Upscaling.ru.md): Как увеличить картинку.

## Семейства моделей
- [Семейства моделей](Model-Families.ru.md): SD 1.5, SDXL, Pony, Flux, Wan и другие; что с чем сочетается.
- [Почему семейства не смешиваются](Why-Families-Do-Not-Mix.ru.md): Что бывает, когда встречаются файлы разных семейств.
- [SD 1.5](Family-SD15.ru.md): Классическая модель на 512 пикселей.
- [SDXL](Family-SDXL.ru.md): Модель на 1024 пикселя с двумя текстовыми энкодерами.
- [Pony](Family-Pony.ru.md): Линия на SDXL со score-тегами.
- [Illustrious](Family-Illustrious.ru.md): Аниме-линия на SDXL.
- [SD 3 и 3.5](Family-SD3.ru.md): Три текстовых энкодера, 16-канальный латент.
- [Flux.1](Family-Flux1.ru.md): dev, schnell и модели-инструменты.
- [Flux.1 Krea](Family-Krea.ru.md): Flux.1 dev, дообученный на реализм.
- [Flux.2](Family-Flux2.ru.md): Второе поколение Flux, dev и Klein.
- [Chroma](Family-Chroma.ru.md): Открытая модель из Flux.1 schnell.
- [Qwen-Image](Family-Qwen-Image.ru.md): Текст на картинках и правка.
- [Z-Image](Family-Z-Image.ru.md): Быстрая модель картинок 6B.
- [Kolors](Family-Kolors.ru.md): Модель вроде SDXL с энкодером ChatGLM.
- [AuraFlow](Family-AuraFlow.ru.md): Открытая модель на методе flow.
- [Stable Cascade](Family-Stable-Cascade.ru.md): Модель, которая работает ступенями.
- [Wan 2.1](Family-Wan21.ru.md): Открытое видео, 1.3B и 14B.
- [Wan 2.2](Family-Wan22.ru.md): Видеомодель уроков.
- [HunyuanVideo](Family-HunyuanVideo.ru.md): Видеомодель Tencent.
- [LTX-2](Family-LTX2.ru.md): Видео со звуком.

## Видео и звук
- [Модели для видео](Video-Models.ru.md): Чем видео отличается от картинок.
- [Длина видео и частота кадров](Video-Length-And-Frame-Rate.ru.md): Кадры, длина и fps по моделям.
- [Два прохода Wan 2.2](Wan-Two-Passes.ru.md): Два эксперта, два сэмплера, одна генерация.
- [LoRA-ускорители](Speed-Up-LoRAs.ru.md): Четыре шага вместо двадцати.
- [Первый и последний кадр](First-And-Last-Frame.ru.md): Ролик между двумя картинками.
- [Видео из видео](Video-To-Video.ru.md): Движение, глубина или камера из другого видео.
- [Анимация по позе](Pose-Animation.ru.md): Герой двигается, как человек в видео.
- [Говорящие портреты](Talking-Portraits.ru.md): Лицо произносит запись, с согласием.
- [Звук](Audio.ru.md): Звук в ComfyUI.

## Практика
- [Память видеокарты](Graphics-Card-Memory.ru.md): Почему не хватает памяти и что помогает.
- [Паки нод](Node-Packs.ru.md): Сторонние ноды, установка через ComfyUI Manager и риск.
- [Опасные форматы моделей](Unsafe-Model-Formats.ru.md): Почему .safetensors и почему старые форматы могут выполнять код.
- [Платные API-ноды](Paid-API-Nodes.ru.md): Partner Nodes, которые отправляют данные наружу и стоят кредитов.
- [Заметки, reroute и primitive](Notes-Reroutes-Primitives.ru.md): Вспомогательные ноды и группы.
- [Обход и выключение нод](Bypass-And-Mute.ru.md): Выключить ноду, не удаляя её.
- [Субграфы](Subgraphs.ru.md): Несколько нод, упакованных в одну.
- [Как читать чужой workflow](Reading-A-Workflow.ru.md): Способ разобрать чужой граф.

## См. также
- [Главная](../Home.ru.md)
- [Уроки](../lessons/README.ru.md)
