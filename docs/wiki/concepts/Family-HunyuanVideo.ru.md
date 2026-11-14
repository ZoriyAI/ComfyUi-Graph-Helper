[English](Family-HunyuanVideo.md)
[Главная](../Home.ru.md) › [Понятия ComfyUI](README.ru.md)

# HunyuanVideo

HunyuanVideo от Tencent: открытая видеомодель с текстовым энкодером на языковой модели; версия 1.5 это отдельное, более лёгкое семейство.

## Что это
HunyuanVideo (конец 2024) это модель видео из текста на 13 миллиардов параметров; позже вышла версия видео из картинки. **HunyuanVideo 1.5** (конец 2025) это новая, меньшая модель со своими файлами и графами. Модели картинок Hunyuan от Tencent это опять отдельные семейства.

## Файлы и ноды
**Load Diffusion Model** с моделью HunyuanVideo; **DualCLIPLoader** с `clip_l` и `llava_llama3` (type `hunyuan_video`); **Load VAE** с `hunyuan_video_vae`; **EmptyHunyuanLatentVideo**; видео из картинки добавляет кодировщик CLIP Vision и свою ноду conditioning. У версии 1.5 свой шаблон.

## Настройки, которые работают
Примерно от 848×480 до 1280×720; примерно до 129 кадров при 24 fps (4n + 1); около 20 до 30 шагов; guidance через ноду вроде FluxGuidance в шаблонах; `euler` с `simple`. Промпт: подробные предложения.

## Что подходит
LoRA, сделанные для HunyuanVideo (и отдельно для 1.5). LoRA для Wan не работают.

## Как помогает приложение
Показывается как **HunyuanVideo** на карточках моделей. Нода EmptyHunyuanLatentVideo, названная по этому семейству, используется и в графах Wan.

## См. также
- [Генерация видео](Video-Models.ru.md)
- [Текстовые энкодеры](Text-Encoders.ru.md)
- [Длина видео и частота кадров](Video-Length-And-Frame-Rate.ru.md)
