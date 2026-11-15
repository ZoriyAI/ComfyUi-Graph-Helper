[English](Family-Flux2.md)
[Главная](../Home.ru.md) › [Понятия ComfyUI](README.ru.md)

# Flux.2

Flux.2 от Black Forest Labs: второе поколение Flux, для картинок и для правки по нескольким картинкам-образцам.

## Что это
Flux.2 (конец 2025) это новое устройство, а не обновление файлов Flux.1. Её модель **dev** большая и использует как текстовый энкодер крупную языковую модель (модель Mistral); для обычных видеокарт следом вышли меньшие модели **Klein**. Flux.2 умеет брать картинки-образцы и править или соединять их по указанию.

## Файлы и ноды
**Load Diffusion Model** с моделью Flux.2; **Load CLIP** со своим текстовым энкодером, `type` `flux2`; **Load VAE** с VAE Flux.2 (`flux2-vae`); **Empty Flux 2 Latent** (`EmptyFlux2LatentImage`), пустой латент из официального шаблона; картинки-образцы входят в conditioning через ноды образцов. У dev и Klein разные текстовые энкодеры: у dev модель Mistral `mistral_3_small_flux2`, у Klein 4B `qwen_3_4b`, у Klein 9B `qwen_3_8b`; VAE у всех общий, `flux2-vae`. Граф Klein в шаблонах собирает сэмплер из частей: **Flux2Scheduler**, **CFGGuider**, **RandomNoise**, **KSamplerSelect** и **SamplerCustomAdvanced**. Точные файлы берите из шаблона Flux.2 или Flux.2 Klein в ComfyUI.

## Настройки, которые работают
Шаги, guidance и размеры берите из шаблона: dev работает примерно от 1 до 4 мегапикселей с guidance; дистиллированные версии Klein берут мало шагов и cfg 1. Промпт: подробные предложения; модель справляется с текстом на картинке и структурированными промптами.

## Что подходит
Только LoRA, текстовый энкодер и VAE для Flux.2. Файлы Flux.1 (LoRA, `t5xxl`, `ae.safetensors`) с ней не работают.

## Как помогает приложение
Показывается как **Flux.2** на карточках моделей. Встроенные знания называют оба текстовых энкодера: на основе Mistral у dev, `qwen_3_4b` или `qwen_3_8b` у Klein. Урок [Flux.2 Klein: сэмплер из частей](../lessons/Flux2-Klein.ru.md) собирает граф Klein и проверяет его файлы.

## См. также
- [Flux.1](Family-Flux1.ru.md)
- [Картинки-образцы](Reference-Images.ru.md)
- [Текстовые энкодеры](Text-Encoders.ru.md)
- [Почему семейства не смешиваются](Why-Families-Do-Not-Mix.ru.md)
