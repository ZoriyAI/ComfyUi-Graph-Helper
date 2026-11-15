[Русский](Contributing.ru.md)
[Home](../Home.md) › [For developers](README.md)

# Contributing

The full guide is `CONTRIBUTING.md` at the top of the project. In short:

1. **Talk first** about a larger change: a discussion or an issue, so the idea is agreed before the work.
2. **Set up** as in [Building from source](Building-From-Source.md). A development run uses the same data folder as an
   installed app; pass `--user-data-dir` to keep a test profile apart.
3. **Keep the promises**: ComfyUI is only read ([Reading ComfyUI](Reading-ComfyUI.md)); keys never reach the window,
   a log or a file ([Security](../trust/Security.md)); every IPC call is checked ([IPC](IPC.md)).
4. **Texts in both languages**: every new text in English and Russian ([Texts and languages](Texts-And-Languages.md));
   a change a person can see gets its wiki page in both languages ([Writing wiki pages](Wiki-Style.md)).
5. **Check** before the pull request:

   ```bash
   npm run type-check
   npm test
   npm run build
   xvfb-run -a npx playwright test tests/e2e/<file>.test.ts --trace off   # the files your change touches
   node scripts/changelog.js --check
   node scripts/public-tree-check.js
   ```

   [Testing](Testing.md) says what each kind of test covers.
6. **The pull request** follows the template: what and why, how it was checked.

By sending a contribution you agree that it is published under the project's licence (MIT with the Commons Clause).
Everyone taking part follows the code of conduct (`CODE_OF_CONDUCT.md`).

## See also

- [For developers](README.md)
- [Architecture](Architecture.md)
- [Testing](Testing.md)
