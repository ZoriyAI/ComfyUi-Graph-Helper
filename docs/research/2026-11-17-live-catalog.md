# Live catalog qualification — 17 November 2026

An isolated Electron profile read an existing ComfyUI 0.45.3 installation with frontend 1.58.5. The owner's profile, models, workflows and services were not changed. No generation was submitted.

| Scenario | Result |
| --- | --- |
| Direct catalog and metadata reading | 3375 node classes, 70 packs and 797 model files; 797 read, 0 pending, 0 failed, 0 excluded, about 41 seconds |
| Saved MCP address requires sign-in | Direct ComfyUI fallback succeeded in about 3 seconds; the report retained the sign-in warning |
| Saved MCP address unreachable | Direct ComfyUI fallback succeeded in about 3 seconds; the report retained the connection warning |

All three final states were idle, the catalog source was ComfyUI, and the library was marked current. Electron reported no page errors. The second and third reads reused previously read, unchanged model headers. Of 797 files, 524 carried metadata; an empty header is a successful read, not a failure. These are counts from this dated installation, not promised inventory sizes for other installations.

Before the fix, a failing MCP connection prevented synchronization even while the saved ComfyUI address remained reachable. The fix uses the independent saved address and exposes the MCP reason. It does not forward MCP credentials or claim that MCP authentication succeeded. Authenticated reading through this particular real MCP server was not qualified; bounded reconnect, cancellation, address changes and per-file failures remain covered by integration fixtures. The focused direct/address/connection-loss suite passed 21 tests.

## Русский

Изолированный Electron прочитал настоящую установку ComfyUI 0.45.3: 3375 классов нод, 70 пакетов, 797 файлов моделей. Все 797 прочитаны примерно за 41 секунду, ожидающих, ошибочных и исключённых нет. Метаданные содержались в 524 файлах; пустой заголовок не считается ошибкой.

До исправления недоступный MCP или требование входа останавливали синхронизацию при работающем ComfyUI. Теперь оба случая проверены с переходом на сохранённый адрес ComfyUI и понятным предупреждением. Повторные чтения заняли около 3 секунд и использовали кэш неизменившихся заголовков. Чтение через авторизованный настоящий MCP этим не подтверждено. Профиль владельца, модели и службы не менялись; генерация не запускалась. Целевые 21 интеграционный тест прошли.
