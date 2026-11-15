# Brief for the engineer who builds the project's website

You are a senior front-end engineer and motion designer. Build the public website for a desktop app. Work alone,
finish the whole site, and check it in a real browser before you say it is done.

## 0. Set these first

- `PRODUCT_NAME`: the name the owner gives you (working name: **NodeWise**). Keep it in ONE constant; never type it
  into components or texts by hand, so that a rename is one edit.
- `REPO_URL`: `https://github.com/ZoriyAI/ComfyUi-Graph-Helper` (one constant as well; the owner may rename it).
- Tagline, the same words everywhere: English "A desktop tutor for ComfyUI graphs", Russian «Учебный помощник по
  графам ComfyUI».

## 1. What the product is (facts; do not invent others)

A free desktop app for Linux that teaches a newcomer ComfyUI, the node-graph tool for image and video models.

- It **reads** a running ComfyUI at its address (nodes, node packs, model files) and **never changes it**: it does
  not run, queue, install, download or delete anything there. The result of the work is an ordinary ComfyUI
  workflow file that the person opens in ComfyUI.
- **Canvas**: a real graph editor with typed links, real fields, subgraphs, groups, copy and paste, undo and redo,
  and an explanation card for every node, input, output and link.
- **Lessons**: about eighty hands-on lessons in twelve groups (ComfyUI basics, first pictures, picture models,
  picture techniques, video, the anchor picture for video, sound and speech, 3D, faces and characters, packs and
  tools, and more). The person builds on the real canvas; the app checks each step and says why a number or a file
  is right. No language model is needed for lessons.
- **Assistant** (optional; a cloud model or a local one such as Ollama, LM Studio, llama.cpp): three ways to work.
  Ask: answers and grey draft suggestions that the person accepts or rejects. Build: builds step by step and says
  why each step is there, changing only what it built itself. Learn: the lessons.
- **Check**: finds what ComfyUI would refuse to run (missing nodes and models, wrong link types, a graph with no
  output, values out of range) and marks it on the nodes.
- **Import**: someone else's workflow is drawn as its file describes it and explained piece by piece.
- Languages: English and Russian. Night theme only. Linux x64 packages: .deb, .rpm, AppImage, tar.gz with an
  install script. Windows and macOS are **not supported** (build from source, untested): never claim otherwise.
- Experimental, independent project. **Not affiliated with or endorsed by Comfy Org.** It contains no ComfyUI code.
  Wishes and ideas go to GitHub Discussions, problems to GitHub Issues. Licence: MIT with the Commons Clause (free
  to use, study and change; selling it needs the owner's written permission).

Source of truth for every claim: the repository's `README.md`, `docs/wiki/` (English pages `Name.md`, Russian
`Name.ru.md`) and `docs/screenshots/` (13 real screenshots in `en/` and `ru/`, plus `hero.png` and
`social-preview.png`). If the README and this brief disagree, the README wins. Do not promise features, numbers,
platforms or dates that are not written there.

## 2. Goal and audience

A person who has heard of ComfyUI, opened it once and was lost. In ten seconds they must understand: this app
teaches me graphs by doing, it cannot break my ComfyUI, it is free, here is the download. The second audience is a
person who already uses ComfyUI and wants to understand a workflow they downloaded.

One primary action on every screen: **Download for Linux**. Secondary: **Read the docs**, **See it on GitHub**.

## 3. Stack (fixed)

- TypeScript (strict) and React 18+, built with **Vite**; a static site, no server. It must deploy to GitHub Pages
  under a sub-path (set `base` from one variable) and to any static host.
- Routing: `react-router` with real, shareable URLs, pre-rendered to static HTML at build time (for example
  `vite-react-ssg` or `vike`) so that every page has content and meta tags without JavaScript.
- Styling: CSS Modules or vanilla-extract with design tokens as CSS variables. No UI kit, no Tailwind component
  library look: the site has its own design.
- Motion: **Motion** (`motion/react`, the successor of Framer Motion) for component and layout animation and
  scroll-linked animation; **GSAP + ScrollTrigger** only if a pinned scroll sequence needs it; **SVG and Canvas 2D**
  for the graph illustrations; **Lenis** for smooth scrolling (off under reduced motion). WebGL (three.js /
  react-three-fiber) is allowed for ONE hero background at most, lazy-loaded, with a static fallback. No Lottie
  files from stock libraries, no stock video, no stock illustrations.
