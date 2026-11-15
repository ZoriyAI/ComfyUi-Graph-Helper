[English](Family-Illustrious.md)
[Главная](../Home.ru.md) › [Понятия ComfyUI](README.ru.md)

# Illustrious

Illustrious XL: линия моделей, дообученных от SDXL с упором на аниме, основа NoobAI и многих дообученных моделей.

## Что это
Illustrious XL дообучили от SDXL на большом наборе иллюстраций с тегами. Она знает многих персонажей и стили по их тегам. На ней построены NoobAI-XL и множество аниме-чекпойнтов. Как и Pony, внутри это SDXL.

## Файлы и ноды
Один чекпойнт, **Load Checkpoint**, Empty Latent Image, как у SDXL.

## Настройки, которые работают
Размеры SDXL, часто чуть больше (в поздних версиях примерно до 1536, по странице модели); 20 до 30 шагов; cfg около 5 до 7; `euler_ancestral` или `euler`. Промпт: теги в стиле booru (`1girl, solo, red coat, outdoors, rain`) и теги качества, которые советует страница модели (например `masterpiece, best quality`).

## Что подходит
Лучше всего LoRA, обученные для Illustrious или NoobAI; LoRA для SDXL грузятся с разным успехом; LoRA для Pony часто ведут себя плохо. Добавки SD 1.5 и Flux не работают.

## Как помогает приложение
На карточках моделей показывается как **Illustrious**; распознаются имена с отдельными словами `illustrious`, `noobai`, `ill` или `ilxl`. Урок [Pony и Illustrious: теги вместо предложений](../lessons/Pony-And-Illustrious.ru.md) пишет промпт тегами.

## См. также
- [SDXL](Family-SDXL.ru.md)
- [Pony](Family-Pony.ru.md)
- [Промпт](Prompt.ru.md)
- [Семейства моделей](Model-Families.ru.md)
