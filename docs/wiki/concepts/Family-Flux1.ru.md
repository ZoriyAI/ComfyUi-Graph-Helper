[English](Family-Flux1.md)
[Главная](../Home.ru.md) › [Понятия ComfyUI](README.ru.md)

# Flux.1

Flux.1 от Black Forest Labs: большая модель картинок (dev, schnell и модели-инструменты), которая читает предложения и точно следует промпту.

## Что это
Вышедшая в 2024 году Flux.1 это трансформер на 12 миллиардов параметров. **dev** это версия на качество (веса под некоммерческой лицензией); **schnell** дистиллирована на 4 шага (Apache 2.0). Black Forest Labs выпустили ещё **Fill** (инпейнтинг и аутпейнтинг), **Canny** и **Depth** (управление), **Redux** (варианты картинки) и **Kontext** (правка по указанию). Для dev есть большой мир дообученных моделей и LoRA.

## Файлы и ноды
- **Load Diffusion Model**: `flux1-dev` или `flux1-schnell` (версии fp8 около 12 ГБ) в `models/diffusion_models`. Некоторые цельные чекпойнты fp8 грузятся через Load Checkpoint.
- **DualCLIPLoader**: `clip_l` и `t5xxl` (fp16 или fp8), `type` `flux`.
- **Load VAE**: `ae.safetensors`.
- **EmptySD3LatentImage**; **FluxGuidance** на положительном conditioning; часто **ModelSamplingFlux**; многие шаблоны берут SamplerCustomAdvanced с BasicGuider.

## Настройки, которые работают
Около 1 мегапикселя, гибко примерно до 2; dev: 20 до 30 шагов, cfg 1, FluxGuidance около 3.5 (ниже для большей естественности), `euler` с `simple` или `beta`. schnell: 4 шага, cfg 1. Промпт: обычные предложения; короткий текст в кавычках модель умеет написать на картинке. Негативный промпт при cfg 1 не действует.

## Что подходит
Только LoRA и ControlNet для Flux.1. Файлы Flux.2 несовместимы. FLUX.1 Krea [dev] это Flux.1 dev, заново дообученная Krea: она загружается в точности как Flux.1, и LoRA для Flux.1 dev обычно грузятся, хотя результат может отличаться. Chroma родственна, но с LoRA для Flux.1 ведёт себя иначе. Krea 2 это другая архитектура: файлы Flux с ней не работают.

## Как помогает приложение
Показывается как **Flux.1** на карточках моделей. Встроенные знания описывают FluxGuidance и ModelSamplingFlux. С Flux.1 работают уроки [Flux.1: картинка из отдельных файлов](../lessons/Flux1.ru.md), [Квантованная модель: GGUF](../lessons/GGUF.ru.md), [Картинка-образец для стиля (Flux Redux)](../lessons/Style-Reference.ru.md) и [Тот же персонаж на новой картинке: FLUX.1 Kontext](../lessons/Character-Kontext.ru.md).

## См. также
- [CFG и guidance](CFG.ru.md)
- [Krea 2](Family-Krea.ru.md)
- [Flux.2](Family-Flux2.ru.md)
- [Chroma](Family-Chroma.ru.md)
- [Отдельные загрузчики](Separate-Loaders.ru.md)
