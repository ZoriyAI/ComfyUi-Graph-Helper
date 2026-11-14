[English](Data-Types.md)
[Главная](../Home.ru.md) › [Понятия ComfyUI](README.ru.md)

# Типы данных

MODEL, CLIP, VAE, LATENT, IMAGE, CONDITIONING и другие виды данных, которые несёт связь.

## Простыми словами
Каждая связь несёт данные одного вида, это её **тип**. Тип решает, какой вход её примет. Здесь перечислены типы, которые новичок встречает у встроенных нод. Паки добавляют свои.

## Частые типы

| Тип | Что несёт | Откуда | Куда |
|---|---|---|---|
| `MODEL` | Диффузионная модель, та часть, что убирает шум и рисует | Load Checkpoint, Load Diffusion Model, загрузчики LoRA, ноды настройки модели | Сэмплеры, загрузчики LoRA, ноды ModelSampling |
| `CLIP` | Текстовый энкодер, часть, которая читает промпт | Load Checkpoint, Load CLIP, DualCLIPLoader, Load LoRA | CLIP Text Encode и другие текстовые ноды |
| `VAE` | Модель, которая переводит пиксели в латент и обратно | Load Checkpoint, Load VAE | VAE Decode, VAE Encode, ноды инпейнтинга и начала видео |
| `CONDITIONING` | Закодированный промпт и подсказки к нему (ControlNet, область, guidance) | Текстовые ноды, ControlNet, ноды guidance и объединения | Входы `positive` и `negative` сэмплера |
| `LATENT` | Картинка или видео в сжатом виде | Ноды пустого латента, VAE Encode, сэмплеры | Сэмплеры, увеличение латента, VAE Decode |
| `IMAGE` | Обычные картинки в пикселях, всегда пачкой (одна или больше) | Load Image, VAE Decode, ноды картинок | Save Image, Preview Image, VAE Encode, апскейлеры, ControlNet |
| `MASK` | Чёрно-белая карта того, что менять | Load Image, ноды масок, редактор масок | Ноды инпейнтинга, SetLatentNoiseMask |
| `CONTROL_NET` | Загруженная модель ControlNet | Load ControlNet Model | Apply ControlNet |
| `UPSCALE_MODEL` | Загруженная модель увеличения | Load Upscale Model | Upscale Image (using Model) |
| `CLIP_VISION`, `CLIP_VISION_OUTPUT` | Кодировщик картинок и одна картинка, закодированная им | Load CLIP Vision, CLIP Vision Encode | Ноды стиля, unCLIP и видео из картинки |
| `SIGMAS`, `SAMPLER`, `GUIDER`, `NOISE` | Части сборного сэмплера: расписание шума, алгоритм, guidance, начальный шум | BasicScheduler, KSamplerSelect, CFGGuider или BasicGuider, RandomNoise | SamplerCustom, SamplerCustomAdvanced |
| `VIDEO`, `AUDIO` | Готовый ролик, звук | Create Video, Load Video, Load Audio | Save Video, Get Video Components, ноды звука |
| `INT`, `FLOAT`, `STRING`, `BOOLEAN`, `COMBO` | Значения полей: целое, дробное, текст, да или нет, выбор из списка | Primitive и ноды вычислений | Любое поле этого типа, ставшее входом |

## Частые ошибки
- Пытаться сохранить `LATENT`: сначала раскройте его через VAE Decode.
- Подать `CONDITIONING` для `negative` в `positive`: сэмплер уйдёт от того, что вы просили.
- Ждать, что тип пака подойдёт ко встроенному входу: `WANVIDEOMODEL` это не `MODEL`.

## Как помогает приложение
Выделите связь на холсте, и вкладка **Объяснение** опишет её тип простыми словами. **Проверка** назовёт каждую связь, у которой типы не совпадают.

## См. также
- [Ноды, входы, выходы и связи](Nodes-And-Links.ru.md)
- [Латент](Latent.ru.md)
- [VAE](VAE.ru.md)
- [Conditioning](Conditioning.ru.md)
- [Справочник нод](../interface/Node-Card.ru.md)
