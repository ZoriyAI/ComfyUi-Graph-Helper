[English](Lesson-File-Format.md)
[Главная](../Home.ru.md) › [Уроки](README.ru.md)

# Формат файла урока

Файл урока хранит один урок или целую группу уроков. Приложение пишет его при экспорте и читает при импорте (см.
[Мои уроки](My-Lessons.ru.md)). Это JSON, имя кончается на `.lesson.json`, и внутри только данные: ничего из файла не
запускается, не вычисляется и не открывается.

## Пример
Комментарии после `//` здесь для чтения; в настоящем файле их нет. Приложение читает этот файл как есть.

```jsonc
{
  "format": "nodewise-studio/lessons",   // что это за файл; с другим значением это не файл урока
  "version": 1,                          // версия формата; более новая отклоняется с сообщением
  "lessons": [                           // один урок или больше (не больше 200)
    {
      "id": "sdxl-size",                 // строчные латинские буквы, цифры и дефисы; в приложении станет my:sdxl-size
      "author": "Ваше имя",              // показывается как текст
      "source": "Сделан в редакторе уроков", // показывается как текст, никогда не открывается
      "continues": ["image"],            // уроки, с графа которых он начинается: подсказка, а не замок
      "needs": { "packs": [], "classes": ["CheckpointLoaderSimple", "EmptyLatentImage"] },
      "texts": {                         // слова на "en", "ru" или на обоих
        "ru": {
          "title": "Размер картинки SDXL",
          "result": "Поставите заготовке размер, на котором учили SDXL.",
          "steps": {                     // слова каждого шага, по id шага
            "intro": { "title": "Почему размер важен", "body": "SDXL учили около одного мегапикселя." },
            "model": { "title": "Загрузите модель", "body": "Добавьте {checkpoint} и выберите файл в `ckpt_name`." },
            "size": { "title": "Поставьте размер", "body": "В ноде {latent} поставьте `width` 1024." }
          }
        }
      },
      "steps": [                         // что должно быть на холсте после каждого шага
        { "id": "intro", "read": true }, // шаг, который только объясняет
        {
          "id": "model",
          "roles": [{ "role": "checkpoint", "classes": ["CheckpointLoaderSimple"] }],
          "fields": [{ "role": "checkpoint", "field": "ckpt_name", "test": { "kind": "chosen" } }]
        },
        {
          "id": "size",
          "roles": [{ "role": "latent", "classes": ["EmptyLatentImage"] }],
          "fields": [{
            "role": "latent", "field": "width",
            "test": { "kind": "between", "min": 640, "max": 1536, "prefer": 1024 }, // «Сделать за меня» ставит 1024
            "why": "im.sdxlSize"         // причина, которую написало приложение; своих фраз файл принести не может
          }]
        }
      ]
    }
  ]
}
```

## Части урока
- `id`: собственный id урока. В приложении ваш урок получает id `my:` и этот id, поэтому он никогда не заменяет
  встроенный урок.
- `group`: id и название на каждом языке, если урок входит в группу.
- `follows`: уроки, на идеи которых он опирается. `continues`: уроки, с графа которых он начинается. Это подсказки в
  списке, а не замки.
- `adult`: `true` закрывает урок переключателем **Содержимое для взрослых (18+)**.
- `author` и `source`: показываются простым текстом.
- `needs`: паки нод и классы, их называет карточка. Классы приложение само сверяет с вашим ComfyUI.
- `texts`: слова на `en`, `ru` или на обоих. В каждом `title`, `result` и слова каждого шага: `title` и `body`. В
  тексте шага `{role}` превращается в имя этой ноды жирным.
  Там же может быть `roles`: короткая подпись роли по её имени, например `"first": "первый кадр"`. Подпись
  стоит рядом с именем ноды в «Осталось сделать», чтобы две одинаковые ноды не путались.
- `steps`: что просит каждый шаг.

## Что просит шаг
Шаг либо только объясняет (`"read": true`), либо просит что-то на холсте, но не то и другое сразу.
- `roles`: ноды, которые добавляет шаг. Роль это имя, которое урок даёт ноде (`sampler`, `positive`); её занимает
  нода любого из классов `classes`. Роль добавляется один раз, в одном шаге.
- `links`: связь от выхода одной роли ко входу другой: `from`, `output`, `to`, `input`. `via` перечисляет классы,
  которые могут стоять между ними, например загрузчик LoRA. `alt` перечисляет другие связи, которые делают то же.
- `fields`: значения. У каждого есть `role`, `field` и `test`, а ещё может быть `why` (id причины, которую написало
  приложение), `soft` (совет, который не держит шаг) и `identifies`.

Проверки:

| `kind` | Что просит |
|---|---|
| `chosen` | что-то выбрано или написано |
| `equals` | ровно это значение `value` |
| `between` | число от `min` до `max`; `prefer` это число из текста, его ставит **Сделать за меня**; `frames` требует 4n + 1 |
| `text` | не меньше `minChars` знаков; по желанию `words`, `has`, `english`, `notCopyOf`, `noNegation` |
| `weighted` | вес вида `(red coat:1.2)` от `min` до `max`, не 1 |
| `file` | файл модели того вида, который знает приложение, или описанный словами, которые должны быть в имени |
| `sameFamily` | файл, сделанный для семейства файла из другого поля |
| `same`, `differs`, `less` | равно другому полю, не тот же файл, меньше другого поля |
| `size` | около размера, на котором учили модель из другого поля |
| `aspect` | пропорции другой ноды |
| `has-trigger` | слова-триггеры LoRA, выбранной в названных полях |

## Версия 2: шаги, на которые отвечает человек, исходы и шаблон
Версия 2 формата добавляет то, что может быть в уроке версии 1.1 приложения. Файл, в котором ничего из этого нет,
по-прежнему пишется как версия 1, и его откроет версия 1.0 приложения; это приложение читает обе.

