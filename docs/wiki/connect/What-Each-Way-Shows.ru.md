[English](What-Each-Way-Shows.md)
[Главная](../Home.ru.md) › [Подключение](README.ru.md)

# Что даёт каждый способ

<!-- verify: checked against test servers that speak ComfyUI's routes; not yet run against a real ComfyUI install. -->

| Что | Только адрес ComfyUI | С MCP-сервером, дающим весь каталог |
| --- | --- | --- |
| Ноды с входами, выходами и значениями по умолчанию | да | да |
| Паки нод | да; версии только если стоит ComfyUI-Manager | да |
| Файлы моделей с размером, видом и семейством | да | да |
| Метаданные внутри файла `.safetensors` (название, слова-триггеры, базовая модель) | да | да |
| Картинки, которые ComfyUI находит для модели | да | да |
| Описания рядом с моделями (`.civitai.info`, `.metadata.json`): слова-триггеры и описания с Civitai | нет | да |
| README пака и описание из `pyproject.toml` | нет | да |
| Отпечаток файла («Найти в интернете» ищет на Civitai точно) | нет: поиск только по имени файла | да |

Старый ComfyUI без новых адресов моделей показывает только имена моделей, без размеров и картинок (сообщение скажет,
что это старый ComfyUI). Обновите ComfyUI, чтобы их видеть.

MCP-сервер со списком моделей или чекпойнтов добавляет свой список моделей; всё остальное берётся из ComfyUI.
[MCP-серверы](MCP-Servers.ru.md)

## Версии, по которым сделано чтение

По открытым исходникам: ComfyUI 0.45.0 (его адреса `/system_stats`, `/object_info`, `/models`, `/experiment/models`,
`/view_metadata`), настольное приложение ComfyUI (порт 8000), ComfyUI-Manager (список установленных паков),
artokun/comfyui-mcp 0.52.206 и joenorton/comfyui-mcp-server.

## См. также

- [Подключение](README.ru.md)
- [Подключение к ComfyUI](Connecting.ru.md)
- [ComfyUI только читается](../trust/Read-Only.ru.md)
