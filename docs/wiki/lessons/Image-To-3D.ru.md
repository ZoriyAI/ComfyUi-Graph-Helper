[English](Image-To-3D.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Картинка в 3D-модель: Hunyuan3D 2

<!-- lesson: 3d-image -->
Урок «3d-image» в группе **3D** списка уроков. Шагов: 13.

## Чему вы научитесь
Вы соберёте граф, который превращает одну картинку предмета в 3D-модель, которую можно открыть в других программах.

## Что понадобится
- Урок продолжает [Первая картинка из текста](Image.ru.md). Карточка говорит об этом; это подсказка, а не замок.
- Файлы моделей, которые урок проверяет:
  - для поля `ckpt_name` ноды **Image Only Checkpoint Loader (img2vid model)**: файл, в имени которого есть `hunyuan3d`.
- Ноды: Image Only Checkpoint Loader (img2vid model), ModelSamplingAuraFlow, Load Image, CLIP Vision Encode, Hunyuan3Dv2Conditioning, Empty Hunyuan 3D v2 Latent, KSampler, Hunyuan 3D VAE Decode, Voxel to Mesh, Save 3D Model.
- Приложение ничего не скачивает и не устанавливает. Тексты шагов ниже говорят, какие файлы, в какие папки и какой шаблон ComfyUI их называет.

## Шаги
Слова каждого шага, как их показывает урок. Имена нод выделены.

1. **Что получится** (чтение)

   Hunyuan3D 2 смотрит на одну картинку предмета и строит его форму в 3D. Результат: сетка, поверхность из множества маленьких треугольников, без цвета: белая модель.

   Лучше всего подходит картинка, где один предмет виден целиком, на ровном фоне, чуть сверху и сбоку.

   Урок собирает граф с пустого холста: «Файл ▸ Новый проект».

2. **Загрузите модель**

   Добавьте ноду **Image Only Checkpoint Loader (img2vid model)**. В `ckpt_name` выберите `hunyuan3d-dit-v2_fp16.safetensors` (версия 2.0) или `hunyuan_3d_v2.1.safetensors` (версия 2.1) из models/checkpoints.

   Этот загрузчик берёт модель, которая читает картинки, а не текст: его выходы: модель, чтение картинки `CLIP_VISION` и декодер.

   Если нужного файла в списке нет, значит, его нет в вашем ComfyUI. Приложение ничего не скачивает. Проще всего открыть в самом ComfyUI шаблон «HY 3D 2.0» или «HY 3D 2.1: Single View to Model»: он покажет, каких файлов не хватает и куда их положить. Потом выберите здесь в меню «Синхронизация ▸ Синхронизировать сейчас», и файлы появятся в списках.

3. **Задайте сдвиг шума**

   Добавьте ноду **ModelSamplingAuraFlow**, соедините выход `MODEL` ноды **Image Only Checkpoint Loader (img2vid model)** с её входом `model` и поставьте `shift` равным 1.

   Оба шаблона ставят 1. Модель обучена под это значение.

4. **Загрузите картинку**

   Добавьте ноду **Load Image** и выберите картинку в её поле `image`.

   Фон с другими предметами станет частью модели. Если можете, уберите его заранее.

5. **Дайте модели увидеть картинку**

   Добавьте ноду **CLIP Vision Encode**. Соедините выход `CLIP_VISION` ноды **Image Only Checkpoint Loader (img2vid model)** с её входом `clip_vision`, а картинку от **Load Image** с её входом `image`. Поставьте `crop` в `center`.

   Эта нода превращает картинку в описание, которому модель может следовать.

6. **Превратите его в условие**

   Добавьте ноду **Hunyuan3Dv2Conditioning** и соедините выход **CLIP Vision Encode** с её входом `clip_vision_output`.

   Она даёт два выхода, `positive` и `negative`, готовые для сэмплера. Руками здесь ничего не пишут: картинка и есть всё описание.

7. **Добавьте заготовку**

   Добавьте ноду **Empty Hunyuan 3D v2 Latent** и поставьте `resolution` равным 3072.

   Это то, насколько тонко прорабатывается форма. Версия 2.0 берёт 3072, версия 2.1 берёт 4096.

8. **Добавьте сэмплер**

   Добавьте ноду **KSampler** и подключите четыре входа:
   - `model` от **ModelSamplingAuraFlow**;
   - `positive` и `negative` от одноимённых выходов **Hunyuan3Dv2Conditioning**;
   - `latent_image` от **Empty Hunyuan 3D v2 Latent**.

   Поставьте `steps` равным 20 и `cfg` равным 8, как в шаблоне версии 2.0. Для версии 2.1 шаблон берёт 30 и 5.

9. **Превратите результат в объём**

   Добавьте ноду **Hunyuan 3D VAE Decode**. Соедините выход **KSampler** с её входом `samples`, а выход `VAE` ноды **Image Only Checkpoint Loader (img2vid model)** с её входом `vae`.

   Получится воксельная сетка: пространство, разрезанное на маленькие кубики, каждый внутри предмета или снаружи.

10. **Превратите объём в сетку**

   Добавьте ноду **Voxel to Mesh** и соедините выход **Hunyuan 3D VAE Decode** с её входом `voxel`. Поставьте `algorithm` в `surface net`, а `threshold` равным 0.6.

   `surface net` даёт поверхность глаже, чем `basic`. Порог говорит, где кончается «внутри»: ниже делает предмет толще, выше тоньше и с дырами.

11. **Сохраните модель**

   Добавьте ноду **Save 3D Model** и соедините выход **Voxel to Mesh** с её входом `mesh`.

12. **Куда попадёт файл и чем его открыть** (чтение)

   В ComfyUI нода записывает файл .glb в папку output/3d и показывает модель на холсте.

   Файл .glb открывается в Blender (File ▸ Import ▸ glTF), в большинстве 3D-просмотрщиков и игровых движков и в браузере через любой просмотрщик glTF. Цвета у модели пока нет: его рисуют в другой программе или графом для текстур.

   Пак ComfyUI-3D-Pack и ноды TRELLIS.2 самого ComfyUI строят модели и с цветом, но их графы намного больше.

13. **Граф готов** (чтение)

   Сохраните граф через «Файл ▸ Сохранить workflow для ComfyUI…», откройте файл в ComfyUI и запустите там. Само приложение в ComfyUI ничего не запускает.

   Если у модели дыры или бугры: больше всего помогает чистая картинка, потом больший `resolution`.

## Что проверяет урок
Шаг для чтения сделан, когда вы нажимаете **Понятно, дальше**. Шаг с делом отмечается сам, когда на холсте есть:

- Шаг 2, **Загрузите модель**:
  - нода **Image Only Checkpoint Loader (img2vid model)**.
  - в поле `ckpt_name` ноды **Image Only Checkpoint Loader (img2vid model)** стоит файл, в имени которого есть `hunyuan3d` (заглавные буквы, точки и дефисы не важны).
- Шаг 3, **Задайте сдвиг шума**:
  - нода **ModelSamplingAuraFlow**.
  - `MODEL` ноды **Image Only Checkpoint Loader (img2vid model)** во вход `model` ноды **ModelSamplingAuraFlow**.
  - `shift` ноды **ModelSamplingAuraFlow**: `1`.
- Шаг 4, **Загрузите картинку**:
  - нода **Load Image**.
  - `image` ноды **Load Image**: значение выбрано.
- Шаг 5, **Дайте модели увидеть картинку**:
  - нода **CLIP Vision Encode**.
  - `CLIP_VISION` ноды **Image Only Checkpoint Loader (img2vid model)** во вход `clip_vision` ноды **CLIP Vision Encode**.
  - `IMAGE` ноды **Load Image** во вход `image` ноды **CLIP Vision Encode**.
  - `crop` ноды **CLIP Vision Encode**: `center`.
- Шаг 6, **Превратите его в условие**:
  - нода **Hunyuan3Dv2Conditioning**.
  - `CLIP_VISION_OUTPUT` ноды **CLIP Vision Encode** во вход `clip_vision_output` ноды **Hunyuan3Dv2Conditioning**.
- Шаг 7, **Добавьте заготовку**:
  - нода **Empty Hunyuan 3D v2 Latent**.
  - `resolution` ноды **Empty Hunyuan 3D v2 Latent**: от 3072 до 4096; «Сделать за меня» ставит 3072.
- Шаг 8, **Добавьте сэмплер**:
  - нода **KSampler**.
  - `MODEL` ноды **ModelSamplingAuraFlow** во вход `model` ноды **KSampler**.
  - `positive` ноды **Hunyuan3Dv2Conditioning** во вход `positive` ноды **KSampler**.
  - `negative` ноды **Hunyuan3Dv2Conditioning** во вход `negative` ноды **KSampler**.
  - `LATENT` ноды **Empty Hunyuan 3D v2 Latent** во вход `latent_image` ноды **KSampler**.
  - `steps` ноды **KSampler**: от 20 до 30; «Сделать за меня» ставит 20.
  - `cfg` ноды **KSampler**: от 5 до 8; «Сделать за меня» ставит 8.
- Шаг 9, **Превратите результат в объём**:
  - нода **Hunyuan 3D VAE Decode**.
  - `LATENT` ноды **KSampler** во вход `samples` ноды **Hunyuan 3D VAE Decode**.
  - `VAE` ноды **Image Only Checkpoint Loader (img2vid model)** во вход `vae` ноды **Hunyuan 3D VAE Decode**.
- Шаг 10, **Превратите объём в сетку**:
  - нода **Voxel to Mesh**.
  - `VOXEL` ноды **Hunyuan 3D VAE Decode** во вход `voxel` ноды **Voxel to Mesh**.
  - `algorithm` ноды **Voxel to Mesh**: `surface net`.
  - `threshold` ноды **Voxel to Mesh**: от 0.5 до 0.7; «Сделать за меня» ставит 0.6.
- Шаг 11, **Сохраните модель**:
  - нода **Save 3D Model**.
  - `MESH` ноды **Voxel to Mesh** во вход `mesh` ноды **Save 3D Model**.

## См. также
- [Где лежат файлы ComfyUI](../concepts/Where-Files-Live.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