- i18n: English at `/`, Russian at `/ru/`, every text in two typed dictionaries with the same keys (the build fails
  on a missing key), `hreflang` links, a language switch that keeps the current page.
- Quality tools: ESLint, Prettier, `tsc --noEmit`, Vitest for logic, Playwright for a smoke test of every route in
  both languages and for the reduced-motion mode.

## 4. Art direction

Night interface, the app's own language: a near-black blue background, cool white text, **one** accent (the app's
cyan) plus the colours of link types as supporting notes (violet for model, yellow for CLIP, pink for latent, blue
for image, orange for conditioning). Take the exact values from the screenshots; define them once as tokens.

The visual idea of the whole site is **the graph itself**: nodes, inputs and outputs, and links that draw
themselves. Not abstract blobs, not gradients for their own sake. Type: one geometric sans for everything (Geist,
Inter or similar, self-hosted, `font-display: swap`) and one monospace for node class names and numbers. Large
confident headlines, short sentences, a lot of air. Real screenshots inside a drawn window frame; never a mock-up
of an interface that does not exist.

## 5. Motion: the heart of the site

Every animation **explains something**; none is decoration. One motion system: three durations (fast 150 ms,
base 300 ms, slow 600 ms), two easing curves (one for entering and moving, one spring for things a person "drops"),
defined as tokens and used everywhere.

Build these, in this order of importance:

1. **Hero: a graph that builds itself.** On load, five or six nodes of a first picture graph (Load Checkpoint,
   two CLIP Text Encode, Empty Latent Image, KSampler, VAE Decode, Save Image) appear one by one, their links draw
   from output to input along bezier curves in the colour of their type, a short "why" label fades in beside each
   step, and a small pulse travels along the finished chain. Drawn in SVG, resolution independent, under 2 seconds
   to the first meaningful frame, loops calmly or rests. The pointer gently parallaxes the nodes; a node can be
   dragged and its links follow (a toy, but a true one).
2. **Scroll story "from lost to understood"** (pinned section, scroll-linked): the same graph first as a grey
   tangle with no labels; as the person scrolls, cards open on each node ("what it is", "why it is here"), links
   take their colours, the tangle straightens into columns. This is the product's promise shown, not told.
3. **Lesson in motion:** a lesson step card on the right, the canvas on the left; the step asks for a link, a
   dashed hint runs to the right input, the link snaps in, the step ticks green, the camera glides to the next
   place. Loop of three steps.
4. **The assistant builds:** a chat column where tool cards appear in sequence while nodes are revealed on the
   canvas and each link is drawn after its node; a grey draft node appears, is accepted and turns solid; another is
   rejected and dissolves.
5. **Check wave:** a scan line crosses a graph; two nodes get a ring and a number; a findings list slides in, and
   hovering a finding lights its node.
6. **Read-only shield:** a simple, clear diagram: the app on the left, ComfyUI on the right, arrows only one way
   ("reads"), a crossed-out arrow back ("never writes"). Animated once on entering the view.
7. **Lesson map:** the twelve groups as a constellation of nodes joined by links; hovering a group lifts it and
   lists its lessons; the count animates up to the real number.
8. Micro-interactions: magnetic primary button, link underlines that draw, cards that tilt a few degrees to the
   pointer, a cursor trail of a link only inside the hero, number counters, a page transition where a link is
   "pulled" across the screen (View Transitions API with a fallback).

Rules that are not optional:

- `prefers-reduced-motion: reduce`: no scroll-pinning, no parallax, no auto-playing loops; every animated scene
  shows its final, complete frame as a still. Add a visible "Motion: on / off" switch in the footer that does the
  same and is remembered.
- Animate only `transform` and `opacity` (and SVG stroke offsets); 60 fps on a mid-range laptop; pause every loop
  that is off screen (`IntersectionObserver`) and when the tab is hidden.
- Nothing essential is said only by animation: each scene has a heading and one or two sentences that stand alone.
- No animation blocks reading or delays the download button. No scroll-jacking beyond the two pinned sections,
  and those are skippable with one keypress and with a "Skip" link.

## 6. Pages

