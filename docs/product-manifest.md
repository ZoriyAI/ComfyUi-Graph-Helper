# Public product catalogue

`npm run build` writes `dist/product-manifest.json` from the same compiled lessons, guides and blueprints the application uses. About → Export public product catalogue saves it from the desktop or paired browser. It contains no user profile, installed-model catalogue, workflow, conversation or credentials.

The `nodewise-product-envelope/v1` envelope contains `payload` and `sha256`. Validate the digest over UTF-8 `JSON.stringify(payload)` before consuming it. This checksum detects changed bytes; **it is not a publisher signature**. Verify the release asset and its GitHub provenance separately. `source.revision`, `committedAt` and `modified` identify the build input. A source archive without Git has a null revision and modified=true; never present it as a verified release revision.

The payload has:

- `version`, `repository`, source identity and a distribution matrix. Windows/macOS source installers remain distinct from Linux binary packages and paired browser access.
- `lessons`: stable ID, content digest and complete built-in lesson document, including RU/EN text, steps, prerequisites, quiz and rubric. Preserve its `adult` marker and obey the product's content policy when displaying it.
- `guides`: stable ID, content digest and complete situation, concrete steps, primary-source URL, follow-up and result-check rule.
- `blueprints`: stable ID, family, bilingual title/description and workflow digest. This is a discovery index; the native graph remains in the application's pinned blueprint package.

For the portal, ingest a release snapshot, validate schema and digest, replace content by stable IDs, and invalidate cached pages whose item hashes changed. Count array entries instead of hard-coding totals. Show the source version/revision and acceptance boundaries. Do not turn a guide's presence into a claim that every external problem was automatically repaired. Reject unknown envelope versions; preserve the previous valid snapshot if a new import fails. Sanitize imported prose and validate source URLs before rendering.

The portal is maintained separately. This change supplies and qualifies the application-side export; it does not claim that the portal has imported or published it.

На русском: сборка создаёт проверяемый снимок версии, платформ и всего встроенного учебного материала из тех же данных, которыми пользуется приложение. Кнопка в «О программе» экспортирует только публичный каталог. Портал должен сверять SHA256, обновлять записи по ID и изменившемуся хэшу, показывать версию источника и сохранять маркировку взрослого контента. Контрольная сумма не заменяет подпись издателя. Интеграция портала ведётся отдельно.
