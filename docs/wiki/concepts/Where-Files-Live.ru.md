[English](Where-Files-Live.md)
[Главная](../Home.ru.md) › [Понятия ComfyUI](README.ru.md)

# Где лежат файлы ComfyUI

Папки ComfyUI: куда класть каждый вид моделей, откуда берутся картинки и куда уходят результаты.

## Главные папки
Внутри папки ComfyUI (у ComfyUI Desktop внутри папки, выбранной при установке):

| Папка | Что там лежит |
|---|---|
| `models/` | Все файлы моделей, по видам (ниже). |
| `input/` | Картинки, видео и звуки, которые показывают Load Image, Load Video и Load Audio. Загрузка в редакторе кладёт файл сюда. |
| `output/` | То, что пишут Save Image, Save Video и другие выходные ноды. |
| `temp/` | То, что показывает Preview Image; ComfyUI сам её чистит. |
| `custom_nodes/` | Установленные паки нод, по папке на пак. |
| `user/` | Ваши настройки и сохранённые workflow (`user/default/workflows`). |

## Папки моделей
| Папка | Файлы | Кто читает |
|---|---|---|
| `models/checkpoints` | Цельные чекпойнты (SD 1.5, SDXL, Pony, Illustrious и некоторые другие) | Load Checkpoint |
| `models/diffusion_models` (старое имя `unet`) | Одни диффузионные модели (Flux, Qwen-Image, Z-Image, Wan, HunyuanVideo) | Load Diffusion Model |
| `models/text_encoders` (старое имя `clip`) | Текстовые энкодеры (clip_l, t5xxl, umt5_xxl, Qwen) | Load CLIP, DualCLIPLoader |
| `models/vae` | Файлы VAE | Load VAE |
| `models/loras` | Файлы LoRA | Load LoRA и LoraLoaderModelOnly |
| `models/controlnet` | Модели ControlNet | Load ControlNet Model |
| `models/upscale_models` | Апскейлеры вроде ESRGAN | Load Upscale Model |
| `models/clip_vision` | Кодировщики картинок (clip_vision_h и другие) | Load CLIP Vision |
| `models/embeddings` | Textual inversion | `embedding:name` в промпте |
| `models/style_models`, `models/audio_encoders` и другие | Модели особого назначения | Свои ноды-загрузчики |

Паки часто добавляют свои папки (например `models/detection` для моделей позы, `models/wav2vec2` для моделей речи или папку для GGUF), и их README говорит, какие.

Подпапки можно: файл из `models/loras/wan/` появится в списке как `wan/name.safetensors`.

Чтобы держать модели в другом месте (на втором диске или вместе с другой программой), ComfyUI читает `extra_model_paths.yaml` в своей папке (у ComfyUI Desktop это задаётся в его настройках). После правки перезапустите ComfyUI.

## Частые ошибки
- **Файл не в той папке**: его нет в списке загрузчика. Переложите и обновите (клавиша R в редакторе ComfyUI) или перезапустите.
- **Папка моделей по правилам другой программы** (`Stable-diffusion`, `Lora`): ComfyUI туда не смотрит, если так не сказано в `extra_model_paths.yaml`.
- **Ждать файлы Preview Image в `output`**: они уходят в `temp`.

## Как помогает приложение
Приложение читает списки файлов моделей из вашего ComfyUI. Добавили файлы, выберите **Синхронизация ▸ Синхронизировать сейчас**. Вкладка **Модели** в библиотеке показывает их, а **Проверка** называет модель, которую просит граф, но которой нет на диске, с её папкой. Приложение никогда не скачивает и не переносит файлы.

## См. также
- [Отдельные загрузчики](Separate-Loaders.ru.md)
- [Паки нод](Node-Packs.ru.md)
- [Опасные форматы моделей](Unsafe-Model-Formats.ru.md)
- [Библиотека моделей](../interface/Model-Library.ru.md)
- [Меню «Синхронизация»](../interface/Sync-Menu.ru.md)
- [Как получить ComfyUI](../start/ComfyUI.ru.md)