1. **Home**: hero (the building graph, name, tagline, two sentences, Download and Docs buttons, the line "Free.
   Reads your ComfyUI, never changes it."), the scroll story, three ways to work (Ask, Build, Learn) with scenes 3
   and 4, the check, importing someone else's workflow, the read-only shield, the lesson map, a strip of real
   screenshots, "what it is not" (not a ComfyUI replacement, does not run graphs, Linux only today), download,
   footer.
2. **Download**: the four Linux packages with a one-line "which one do I take" each, links built from the latest
   GitHub release (read the release list at build time and at run time with a graceful fallback to the Releases
   page; never hard-code a version), checksums note, first steps in three short steps, honest note on Windows and
   macOS with a link to the build-from-source pages.
3. **Lessons**: the twelve groups and their lessons with a search and a filter by group; each lesson links to its
   wiki page. Generate the list from data extracted from the repository at build time (the wiki's lesson index),
   not typed by hand.
4. **Screenshots**: a gallery of the 13 pictures in the page's language with their captions from
   `docs/screenshots/README.md`, a light-box with keyboard control.
5. **Docs**: an entry page that explains the ten wiki chapters and links to them on GitHub (do not copy the wiki
   into the site; link to the right language).
6. **Trust**: privacy in plain words (what goes where and when), read-only, the content rules (lawful, 18+ behind
   a switch, consent for a person's face or voice), licence and commercial use, "not affiliated with Comfy Org".
   Take the wording from `docs/wiki/trust/`.
7. **404** with a small broken link that reconnects itself.

Header: name mark, Home, Lessons, Screenshots, Docs, Download button, language switch, GitHub icon with the star
count (fetched, with a fallback of no number). Footer: the links again, licence, "Experimental project", the
not-affiliated sentence, the motion switch.

## 7. Content rules

- Every sentence short and concrete; no "revolutionary", "powerful", "seamless", "AI-powered". Say what the person
  can do.
- English with American spelling; Russian is a real translation, not a calque; the glossary of the app holds:
  node / нода, link / связь, canvas / холст, assistant / помощник, prompt / промпт, graph / граф, workflow,
  input and output / вход и выход, pack / пак, subgraph / субграф, grey drafts / серые черновики.
- No long dashes on screen in either language.
- Never write that the app generates images or runs workflows: it does not.
- No explicit content, no images of people; the only pictures are the app's own screenshots and drawn graphs.
- The name ComfyUI is used only to describe what the app works with, never in the product's own name or logo.

## 8. Engineering quality bar

- Lighthouse on a throttled mobile profile: Performance ≥ 90, Accessibility 100, Best Practices 100, SEO 100.
  LCP under 2.5 s, CLS under 0.05, total JavaScript for the first view under 180 KB gzipped (heavy scenes are
  lazy-loaded when they approach the viewport).
- Accessibility: keyboard reach for everything, visible focus, correct headings and landmarks, alt text for every
  screenshot from its caption, colour contrast AA, the language attribute per page, the animated scenes hidden
  from screen readers with a text equivalent beside them.
- Responsive from 360 px to 2560 px; the hero graph re-lays itself out for a narrow screen instead of shrinking.
- SEO and sharing: title and description per page and language, Open Graph and Twitter cards with
  `social-preview.png`, `sitemap.xml`, `robots.txt`, JSON-LD `SoftwareApplication` (free, Linux, the real version
  read from the latest release).
- No trackers, no analytics, no cookies, no third-party fonts or scripts, no external requests except the GitHub
  API calls named above. Say so on the Trust page.
- Images: screenshots converted to AVIF and WebP with PNG fallback at build time, sized `srcset`, lazy-loaded
  below the fold.
- A GitHub Actions workflow that type-checks, tests, builds and deploys to GitHub Pages on a push to the site's
  branch.

## 9. Deliverables

1. A folder `website/` (its own `package.json`, not mixed with the app) with the complete source, a README in
   English and Russian (how to run, build, deploy, change the name and the repository address, add a language).
2. The motion system documented in one page: tokens, the eight scenes, how reduced motion is handled.
3. Tests green; a short report: what you built, the Lighthouse numbers you measured, what you could not verify,
   and screenshots of every page in both languages at 390 px and 1440 px width.

## 10. How to work

Read the repository's README, the wiki's Home and the screenshots first. Sketch the hero scene and the scroll
story as plain SVG before you style anything: if those two do not explain the product without words, nothing else
will save the site. Build the site without animation first (complete, readable, fast), then add the scenes one by
one, checking reduced motion and performance after each. Do not stop at a skeleton or leave "lorem ipsum",
placeholder boxes or "coming soon": every page is finished or it is not in the navigation.
