# Model-description translation qualification — 17 November 2026

An isolated Electron profile used three descriptions from a real ComfyUI catalog: a LoRA, a video diffusion model and a VAE. The selected assistant was `qwen2.5:7b` through a local endpoint reporting Ollama 0.34.2. No model files or owner profile were changed.

The first pass exposed awkward Russian and different translations of identical description fields. The revised translation instruction, reuse of identical prose and a new cache policy produced readable text for the three samples. Product names and numeric identifiers remained unchanged. The original descriptions, raw metadata and trigger words were compared before and after and were identical. Cached translations stayed available after the assistant was paused and its memory-release action completed. This is a three-description sample, not a guarantee of every model's translation quality.

The implementation also exposes queue state, the active file, failed attempts and cached records in Sync problems and Settings → Sync. Pause survives restart; retry can rerun failed work or replace one model's cached translation. Translation does not block catalog reading. A 90-second deadline is a visible failure with cooldown, and cancellation settles even if an adapter ignores its abort signal. Long text is split at word boundaries; oversized unbroken tokens are refused rather than split. Identical fields share one result.

Validation: 16 focused unit/bridge tests, main/renderer/test types, focused lint and build passed. A real isolated Electron UI test paused the queue in Russian, restarted, verified the persisted pause and resumed it; one test passed in 4 seconds. No page errors were observed. No physical-phone or independent novice acceptance is implied.

## Memory-release evidence boundary

Both local endpoints reported an empty running-model list even during the sampled translation requests. The release API returned success and the list was empty afterward, but this does not prove that this action unloaded a GPU allocation. Aggregate GPU readings also include unrelated processes. Native model residency and its transition must be observed separately before claiming a measured unload. Ollama documents the [running-model list](https://docs.ollama.com/api/ps) and the [`keep_alive` request parameter](https://docs.ollama.com/api/generate).

## Русский

Проверены три настоящих описания: LoRA, видеомодель и VAE. Первый проход небольшой модели дал корявый русский и различия в переводе одинаковых полей. После исправления инструкции, повторного использования одинакового текста и обновления политики кэша три примера стали читаемыми. Исходные описания, метаданные и триггеры не изменились. Кэш доступен при остановленном помощнике.

Очередь, ошибки, пауза и повтор доступны в синхронизации; пауза подтверждена перезапуском настоящего Electron. Тайм-аут и отмена не оставляют зависшую задачу, длинный текст делится по границам слов. Прошли 16 целевых тестов, типы, lint, сборка и один тест интерфейса. Качество всех возможных переводов и выгрузка GPU этим не подтверждены: список загруженных моделей был пуст ещё до команды освобождения. Физические телефоны и независимый новичок в эту проверку не входили.
