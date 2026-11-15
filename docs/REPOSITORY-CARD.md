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
- Issues: create the labels `bug`, `wish`, `install-test` and `content-rules` (the issue forms use the first three).

## Pull requests: code from outside is not merged

The project takes ideas, reports and tests, not code (`CONTRIBUTING.md`). No tool in this repository can change
GitHub's settings, so this is for the owner to do by hand, and to check on the page itself, since GitHub moves and
renames these settings:

- Settings ▸ General ▸ Features: look for a "Pull requests" setting. Where GitHub offers it, it can turn pull requests
  off or allow them only from collaborators; either matches the policy. Whether a public repository can turn them off
  entirely, check on that page; it is not promised here.
- If there is no such setting, check Settings ▸ General ▸ Features and Settings ▸ Moderation ▸ Interaction limits.
  Interaction limits are temporary (from a day to six months) and also limit issues and comments, which the project
  wants to keep open, so they suit a busy week better than a standing rule.
- Either way, `.github/PULL_REQUEST_TEMPLATE.md` fills in every new pull request with the policy in both languages,
  so a person sees it before sending. A pull request that arrives is closed with thanks and a pointer to Issues;
  a saved reply (your profile settings ▸ Saved replies) keeps that answer at hand.

## To strengthen the record

Actions only the owner can take; none of them is done yet unless the owner records it here. Why: `NOTICE.md`.

- After each release, request snapshots of the repository and of the website in the Internet Archive's Wayback
  Machine ("Save Page Now") and in Software Heritage ("Save code now").
- Keep release pages and tags as published: never move or delete a tag, never replace a release's files.
- After each release, fill in its row of the dated record in `NOTICE.md` and `NOTICE.ru.md`.
- Consider registering "NodeWise Studio" and the app icon as a trademark; then update the trademark line in `NOTICE.md`.
- Consider a short consultation with an intellectual property lawyer before any commercial deal.
- Keep a private, dated log of design decisions (what was decided, when, and why).
- Make the licence and copyright line of the website repository match `COPYRIGHT` and `NOTICE.md`.

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

Код со стороны проект не принимает (`CONTRIBUTING.ru.md`). Настройки GitHub отсюда не меняются, их владелец
переключает сам и проверяет на месте, потому что GitHub переносит и переименовывает их. В Settings ▸ General ▸
Features поищите настройку «Pull requests»: там, где GitHub её даёт, можно выключить pull request или разрешить их
только соавторам (collaborators); можно ли выключить их совсем у публичного репозитория, проверьте на этой странице,
здесь это не обещано. Если такой настройки нет, проверьте Settings ▸ General ▸ Features и Settings ▸ Moderation ▸
Interaction limits; эти ограничения временные (от суток до полугода) и закрывают ещё и обращения с комментариями,
поэтому годятся на трудную неделю, а не как постоянное правило. В любом случае `.github/PULL_REQUEST_TEMPLATE.md`
вписывает правило на двух языках в каждый новый pull request, и человек видит его до отправки. Пришедший pull request
закрывается с благодарностью и ссылкой на обращения; готовый ответ удобно держать в Saved replies. Заведите и метку
`install-test` для формы отчёта о проверке установки.

Чтобы укрепить запись (`NOTICE.ru.md`), только владелец может и пока ничего из этого не сделано: после каждой версии
запрашивать снимки репозитория и сайта в Wayback Machine у Internet Archive («Save Page Now») и в Software Heritage
(«Save code now»); не переносить и не удалять метки, не заменять файлы опубликованных версий; после каждой версии
заполнять её строку в записи дат `NOTICE.md` и `NOTICE.ru.md`; подумать о регистрации «NodeWise Studio» и значка как
товарного знака и тогда обновить строку о нём в `NOTICE.md`; перед любой коммерческой сделкой подумать о короткой
консультации юриста по интеллектуальной собственности; вести закрытый датированный журнал решений по замыслу и
оформлению; привести строку о лицензии и авторском праве в репозитории сайта в соответствие с `COPYRIGHT` и
`NOTICE.md`.
