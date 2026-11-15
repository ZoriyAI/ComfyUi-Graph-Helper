[Русский](#по-русски)

# The repository card

Only the repository owner can fill in GitHub's "About" box (the gear next to "About" on the repository page). Copy
these values there.

## Description (at most 350 characters)

```text
NodeWise Studio: a desktop tutor for ComfyUI graphs. Learn ComfyUI with lessons on a real canvas, explanations of every node and link, and an assistant that builds step by step. Reads a running ComfyUI, never changes it. Experimental, Linux. Independent, not affiliated with Comfy Org.
```

## Repository name

The repository is named `ZoriyAI/nodewise-studio` (until 1.0 it carried the app's old name; GitHub sends the old
address on to the new one). `PROJECT_URL` in `src/main/identity.ts` holds the address, and
`tests/unit/identity.test.ts` keeps every copy equal (package.json, the issue forms' links, the README badges).
What remains for the owner is the "About" box: paste the description above, the website and the topics below, and
upload the social preview.

## Website

The documentation home page: `https://github.com/ZoriyAI/nodewise-studio/blob/HEAD/docs/wiki/Home.md`
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
latest release and the licence. They use the project address (`ZoriyAI/nodewise-studio`).

## По-русски

Поле «About» на GitHub заполняет только владелец репозитория (шестерёнка рядом с «About»). Описание, сайт и темы
выше вставляются как есть, по-английски: так их найдут в поиске GitHub. Репозиторий называется
`ZoriyAI/nodewise-studio` (до 1.0 он носил старое имя приложения; старый адрес GitHub переводит на новый), адрес
проекта хранит `PROJECT_URL` в `src/main/identity.ts`. Осталось заполнить поле «About»: описание, сайт и темы. Картинку для ссылок (Social preview)
загрузите из `docs/screenshots/social-preview.png`. В настройках включите Discussions с
категорией `Commercial`, закрытые сообщения об уязвимостях и заведите метку `content-rules`. Значки в README уже
стоят и ведут на адрес проекта.
