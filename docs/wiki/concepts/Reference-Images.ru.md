[English](Reference-Images.md)
[Главная](../Home.ru.md) › [Понятия ComfyUI](README.ru.md)

# Картинки-образцы: IP-Adapter, Redux, модели правки

Картинка как пример стиля, героя или лица, а не как начало.

## Простыми словами
В [картинке из картинки](Image-To-Image.ru.md) картинка это начало, которое перерисовывают. С **картинкой-образцом** (reference image) картинка это *подсказка*: «герой, похожий на этого», «в этом стиле», «этот товар на новом фоне». Модель кодирует образец и даёт ему вести результат, а композиция может быть совсем новой.

## Какие бывают способы
| Способ | Семейства | Как входит в граф |
|---|---|---|
| **IP-Adapter** | SD 1.5, SDXL (и другие через паки) | Пак (например ComfyUI_IPAdapter_plus) с моделью IP-Adapter и кодировщиком CLIP Vision; применяется к `MODEL` с весом |
| **Flux Redux** | Flux.1 dev | Встроенные ноды: Load CLIP Vision, CLIP Vision Encode, Load Style Model, Apply Style Model на conditioning |
| **Модели правки** | Qwen-Image-Edit, FLUX.1 Kontext, Flux.2 | Образец входит в conditioning (например ReferenceLatent или TextEncodeQwenImageEdit), а указание говорит, что поменять |
| **CLIP Vision для видео** | Wan 2.1 «картинка в видео», Wan Animate, говорящие портреты | Load CLIP Vision (`clip_vision_h`) и нода кодирования дают модели вид начальной картинки |
| **Образец VACE** | Wan с VACE | Вход `ref_images` держит внешность весь ролик |

## Значения и что они меняют
- Вес или сила образца: слишком много копирует образец, слишком мало его не замечает. Начинайте около значения шаблона.
- Чистый образец (один предмет, ровный фон) работает лучше всего.
- Промпт по-прежнему важен: скажите, что должно поменяться.

## Частые ошибки
- Модель CLIP Vision или IP-Adapter для другого семейства.
- Лицо реального человека без согласия: см. [Правила содержания](../trust/Content-Rules.ru.md).
- Ждать, что модель правки заработает в обычном графе картинки из текста: берите её шаблон.

## Как помогает приложение
Встроенные знания описывают Load CLIP Vision и CLIP Vision Encode, а их статья «Облик: адаптер, LoRA или замена: что выбрать» сравнивает способы удержать лицо. Уроки: [Картинка-образец через IP-Adapter](../lessons/IP-Adapter.ru.md), [Картинка-образец для стиля (Flux Redux)](../lessons/Style-Reference.ru.md), [Правка картинки словами](../lessons/Edit-By-Words.ru.md), [Тот же персонаж на новой картинке: FLUX.1 Kontext](../lessons/Character-Kontext.ru.md), [Один персонаж на многих картинках](../lessons/Character-Series.ru.md), [То же лицо по одному фото: IP-Adapter FaceID](../lessons/Face-From-Photo.ru.md), [Перенести лицо на картинку: ReActor](../lessons/Face-Swap.ru.md), а для видео [Образец на весь ролик: Wan VACE](../lessons/Anchor-Reference.ru.md). Уроки, где берут лицо реального человека, требуют его согласия.

## См. также
- [Картинка из картинки](Image-To-Image.ru.md)
- [ControlNet и препроцессоры](ControlNet.ru.md)
- [Qwen-Image](Family-Qwen-Image.ru.md)
- [Flux.2](Family-Flux2.ru.md)
