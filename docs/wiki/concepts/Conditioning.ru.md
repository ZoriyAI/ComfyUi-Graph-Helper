[English](Conditioning.md)
[Главная](../Home.ru.md) › [Понятия ComfyUI](README.ru.md)

# Conditioning

Закодированный промпт вместе с подсказками к нему, который ведёт сэмплер.

## Простыми словами
**Conditioning** это то, что выходит из текстовой ноды: ваш промпт, превращённый в числа [текстовым энкодером](Text-Encoders.ru.md). Сэмплер не читает текст, он читает conditioning. Другие ноды могут по дороге добавить к нему подсказки: картинку ControlNet, область кадра, картинку-образец, число guidance у Flux, первый кадр видео.

У каждого сэмплера два входа conditioning:
- `positive`: что вы хотите. Модель идёт к этому.
- `negative`: чего вы не хотите. Модель уходит от этого (только когда CFG больше 1, см. [CFG](CFG.ru.md)).

## Где встречается в графе
- **CLIP Text Encode (Prompt)** его делает: на входе `CLIP` и текст, на выходе `CONDITIONING`.
- **Apply ControlNet** берёт positive и negative и отдаёт их обратно с подсказкой ControlNet.
- **FluxGuidance** вписывает в conditioning число guidance для Flux dev.
- **Conditioning (Combine)** смешивает два conditioning, **Conditioning (Concat)** склеивает их в один длинный, **Conditioning (Set Area)** ограничивает один прямоугольником кадра.
- **Ноды начала видео и инпейнтинга** (WanImageToVideo, InpaintModelConditioning) берут positive и negative и отдают их обратно с прикреплённой картинкой. Дальше сэмплер должен брать conditioning с их выходов, а не прямо с текстовых нод.

<!-- diagram: две ноды CLIP Text Encode; их линии CONDITIONING проходят через Apply ControlNet и входят в positive и negative у KSampler -->

## Частые ошибки
- **positive и negative перепутаны**: картинка избегает того, что вы описали.
- **Сэмплер берёт conditioning прямо с текстовых нод** в графе видео из картинки: картинка до модели не доходит, ролик рисуется из ничего.
- **Conditioning от энкодера одной модели идёт в сэмплер другой**: второй модели он ничего не говорит.
- **Пустой положительный промпт**: модель рисует что попало.

## Как помогает приложение
Выделите связь `CONDITIONING`, и вкладка **Объяснение** скажет, откуда она идёт и куда должна идти. **Проверка** предупреждает о пустом промпте и о негативном промпте, который при cfg 1 ничего не делает.

## См. также
- [Промпт](Prompt.ru.md)
- [Негативный промпт](Negative-Prompt.ru.md)
- [CFG и guidance](CFG.ru.md)
- [ControlNet](ControlNet.ru.md)
- [Текстовые энкодеры](Text-Encoders.ru.md)
