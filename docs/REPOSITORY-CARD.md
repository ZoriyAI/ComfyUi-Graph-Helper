[Русский](#по-русски)

# The repository card

Only the repository owner can fill in GitHub's "About" box (the gear next to "About" on the repository page). Copy
these values there.

## Description (at most 350 characters)

```text
CozyGraph: a desktop tutor for ComfyUI graphs. Learn ComfyUI with lessons on a real canvas, explanations of every node and link, and an assistant that builds step by step. Reads a running ComfyUI, never changes it. Experimental, Linux. Independent, not affiliated with Comfy Org.
```

## Website

The documentation home page: `https://github.com/<owner>/<repository>/blob/<default branch>/docs/wiki/Home.md`
(the same address as `PROJECT_URL` in `src/main/identity.ts`, with that path added).

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

## Badges for the README (once the address is set)

Replace `<owner>/<repository>` and add these lines under the title of `README.md` and `README.ru.md`:

```markdown
[![Checks](https://github.com/<owner>/<repository>/actions/workflows/ci.yml/badge.svg)](https://github.com/<owner>/<repository>/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/<owner>/<repository>)](https://github.com/<owner>/<repository>/releases/latest)
[![Licence: MIT with Commons Clause](https://img.shields.io/badge/licence-MIT%20%2B%20Commons%20Clause-blue)](LICENSE)
```

## По-русски

Поле «About» на GitHub заполняет только владелец репозитория (шестерёнка рядом с «About»). Описание, сайт и темы
выше вставляются как есть, по-английски: так их найдут в поиске GitHub. Картинку для ссылок (Social preview)
загрузите из `docs/screenshots/social-preview.png`. В настройках включите Discussions с
категорией `Commercial`, закрытые сообщения об уязвимостях и заведите метку `content-rules`. Значки для README
добавьте, когда будет известен адрес репозитория.
