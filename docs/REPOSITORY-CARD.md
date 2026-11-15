[Русский](#по-русски)

# The repository card

Only the repository owner can fill in GitHub's "About" box (the gear next to "About" on the repository page). Copy
these values there.

## Description (at most 350 characters)

```text
NodeWise Studio: a desktop tutor for ComfyUI graphs. Learn ComfyUI with lessons on a real canvas, explanations of every node and link, and an assistant that builds step by step. Reads a running ComfyUI, never changes it. Experimental, Linux. Independent, not affiliated with Comfy Org.
```

## Repository name

The repository is still named `ZoriyAI/ComfyUi-Graph-Helper`, after the app's name before 1.0. Rename it to
`nodewise-studio` (Settings ▸ General ▸ Repository name): the brand rule keeps "ComfyUI" out of the product's own
names, and the repository's name is one of them. GitHub sends the old address on to the new one. Then change
`PROJECT_URL` in `src/main/identity.ts`; `tests/unit/identity.test.ts` lists every copy of the address that must
follow (package.json, the issue forms' links, the README badges).

## Website

The documentation home page: `https://github.com/ZoriyAI/ComfyUi-Graph-Helper/blob/HEAD/docs/wiki/Home.md`
(`PROJECT_URL` in `src/main/identity.ts`, with that path added).

## Social preview

Settings ▸ General ▸ Social preview: upload `docs/screenshots/social-preview.png`. It is the picture shown when a
link to the repository is shared.

## Topics

```text
comfyui comfyui-workflow stable-diffusion generative-ai learning tutorial education node-graph desktop-app electron linux ai-assistant
```

## Also in the settings

- Features: turn on Discussions, with a category named `Commercial` (see `COMMERCIAL.md`).
- Security: turn on private vulnerability reporting (see `SECURITY.md`).
- Issues: create the labels `bug`, `wish` and `content-rules` (the issue forms use the first two).

## Badges for the README

`README.md` and `README.ru.md` carry three badges under the name and its line: the Checks workflow (`ci.yml`), the
latest release and the licence. They use the project address; when the repository is renamed, change them with it.

## По-русски

Поле «About» на GitHub заполняет только владелец репозитория (шестерёнка рядом с «About»). Описание, сайт и темы
выше вставляются как есть, по-английски: так их найдут в поиске GitHub. Репозиторий стоит переименовать в
`nodewise-studio` (Settings ▸ General ▸ Repository name): правило бренда не пускает «ComfyUI» в собственные имена
продукта, а имя репозитория одно из них; после этого поменяйте `PROJECT_URL` в `src/main/identity.ts`. Картинку для ссылок (Social preview)
загрузите из `docs/screenshots/social-preview.png`. В настройках включите Discussions с
категорией `Commercial`, закрытые сообщения об уязвимостях и заведите метку `content-rules`. Значки в README уже
стоят и ведут на адрес проекта.
