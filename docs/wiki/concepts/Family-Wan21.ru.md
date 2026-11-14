[English](Family-Wan21.md)
[Главная](../Home.ru.md) › [Понятия ComfyUI](README.ru.md)

# Wan 2.1

Wan 2.1 от Alibaba: открытая видеомодель для видео из текста и из картинки, в малом размере 1.3B и большом 14B, с множеством добавок.

## Что это
Вышедшая в 2025 году Wan 2.1 сделала хорошую открытую генерацию видео доступной. Модели 14B есть в версиях 480p и 720p для видео из текста (`t2v`) и из картинки (`i2v`); модель 1.3B работает на слабых картах. На ней построено большое семейство добавок: VACE, первый и последний кадр (FLF2V), Fun Control и InP, InfiniteTalk и MultiTalk, FantasyTalking, UniAnimate, ReCamMaster, LoRA-ускорители.

## Файлы и ноды
**Load Diffusion Model** (`wan2.1_t2v_14B`, `wan2.1_i2v_480p_14B` и другие); **Load CLIP** с `umt5_xxl` (type `wan`); **Load VAE** с `wan_2.1_vae`; для видео из картинки ещё **Load CLIP Vision** с `clip_vision_h`. EmptyHunyuanLatentVideo или WanImageToVideo; ModelSamplingSD3; один KSampler.

## Настройки, которые работают
832×480 (480p) или 1280×720 (720p); 81 кадр при 16 fps; около 20 до 30 шагов; cfg около 5 до 6 в официальных шаблонах (с LoRA-ускорителями ниже: 4 до 8 шагов, cfg 1); shift около 5 до 8. Промпт: подробные предложения на английском или китайском.

## Что подходит
LoRA для Wan 2.1 и того же размера: 1.3B и 14B не взаимозаменяемы. Многие LoRA для 14B работают и на Wan 2.2 14B.

## Как помогает приложение
Показывается как **Wan 2.1** на карточках моделей. Уроки InfiniteTalk, FantasyTalking, UniAnimate и ReCamMaster работают на моделях Wan 2.1.

## См. также
- [Wan 2.2](Family-Wan22.ru.md)
- [Генерация видео](Video-Models.ru.md)
- [Говорящие портреты](Talking-Portraits.ru.md)
- [Длина видео и частота кадров](Video-Length-And-Frame-Rate.ru.md)
