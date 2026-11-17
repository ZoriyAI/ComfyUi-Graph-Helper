# Large-canvas qualification · 2026-11-17

The isolated Linux Electron application was measured with 100, 500 and 1000 native KSampler nodes, 99/499/999 links and the actual synchronized catalog. The viewport was 1600 × 1100 in Xvfb; no generation or assistant ran. Both measurements used the same host and navigation sequence. Values describe this environment, not a universal frame-rate guarantee.

| Nodes | Ready before → after | DOM elements before → after | Pan/zoom frame p95 before → after | Maximum main-loop delay before → after | Typed edit → verified native export after |
|---:|---:|---:|---:|---:|---:|
| 100 | 2.74 → 2.97 s | 19820 → 14511 | 66.7 → 52.2 ms | 0.56 → 0.69 s | 570 ms |
| 500 | 8.83 → 3.87 s | 94803 → 4991 | 91.7 → 41.6 ms | 2.93 → 0.57 s | 462 ms |
| 1000 | 25.00 → 4.69 s | 188803 → 6274 | 441.7 → 58.4 ms | 10.75 → 0.57 s | 1083 ms |

Ready means reload to the first rendered card plus two animation frames. The frame sample covers a 24-step pan and two wheel zooms. Main delay is measured by a 25 ms timer. Edit timing includes Playwright input, command persistence and the complete exported workflow IPC reply; it is not raw keystroke-to-paint latency. The 100-node case became slightly slower to open in this run; the large-graph benefit is the material result.

Profiles identified repeated whole-graph hashing on explanation-cache updates and thousands of mounted check/resource rows. Project-file refresh now coalesces concurrent reads. Findings remain searchable across every page, with 50 rows per group. Resource stages mount on expansion. Graphs above 200 nodes render visible cards while keeping every node in the document; controls remain visible at reduced zoom.

The working acceptance budget for this synthetic 1000-node workload is under 6 seconds to ready, under 1 second maximum main-loop delay, under 67 ms frame p95 and under 1.5 seconds to a verified edited export. This run met it. RSS after successive imports remained high: the renderer reported 1135 MiB. This change does not claim reduced peak memory or smooth 60 fps on arbitrary graphs.

Regression evidence: 23 focused tests passed; a separate real Electron scenario searched and paged all 1004 missing-input findings, used keyboard Show to reach node 251, edited steps before a wheel move, undid/redid the edit, exported all 251 nodes and reloaded with exact values. Build, all TypeScript projects and touched-file lint passed. No renderer errors were observed. Source: `tests/e2e/large-canvas-controls.test.ts`, `tests/unit/projectFileRefresh.test.ts` and the project-file/render tests.

## По-русски

На том же компьютере загрузка графа из 1000 нод сократилась с 25,00 до 4,69 секунды. Повторные проверки сохранённости объединены, проблемы доступны через поиск и страницы, закрытый список этапов не создаёт тысячи скрытых строк. Настройки нод остаются на холсте; сохранность ввода, отмена, повтор и полный экспорт проверены в отдельном Electron. Это измерение конкретной среды: расход памяти остаётся высоким, гарантии 60 кадров/с для произвольных графов нет. Полная приёмка релиза выполняется отдельно.
