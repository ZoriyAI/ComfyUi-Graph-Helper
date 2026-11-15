[English](Family-Krea.md)
[Главная](../Home.ru.md) › [Понятия ComfyUI](README.ru.md)

# Krea 2

Krea 2 от Krea AI: модель для картинок, обученная с нуля, со своей архитектурой. Приложение показывает это семейство
как **Krea 2**.

## Что это
Krea 2 это не версия Flux. Она бывает двух видов:
- **RAW**: основа для обучения LoRA; ей нужно много шагов (около 52).
- **Turbo**: ускорена до 8 шагов, для самих картинок.

## Не FLUX.1 Krea [dev]
FLUX.1 Krea [dev] это другая модель с похожим именем: Flux.1 dev, заново дообученная Krea. Она загружается в точности
как Flux.1 и относится к семейству [Flux.1](Family-Flux1.ru.md). Приложение различает файлы так же: имя, где есть и
Flux, и Krea («Flux.1 Krea», «krea-flux»), это Flux.1; имя, где есть только «krea» или «krea2», это Krea 2.

## Файлы и ноды
- Модель, например `krea2_turbo`, в `models/diffusion_models`, через **Load Diffusion Model**.
- Текстовый энкодер `qwen3vl_4b` в `models/text_encoders`, через **Load CLIP**, `type` `krea2`.
- VAE `qwen_image_vae` в `models/vae`, через **Load VAE**.

Точные файлы берите из шаблона Krea 2 в ComfyUI.

## Настройки, которые работают
Шаблон Krea 2 Turbo: **Empty Latent Image** 1024 × 1024, **KSampler** 8 шагов, `cfg` 1, `euler`, `simple` и
**ConditioningZeroOut** вместо негативного промпта. RAW нужно около 52 шагов.

## Что подходит
Только файлы, сделанные для Krea 2. LoRA для Flux с ней не работают. LoRA, обученные на RAW, подходят и к Turbo.

## Как помогает приложение
На карточках моделей показывается как **Krea 2**. Наведите указатель на метку семейства, чтобы прочитать встроенную
заметку: что такое Krea 2, куда кладут её файлы и что это не FLUX.1 Krea [dev], поэтому LoRA для Flux с ней не
работают.

## См. также
- [Flux.1](Family-Flux1.ru.md)
- [Семейства моделей](Model-Families.ru.md)
- [Почему файлы разных семейств не смешиваются](Why-Families-Do-Not-Mix.ru.md)
- [Отдельные загрузчики](Separate-Loaders.ru.md)
