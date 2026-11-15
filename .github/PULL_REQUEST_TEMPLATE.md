## What and why

<!-- One or two sentences: what this changes and why. Link the issue it answers. -->

## How it was checked

- [ ] `npm run type-check`
- [ ] `npm test`
- [ ] End-to-end tests for the part I changed (`xvfb-run -a npx playwright test <file> --trace off`)
- [ ] Texts in both languages (`src/shared/i18n/catalog.ts`), wiki pages in both languages if the person sees the change

## Things to know

- [ ] ComfyUI is still only read: no new call that writes, installs or queues.
- [ ] No key, token, personal path or e-mail in code, tests or texts.

See [CONTRIBUTING.md](../CONTRIBUTING.md).