Вместо шага-чтения или шага на холсте шаг может быть одним из этих (никогда двумя сразу):
- `checklist`: пункты `{ "id", "optional"?, "check"?, "run"? }`. Их слова лежат в
  `texts.<язык>.steps.<шаг>.items`: `{ "label", "how"? }`. `check` это условие, которое приложение проверяет само (ниже);
  `run: true` отмечает пункт, который означает, что workflow запущен в ComfyUI.
- `rubric`: критерии `{ "id", "levels", "pass"? }`, от двух до четырёх уровней от низкого к высокому; `pass` это самый
  низкий уровень, с которым можно идти дальше. Слова в `criteria`: `{ "title", "levels": { "<уровень>": "…" },
  "tryNext"? }`.
- `quiz`: от одного до пяти вопросов `{ "id", "choices", "answer" }`. Слова в `questions`: `{ "text", "choices": { … },
  "explain" }`.
- `readCheck`: от одного до шести условий, которые приложение проверяет по тому, что уже читает, и никогда ничего не
  запуская: `comfy-read`, `node-class` (`classes`), `model-file` (`folder`, `words`?), `workflow-complete`,
  `workflow-size` (`min`?, `max`?), `workflow-from` (`from`: `picture` или `api`), `workflow-partner` (`present`).
- `transfer: true` у шага на холсте или списка дел: задача без готового ответа и без **Сделать за меня**.

Урок может ещё сказать:
- `outcomes`: какими из `structure`, `run` и `result` он заканчивается. Для `structure` нужен шаг на холсте, для `run`
  пункт с `run: true`, для `result` рубрика. Без этого у урока только `structure`.
- `level` (от 0 до 5), `tracks` (`base`, `image`, `video`, `audio-3d`, `lora`, `api`, `nodes`, `projects`) и `priority`
  (`core`, `pro`, `deep`).
- `standard`: `2` у урока нового стандарта. У него должны быть `meta` с `versions` и `checkedOn` (ГГГГ-ММ-ДД),
  вопросы, самостоятельная задача и на каждом языке слова `meta`: `skill`, `requires` (или `meta.prerequisites`), не
  меньше трёх `mistakes` (`sign` и `fix`), `provenance` и `notChecked`.
- `meta`: `prerequisites` (id уроков), `versions` (текст) и `checkedOn`.

Небольшой полный пример (этот самый файл открывается в приложении):

```json
{
  "format": "nodewise-studio/lessons",
  "version": 2,
  "lessons": [
    {
      "id": "first-run-check",
      "outcomes": ["run", "result"],
      "level": 1,
      "tracks": ["base"],
      "texts": {
        "en": {
          "title": "Did my first picture work?",
          "result": "A first run in ComfyUI, checked and assessed.",
          "steps": {
            "intro": { "title": "What this is", "body": "You run the first picture in ComfyUI and look at it." },
            "run": {
              "title": "Run it",
              "body": "Open the workflow in ComfyUI and press Run.",
              "items": {
                "read": { "label": "The app has read my ComfyUI." },
                "ran": { "label": "I ran it, and a picture appeared.", "how": "A new file in the output folder." }
              }
            },
            "look": {
              "title": "Look at it",
              "body": "The app does not see the picture: this is your own assessment.",
              "criteria": {
                "subject": { "title": "The subject matches the prompt.", "levels": { "no": "No", "partly": "Partly", "yes": "Yes" }, "tryNext": "Put the subject first in the prompt." }
              }
            },
            "recall": {
              "title": "Check yourself",
              "body": "One question.",
              "questions": {
                "seed": { "text": "What gives the same picture again?", "choices": { "seed": "The same seed and settings", "luck": "Luck" }, "explain": "The seed decides the noise a picture starts from." }
              }
            },
            "own": {
              "title": "On your own",
              "body": "Try it without help.",
              "items": { "other": { "label": "I made a second picture with another seed and compared the two." } }
            }
          }
        }
      },
      "steps": [
        { "id": "intro", "read": true },
        { "id": "run", "checklist": [{ "id": "read", "check": { "kind": "comfy-read" } }, { "id": "ran", "run": true }] },
        { "id": "look", "rubric": [{ "id": "subject", "levels": ["no", "partly", "yes"] }] },
        { "id": "recall", "quiz": [{ "id": "seed", "choices": ["seed", "luck"], "answer": "seed" }] },
        { "id": "own", "transfer": true, "checklist": [{ "id": "other" }] }
      ]
    }
  ]
}
```

## Что приложение проверяет, прежде чем сохранить файл
- Размер (около 2 МБ самое большее), глубину вложенности, что это JSON, `format` и `version`.
- Каждый текст и список по его пределу; никаких управляющих символов и скрытых знаков направления текста.
- Незнакомые ключи отклоняются, поэтому файл от более новой версии так и говорит, а не читается наполовину.
- Части сходятся: ни урок, ни шаг не повторяются, роль добавлена раньше, чем шаг её называет, у каждого шага есть
  слова на каждом языке урока, диапазон не пуст, хотя бы один шаг что-то просит.
- Те же правила уроков, которым подчиняются встроенные уроки.
- Только виды файлов моделей и причины, которые знает приложение.
- Что урок можно пройти с пустого холста.

Если проверка не прошла, сообщение называет урок и шаг простыми словами, например «В уроке «…» шаг «…» говорит о ноде
«…», которую не добавляет ни один шаг до него.»

## См. также
- [Мои уроки](My-Lessons.ru.md)
- [Как устроены уроки](How-Lessons-Work.ru.md)
- [Как написать урок](../dev/Writing-A-Lesson.ru.md)
