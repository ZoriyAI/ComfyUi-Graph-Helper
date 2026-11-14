[English](Family-Krea.md)
[Главная](../Home.ru.md) › [Понятия ComfyUI](README.ru.md)

# Flux.1 Krea

FLUX.1 Krea [dev]: модель Flux.1 dev, заново дообученная Krea и Black Forest Labs ради более естественного стиля, меньше похожего на «картинку от нейросети».

## Что это
FLUX.1 Krea [dev] (2025) сохраняет устройство Flux.1 dev и дообучена на фотографическую достоверность и разнообразную эстетику. Она встаёт прямо на место Flux.1 dev.

## Файлы и ноды
Точно как у Flux.1: **Load Diffusion Model** с файлом Krea, **DualCLIPLoader** с `clip_l` и `t5xxl` (type `flux`), **Load VAE** с `ae.safetensors`, EmptySD3LatentImage, FluxGuidance.

## Настройки, которые работают
Как у Flux.1 dev: около 1 мегапикселя, 20 до 30 шагов, cfg 1 и guidance около 3.5 до 4.5, `euler`. Промпт: обычные предложения.

## Что подходит
LoRA для Flux.1 dev обычно грузятся, но результат может отличаться от исходной модели. Файлы Flux.2 не подходят.

## В приложении
Во встроенных знаниях есть семейство «krea», и его текст описывает FLUX.1 Krea [dev]. А распознавание файлов в приложении относит файлы с именем «Flux.1 Krea» к **Flux.1**, а для файлов с одним словом «krea» показывает метку **Krea 2** и считает их отдельным устройством. Поэтому файл FLUX.1 Krea обычно показывается на карточке как Flux.1.
<!-- verify: the krea family label and text (knowledge says FLUX.1 Krea dev, the label says Krea 2) -->

## См. также
- [Flux.1](Family-Flux1.ru.md)
- [Семейства моделей](Model-Families.ru.md)
- [CFG и guidance](CFG.ru.md)
