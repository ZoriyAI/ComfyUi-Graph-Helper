[English](README.md)
[Главная](../Home.ru.md) › Уроки

# Уроки

Встроенные уроки режима «Учиться», по странице на каждый, и путь через них.

## Что такое режим «Учиться»
В режиме «Учиться» вы сами собираете настоящие графы на холсте, а приложение ведёт по шагам: что сделать, зачем и где это на холсте. Оно по холсту видит, что шаг сделан. Модель помощника не нужна. Уроки берут только те ноды, что есть в вашем ComfyUI, и никогда не скачивают файлы моделей: их вы кладёте в ComfyUI сами. Как всё устроено: [Как устроены уроки](How-Lessons-Work.ru.md).

## Путь обучения
<!-- diagram: четыре ряда блоков со стрелками. Картинки: image → prompt → refine. Видео: video-text → prompt-video → video-image → lora → video-fast → two-models. Пак WanVideoWrapper: wrapper → wrapper-image → wrapper-vace; wrapper-animate, wrapper-unianimate; wrapper-talk → wrapper-duo; wrapper-fantasy; wrapper-ovi; wrapper-recam. Для взрослых (отдельная группа): adult-image, adult -->

**Картинки, основа.** Начинайте отсюда.
- [Первая картинка из текста](Image.ru.md): Урок «image». Семь нод от промпта до сохранённой картинки.
- [Описание: как модель его читает](Prompt.ru.md): Урок «prompt». Теги или предложения, веса, негативный промпт, cfg, seed.
- [Доводка второй моделью](Refine.ru.md): Урок «refine». Вторая модель перерисовывает картинку с частичным denoise.

**Видео на встроенных нодах (Wan 2.2).**
- [Видео из текста](Video-Text.ru.md): Урок «video-text». Двухпроходный граф Wan 2.2.
- [Описание для видео](Prompt-Video.ru.md): Урок «prompt-video». Действие, камера, одно движение на ролик.
- [Видео из картинки](Video-Image.ru.md): Урок «video-image». Картинка становится первым кадром.
- [LoRA: добавить стиль или тему](LoRA.ru.md): Урок «lora». LoRA в путях обеих моделей, слова-триггеры.
- [Быстрое видео за четыре шага](Video-Fast.ru.md): Урок «video-fast». LoRA-ускорители, 4 шага, cfg 1.
- [Две модели в одном графе](Two-Models.ru.md): Урок «two-models». Модель картинок рисует первый кадр.

**Видео на паке WanVideoWrapper.** Пак должен быть установлен в ComfyUI.
- [Видео на WanVideoWrapper](Wrapper.ru.md): Урок «wrapper». Тот же ролик на нодах пака.
- [Видео из картинки на WanVideoWrapper](Wrapper-Image.ru.md): Урок «wrapper-image».
- [VACE: движение из другого видео](Wrapper-VACE.ru.md): Урок «wrapper-vace».
- [Анимация по позе: Wan Animate](Wrapper-Animate.ru.md): Урок «wrapper-animate». Нужно согласие.
- [Анимация по позе: UniAnimate](Wrapper-UniAnimate.ru.md): Урок «wrapper-unianimate». Нужно согласие.
- [Говорящее видео: InfiniteTalk](Wrapper-Talk.ru.md): Урок «wrapper-talk». Нужно согласие.
- [Разговор двоих: InfiniteTalk](Wrapper-Duo.ru.md): Урок «wrapper-duo». Нужно согласие.
- [Говорящий портрет: FantasyTalking](Wrapper-Fantasy.ru.md): Урок «wrapper-fantasy». Нужно согласие.
- [Видео со звуком: Ovi](Wrapper-Ovi.ru.md): Урок «wrapper-ovi». Картинка и звук за один запуск.
- [Другая камера: ReCamMaster](Wrapper-ReCam.ru.md): Урок «wrapper-recam».

**Для взрослых.** Отдельная группа; только техника и границы. См. [Правила содержания](../trust/Content-Rules.ru.md).
- [Картинки для взрослых: что меняется](Adult-Image.ru.md): Урок «adult-image».
- [Видео для взрослых: что меняется](Adult.ru.md): Урок «adult».

**Об уроках**
- [Как устроены уроки](How-Lessons-Work.ru.md): Выбор, шаги, «Показать, где это», «Сделать за меня».

Приложение показывает уроки в своём порядке (картинки, встроенное видео, пак, две модели, для взрослых); путь выше собирает те же уроки по темам. Мысли, на которых стоит каждый шаг, ищите в разделе [Понятия ComfyUI](../concepts/README.ru.md), начиная со страницы [С чего начать](../concepts/Start-Here.ru.md).

## См. также
- [Главная](../Home.ru.md)
- [Режим «Учиться»](../assistant/Learn.ru.md)
- [Панель уроков](../interface/Lessons-Panel.ru.md)
