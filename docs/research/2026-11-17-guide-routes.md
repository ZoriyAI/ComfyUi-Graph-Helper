# Fifty guide routes: application qualification

Date: 2026-11-17. All 50 routes were opened in actual isolated Electron. Each showed its own cause, preparation, action, follow-up and expected result. Empty graphs and unavailable synchronization were not called repaired; output quality and runtime questions required a practical trial. Completion stayed disabled before the person acknowledged the result. This is interface and routing evidence, not 50 successful repairs of external installations.

The related-node handoff now carries the definition ID to the canvas and assistant, retains the guide step and clears the old result acknowledgement. A real nested CLIPTextEncode target was selected and its preserved text read; returning to the guide retained valid context. The canvas had incorrectly compared an instance-path key to a definition ID.

57 focused checks cover all configured template searches, each configured evidence field, stale targets and revision-bound acknowledgements. The Electron journey passed in 16.3 seconds. Published source links and scenario-specific instructions remain in `src/shared/guidance/problems.json`; the application reads that same catalogue.

На русском: проверены все 50 экранных маршрутов и переход к внутренней ноде с сохранением контекста для помощника. Пустой граф не признан исправленным; результат генерации требует практической проверки. Это не обещание автоматического ремонта любых сторонних установок.

| ID | Ситуация | Действие → следующий шаг | Проверка результата |
| --- | --- | --- | --- |
| p01 | Открыл workflow, а часть нод красная | `check` → `comfy` | missingNodes, unknownNodeTypes |
| p02 | Пакет установлен, ноды всё равно нет | `error` → `nodes` | Практический запуск/наблюдение по инструкции |
| p03 | После установки дополнения сломалось другое | `comfy` → `error` | Практический запуск/наблюдение по инструкции |
| p04 | После обновления пустой экран или пропали превью | `comfy` → `error` | Практический запуск/наблюдение по инструкции |
| p05 | Обновил ComfyUI, новой функции нет | `comfy` → `sync` | Практический запуск/наблюдение по инструкции |
| p06 | Модель не появляется в списке | `models` → `sync` | missingModels, valuesNotInList |
| p07 | Модели лежат на другом диске и не видны | `comfy` → `sync` | Практический запуск/наблюдение по инструкции |
| p08 | Ошибка mat1/mat2 или числа каналов | `error` → `check` | baseModelMismatches, typeMismatches |
| p09 | VAE Decode падает | `canvas` → `check` | baseModelMismatches, typeMismatches, unconnectedRequiredInputs |
| p10 | Ошибка CLIP или текст не понимается | `templates` → `check` | Практический запуск/наблюдение по инструкции |
| p11 | ControlNet не работает с моей моделью | `canvas` → `check` | baseModelMismatches |
| p12 | LoRA ничего не меняет | `models` → `canvas` | Практический запуск/наблюдение по инструкции |
| p13 | Несколько LoRA портят результат | `canvas` → `models` | Практический запуск/наблюдение по инструкции |
| p14 | Error while deserializing header | `sync` → `models` | Счётчики чтения, ошибок и исключений |
| p15 | Нет описания, хотя модель существует | `models` → `sync` | Практический запуск/наблюдение по инструкции |
| p16 | Синхронизация остановилась, цифры непонятны | `sync` → `connection` | Счётчики чтения, ошибок и исключений |
| p17 | CUDA out of memory | `memory` → `resources` | Практический запуск/наблюдение по инструкции |
| p18 | Генерация очень медленная | `comfy` → `services` | Практический запуск/наблюдение по инструкции |
| p19 | Апскейл съедает всю память | `templates` → `resources` | Практический запуск/наблюдение по инструкции |
| p20 | Несколько моделей в графе не помещаются | `resources` → `memory` | Практический запуск/наблюдение по инструкции |
| p21 | Required input is missing | `check` → `canvas` | unconnectedRequiredInputs, unsetWidgets |
| p22 | Провод не подключается | `check` → `nodes` | typeMismatches, brokenEdges |
| p23 | Меняю число, но ничего не меняется | `canvas` → `check` | Практический запуск/наблюдение по инструкции |
| p24 | Граф зациклен/не проходит проверку | `check` → `canvas` | cycles |
| p25 | Граф есть, результат не сохраняется | `check` → `nodes` | noOutputNode |
| p26 | Слишком много параметров, не знаю с чего начать | `templates` → `check` | Практический запуск/наблюдение по инструкции |
| p27 | Каждый раз получается другая картинка | `canvas` → `export` | Практический запуск/наблюдение по инструкции |
| p28 | Фото меняется до неузнаваемости | `canvas` → `templates` | Практический запуск/наблюдение по инструкции |
| p29 | Фото почти не меняется | `canvas` → `check` | unconnectedRequiredInputs, typeMismatches |
| p30 | IMAGE нельзя подключить к LATENT | `canvas` → `nodes` | typeMismatches, unconnectedRequiredInputs |
| p31 | Редактируется не та область картинки | `templates` → `canvas` | Практический запуск/наблюдение по инструкции |
| p32 | Inpaint не меняет выделенную область | `templates` → `check` | unconnectedRequiredInputs |
| p33 | Не понимаю как расширить края фото | `templates` → `canvas` | Практический запуск/наблюдение по инструкции |
| p34 | Увеличил картинку, детализация не улучшилась | `templates` → `resources` | Практический запуск/наблюдение по инструкции |
| p35 | Чужой workflow просит отсутствующее фото/видео | `canvas` → `check` | Практический запуск/наблюдение по инструкции |
| p36 | Workflow загрузился со связями, но без значений | `import` → `export` | unsetWidgets, invalidParameters |
| p37 | Картинка не восстановила workflow | `import` → `comfy` | Практический запуск/наблюдение по инструкции |
| p38 | Не хочу запускать весь огромный граф | `canvas` → `comfy` | Практический запуск/наблюдение по инструкции |
| p39 | Нода на холсте есть, но не участвует | `canvas` → `check` | Практический запуск/наблюдение по инструкции |
| p40 | Не понимаю что делает нода и что дальше | `canvas` → `nodes` | Практический запуск/наблюдение по инструкции |
| p41 | Как собрать свою ноду из нескольких | `constructor` → `canvas` | Практический запуск/наблюдение по инструкции |
| p42 | Параметр внутри субграфа не виден снаружи | `constructor` → `canvas` | Практический запуск/наблюдение по инструкции |
| p43 | После открытия изменились значения вложенной ноды | `canvas` → `export` | Практический запуск/наблюдение по инструкции |
| p44 | Не могу вернуться из вложенного графа | `canvas` → `constructor` | Практический запуск/наблюдение по инструкции |
| p45 | У ноды список входов растёт, не знаю как соединять | `canvas` → `nodes` | Практический запуск/наблюдение по инструкции |
| p46 | На телефоне нет правой кнопки и удаления | `canvas` → `check` | Практический запуск/наблюдение по инструкции |
| p47 | Панели на телефоне закрывают весь холст | `canvas` → `nodes` | Практический запуск/наблюдение по инструкции |
| p48 | Кнопка фото в субграфе не открывает выбор | `canvas` → `connection` | Практический запуск/наблюдение по инструкции |
| p49 | Хочу промпт по фото, локальная модель не видит фото | `templates` → `check` | Практический запуск/наблюдение по инструкции |
| p50 | Хочу искать похожие тексты, embeddings выдаёт числа | `templates` → `check` | Практический запуск/наблюдение по инструкции |
