[English](Separate-Loaders.md)
[Главная](../Home.ru.md) › [Понятия ComfyUI](README.ru.md)

# Отдельные загрузчики: диффузионная модель, текстовый энкодер, VAE

Почему новые модели приходят тремя или четырьмя файлами и какая нода грузит каждый.

## Простыми словами
[Чекпойнт](Checkpoint.ru.md) складывает в один файл рисующую модель, текстовый энкодер и VAE. Новые семейства так не делают: их части большие и общие для разных версий, поэтому авторы выкладывают их отдельно. Один файл текстового энкодера служит нескольким версиям модели, один VAE служит всему семейству. Тогда каждую часть грузит своя нода, а соединяются они в графе.

## Где встречается в графе

| Часть | Нода (имя на экране) | Класс | Папка | Выход |
|---|---|---|---|---|
| Диффузионная модель | Load Diffusion Model | `UNETLoader` | `models/diffusion_models` (раньше `models/unet`) | `MODEL` |
| Один текстовый энкодер | Load CLIP | `CLIPLoader` | `models/text_encoders` (раньше `models/clip`) | `CLIP` |
| Два текстовых энкодера | DualCLIPLoader | `DualCLIPLoader` | `models/text_encoders` | `CLIP` |
| VAE | Load VAE | `VAELoader` | `models/vae` | `VAE` |

У Load CLIP и DualCLIPLoader есть поле `type`, оно должно называть семейство: например `wan`, `qwen_image`, `flux`, `hunyuan_video`, `sd3`. У Load Diffusion Model есть `weight_dtype`: `default` оставляет точность самого файла, варианты `fp8` хранят веса в 8 битах ради экономии памяти, чуть теряя в качестве.

Обычные наборы:
- **Flux.1**: Load Diffusion Model (`flux1-dev`), DualCLIPLoader с `clip_l` и `t5xxl` (type `flux`), Load VAE с `ae.safetensors`.
- **Wan 2.1 / 2.2 14B**: Load Diffusion Model (у Wan 2.2 две), Load CLIP с `umt5_xxl` (type `wan`), Load VAE с `wan_2.1_vae`.
- **Qwen-Image**: Load Diffusion Model, Load CLIP с Qwen2.5-VL (type `qwen_image`), Load VAE с `qwen_image_vae`.
- **Z-Image Turbo**: Load Diffusion Model, Load CLIP с `qwen_3_4b`, Load VAE с `ae.safetensors`.

У некоторых паков свои загрузчики (например загрузчики GGUF или загрузчики WanVideoWrapper), и их выходы бывают других типов.

## Частые ошибки
- **Не тот `type`** у Load CLIP: модель получает бессмысленные числа и рисует шум или что-то постороннее.
- **Текстовый энкодер или VAE другого семейства**: ошибки о размерах («size mismatch») или сломанные цвета.
- **Диффузионная модель в `checkpoints`**: Load Diffusion Model её не покажет. Переложите в `diffusion_models`.
- **Забыли одну часть**: модель одна ничего не делает, нужны все три из одного семейства.

## Как помогает приложение
- Описания нод говорят, из какой папки читает каждый загрузчик и какие бывают значения `type`.
- Урок [Какой загрузчик для какого файла](../lessons/Which-Loader.ru.md) разбирает загрузчики; уроки о видео и о моделях картинок проверяют `type` и вид каждого файла.
- **Проверка** перечисляет файлы моделей, которых нет на диске, и модели разных семейств в одном пути.
- В **Свойствах** у поля со встроенной заметкой рядом с именем есть кнопка **Что делает это поле**; она открывает заметку под полем: что делает поле и что в него ставить.

## См. также
- [Чекпойнт](Checkpoint.ru.md)
- [Текстовые энкодеры](Text-Encoders.ru.md)
- [VAE](VAE.ru.md)
- [Семейства моделей](Model-Families.ru.md)
- [Память видеокарты](Graphics-Card-Memory.ru.md)
- [Где лежат файлы ComfyUI](Where-Files-Live.ru.md)
