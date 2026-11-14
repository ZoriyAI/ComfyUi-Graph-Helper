[English](Text-To-Image.md)
[Главная](../Home.ru.md) › [Понятия ComfyUI](README.ru.md)

# Картинка из текста

Основной граф: на входе промпт, на выходе картинка. Семь нод.

## Простыми словами
Картинка из текста (text to image) начинается с пустого латента, полного шума, и модель шаг за шагом убирает шум, следуя вашему промпту. Любой другой граф это вариант этого.

<!-- diagram: Load Checkpoint (MODEL, CLIP, VAE) → CLIP Text Encode положительный и негативный → KSampler ← Empty Latent Image; KSampler → VAE Decode (VAE от чекпойнта) → Save Image -->

## Граф
1. **Load Checkpoint**: модель. Выходы `MODEL`, `CLIP`, `VAE`.
2. **CLIP Text Encode (Prompt)** дважды: промпт и негативный промпт, оба от `CLIP`.
3. **Empty Latent Image**: заготовка с `width`, `height`, `batch_size`.
4. **KSampler**: на входах `model`, `positive`, `negative`, `latent_image`; поля `steps`, `cfg`, `seed`, `sampler_name`, `scheduler`, `denoise` 1.0.
5. **VAE Decode**: на входах `LATENT` сэмплера и `VAE` чекпойнта, на выходе `IMAGE`.
6. **Save Image**: картинка уходит в папку `output`.

У семейств с [отдельными загрузчиками](Separate-Loaders.ru.md) шаг 1 становится тремя нодами (Load Diffusion Model, Load CLIP или DualCLIPLoader, Load VAE), в шаге 3 берётся нода пустого латента этого семейства, а у Flux dev добавляется FluxGuidance. Форма графа та же.

## С каких значений начать
SD 1.5: 512×512, 25 шагов, cfg 7, `euler` или `dpmpp_2m` с `karras`. SDXL: 1024×1024, 25 шагов, cfg 6. Flux dev: 1024×1024, 20 шагов, cfg 1 и guidance 3.5. Остальное на странице [Семейства моделей](Model-Families.ru.md).

## Частые ошибки
- Перепутаны positive и negative; нет Save Image; размер далёк от размера семейства; `denoise` меньше 1.

## Как помогает приложение
Урок [Первая картинка из текста](../lessons/Image.ru.md) собирает с вами ровно этот граф, шаг за шагом, и проверяет каждую связь.

## См. также
- [Картинка из картинки](Image-To-Image.ru.md)
- [Чекпойнт](Checkpoint.ru.md)
- [Сэмплер и имена сэмплеров](Sampler.ru.md)
- [Размер и пропорции](Resolution.ru.md)
- [Урок: Первая картинка из текста](../lessons/Image.ru.md)
