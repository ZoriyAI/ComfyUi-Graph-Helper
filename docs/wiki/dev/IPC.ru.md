[English](IPC.md)
[Главная](../Home.ru.md) › [Для разработчиков](README.ru.md)

# IPC между окном и main

Окно не может трогать файлы, сеть и базу. Оно просит main через каналы IPC: у каждого канала есть имя, запрос и
ответ.

## Части

| Часть | Где | Что это |
| --- | --- | --- |
| Имена каналов | `src/shared/ipc-channels.ts` | `IPC_CHANNELS`: по константе на канал, например `ABOUT_INFO: 'about:info'`. |
| Копия имён | `src/preload/index.ts` | Тот же `IPC_CHANNELS`, записанный ещё раз: preload в песочнице не может импортировать другие файлы. Держите оба списка одинаковыми. |
| Метод | `src/preload/index.ts` | Метод у `window.electronAPI`, который вызывает `ipcRenderer.invoke(channel, …)`, и его строка в типе `ElectronAPI`. |
| Обработчик | `src/main/ipc.ts` или `src/main/ipc/*Ipc.ts` | `ipcMain.handle(channel, handler)` внутри функции `register…Ipc(ipcMain)`. |
| Типы | `src/shared/contracts/` | Что приходит и что уходит, общее для всех трёх. |

## Проверка

`src/main/ipc.ts` оборачивает `ipcMain` Electron в `guardedIpcMain` (`src/main/ipc/guard.ts`) до регистрации
обработчиков:

- `handle` проверяет, что отправитель это собственная страница приложения (собранный `index.html` или схема
  приложения; сервер Vite при разработке). Любой другой фрейм, iframe или страница, ушедшая по ссылке, получает
  ошибку «The request did not come from the app window.», и обработчик не запускается.
- `on`, `once`, `addListener`, `prependListener` и `handleOnce` бросают ошибку: у них не было бы проверки
  отправителя. Для каждого канала используйте `handle`.

Внутри обработчика считайте каждый аргумент недоверенным: разбирайте его схемой zod и возвращайте постоянную ошибку
на всё, что не подходит.

## Как добавить канал

1. Добавьте имя в `IPC_CHANNELS` в `src/shared/ipc-channels.ts` и ту же строку в копию в `src/preload/index.ts`.
2. Добавьте типы в `src/shared/contracts/`, если вызов несёт больше строки.
3. В `src/preload/index.ts` добавьте метод в объект `electronAPI` и его строку в тип `ElectronAPI`.
4. В main добавьте `ipcMain.handle(IPC_CHANNELS.YOUR_CHANNEL, handler)` в нужную функцию `register…Ipc`. Разберите
   аргументы; никогда не возвращайте секрет.
5. Вызывайте канал из сервиса в `src/renderer/services/`, а не из компонента.
6. Проверьте обработчик в `tests/unit` (вызовите функцию, которой он пользуется), а путь через окно в e2e-тесте, если
   человек видит результат.

Пример в коде: каналы окна справки `help:tree`, `help:page` и `help:search` в `src/main/ipc/aboutIpc.ts`.

## Потоки

Ответ помощника приходит частями: окно отправляет запрос по `llm:stream-chat`, а main присылает этому окну куски,
пока ход не закончится (`src/main/ipc/agentIpc.ts`, `src/renderer/services/llm/chatService.ts`).

## См. также

- [Для разработчиков](README.ru.md)
- [Устройство приложения](Architecture.ru.md)
- [Безопасность](../trust/Security.ru.md)
