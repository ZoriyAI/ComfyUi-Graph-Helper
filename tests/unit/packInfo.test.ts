import { describe, expect, it } from 'vitest';
import { isChatter, packInfoOf, parsePyproject, README_SUMMARY_MAX_CHARS, summarizeReadme, webUrl } from '../../src/shared/knowledge/packInfo';

/** Shaped after the pyproject.toml files node packs ship for the Comfy Registry. */
const WAN_PYPROJECT = `[project]
name = "ComfyUI-WanVideoWrapper"
description = "ComfyUI wrapper nodes for WanVideo"
version = "1.3.4"
license = {file = "LICENSE"}
dependencies = ["accelerate>=1.2.1", "diffusers>=0.33.0", "ftfy", "einops"]

[project.urls]
Repository = "https://github.com/kijai/ComfyUI-WanVideoWrapper"
#  Used by Comfy Registry https://comfyregistry.org

[tool.comfy]
PublisherId = "kijai"
DisplayName = "WanVideoWrapper"
Icon = ""
`;

describe('what a pack says about itself in pyproject.toml', () => {
  it('reads the description, the repository link and the registry name', () => {
    expect(parsePyproject(WAN_PYPROJECT)).toEqual({
      description: 'ComfyUI wrapper nodes for WanVideo',
      repositoryUrl: 'https://github.com/kijai/ComfyUI-WanVideoWrapper',
      displayName: 'WanVideoWrapper',
    });
  });

  it('takes Repository before Homepage, then Source, then any web link the table holds', () => {
    const urls = (lines: string) => parsePyproject(`[project]\nname = "x"\n\n[project.urls]\n${lines}\n`).repositoryUrl;
    expect(urls('Homepage = "https://example.org/home"\nRepository = "https://github.com/a/b"')).toBe('https://github.com/a/b');
    expect(urls('"Bug Tracker" = "https://github.com/a/b/issues"\nSource = "https://github.com/a/src"')).toBe('https://github.com/a/src');
    expect(urls('Homepage = "https://example.org/home"')).toBe('https://example.org/home');
    expect(urls('Changelog = "https://example.org/changes"')).toBe('https://example.org/changes');
    // Not web links: nothing is shown.
    expect(urls('Repository = "javascript:alert(1)"\nHomepage = "file:///etc/passwd"')).toBeNull();
    expect(urls('Repository = "not a url"')).toBeNull();
  });

  it('reads both quote styles, escapes, comments, tripled strings and inline url tables', () => {
    expect(parsePyproject("[project]\ndescription = 'Literal \\\\ text' # a comment\n").description).toBe('Literal \\\\ text');
    expect(parsePyproject('[project]\ndescription = "Says \\"hi\\" \\u00e9" # a comment\n').description).toBe('Says "hi" é');
    expect(parsePyproject('[project]\ndescription = """\nFirst line\nsecond line\n"""\nversion = "1"\n').description).toBe('First line second line');
    expect(parsePyproject("[ project ]\ndescription = '''One\nTwo'''\n").description).toBe('One Two');
    const inline = parsePyproject('[project]\nname = "x"\nurls = { Homepage = "https://h.example", "Repository" = "https://github.com/x/y" }\n');
    expect(inline.repositoryUrl).toBe('https://github.com/x/y');
    const dotted = parsePyproject('[project]\nurls.Repository = "https://github.com/x/z"\n');
    expect(dotted.repositoryUrl).toBe('https://github.com/x/z');
  });

  it('reads only the keys of the right tables and survives a file it does not understand', () => {
    const other = parsePyproject('[tool.poetry]\ndescription = "not this one"\n[project.optional-dependencies]\ndescription = "nor this"\n');
    expect(other).toEqual({ description: '', repositoryUrl: null, displayName: '' });
    expect(parsePyproject('')).toEqual({ description: '', repositoryUrl: null, displayName: '' });
    expect(parsePyproject('\u0000\u0001 garbage = = "\n[[[\ndescription = "unclosed\n')).toEqual({ description: '', repositoryUrl: null, displayName: '' });
    expect(parsePyproject('[project]\ndescription = """never closes\n').description).toBe('');
    expect(parsePyproject('﻿[project]\r\ndescription = "Windows lines"\r\n').description).toBe('Windows lines');
  });

  it('cuts a description that runs on at a word', () => {
    const long = parsePyproject(`[project]\ndescription = "${'word '.repeat(200)}"\n`).description;
    expect(long.length).toBeLessThanOrEqual(401);
    expect(long.endsWith('word…')).toBe(true);
  });
});

/** Shaped after real pack READMEs: a title, badges, a picture, HTML, prose, then the installation steps. */
const KJ_README = `<h1 align="center">KJNodes for ComfyUI</h1>

[![Downloads](https://img.shields.io/badge/dl-1-blue)](https://x.example/stats) [![License: GPL](https://img.shields.io/badge/license-GPL-green)](LICENSE)
<p align="center"><img src="docs/overview.png" width="600" /></p>

<!-- A comment that is not shown -->
Various **quality of life** and _masking_ related nodes and scripts made by combining functionality of existing nodes for [ComfyUI](https://github.com/comfyanonymous/ComfyUI).

I know I'm bad at documentation, especially this project that has grown from random practice nodes to... too many lines in one file.
I have however started to add descriptions to the nodes themselves &amp; there's a small \`?\` you can click.

> [!NOTE]
> Some nodes need \`color-matcher\` installed.

## Installation
1. Clone this repo into \`custom_nodes\` folder.
2. Install dependencies.

Clone it and you are done, this paragraph is past the installation heading.
`;

describe('the opening of a README', () => {
  it('is its first paragraph of prose as plain text, without badges, pictures, HTML, markup or chatter', () => {
    const summary = summarizeReadme(KJ_README);
    expect(summary).toBe('Various quality of life and masking related nodes and scripts made by combining functionality of existing nodes for ComfyUI.');
    for (const markup of ['![', '](', '<', '**', 'shields.io', 'comment', 'Clone', 'Installation', '&amp;', "I know I'm bad"]) expect(summary, markup).not.toContain(markup);
  });

  it('skips a heading, badges and talk about the author to reach what the pack does', () => {
    const readme = [
      '# My Nodes',
      '',
      '[![Discord](https://img.shields.io/badge/discord-join-blue)](https://example.invalid/d) [![Ko-fi](https://img.shields.io/badge/ko--fi-support-red)](https://example.invalid/k)',
      '',
      "I know I'm bad at documentation, so please bear with me while this grows.",
      '',
      'If you like these nodes, buy me a coffee or give the repo a star on the page.',
      '',
      'Nodes that cut a picture into tiles, upscale each tile and stitch them back together.',
      '',
      'A second paragraph that the card does not need to show at all.',
    ].join('\n');
    expect(summarizeReadme(readme)).toBe('Nodes that cut a picture into tiles, upscale each tile and stitch them back together.');
    expect(isChatter("PRs welcome! Join our Discord for help.")).toBe(true);
    expect(isChatter('Nodes for loading and saving latents in several formats.')).toBe(false);
  });

  it('says nothing for a README that is only badges, code and chatter', () => {
    expect(summarizeReadme(['# Pack', '', '![shot](a.png)', '', '```', 'pip install x', '```', '', 'Feel free to open an issue or a pull request, I will look at it.'].join('\n'))).toBe('');
  });

  it('passes over code blocks, tables, lists and headings, and stops at the setup steps', () => {
    const readme = [
      'ComfyUI Pack',
      '============',
      '',
      '```python',
      'print("a long line of code that should never be shown as a description of the pack")',
      '```',
      '',
      '| Node | What it does in a table row that is long enough |',
      '|------|------|',
      '',
      '- a feature listed as a bullet that is long enough to count',
      '- another one',
      '',
      '    indented code that is long enough to be mistaken for prose',
      '',
      'A small pack that adds nodes for loading and saving latents in several formats.',
      '',
      'Requirements',
      '------------',
      'Python 3.10 or newer is needed for the nodes in this pack to load.',
    ].join('\n');
    expect(summarizeReadme(readme)).toBe('A small pack that adds nodes for loading and saving latents in several formats.');
  });

  it('keeps to about the length the card shows, cutting one long paragraph at a word', () => {
    const many = Array.from({ length: 6 }, (_, index) => `Paragraph ${index} ${'says something about the pack '.repeat(5)}`).join('\n\n');
    const summary = summarizeReadme(many);
    expect(summary.length).toBeLessThanOrEqual(README_SUMMARY_MAX_CHARS + 10);
    expect(summary.split('\n\n').length).toBeLessThanOrEqual(3);
    const one = summarizeReadme('word '.repeat(400));
    expect(one.length).toBeLessThanOrEqual(README_SUMMARY_MAX_CHARS + 1);
    expect(one.endsWith('…')).toBe(true);
  });

  it('gives nothing for a README with no prose, and reads Russian prose as prose', () => {
    expect(summarizeReadme('')).toBe('');
    expect(summarizeReadme('# Title\n\n![x](y.png)\n\n[![b](c)](d)\n\nhttps://github.com/a/b\n')).toBe('');
    expect(summarizeReadme('# Пак\n\nНабор нод для работы с масками и цветом изображений.\n')).toBe('Набор нод для работы с масками и цветом изображений.');
  });
});

describe('what the card shows of a pack', () => {
  it('prefers the pyproject description and shows the README only when there is none', () => {
    const facts = parsePyproject(WAN_PYPROJECT);
    expect(packInfoOf(facts, 'ComfyUI wrapper nodes for WanVideo.\n\nIt also loads the 2.2 models.')).toEqual({
      description: 'ComfyUI wrapper nodes for WanVideo',
      repositoryUrl: 'https://github.com/kijai/ComfyUI-WanVideoWrapper',
      readmeSummary: '',
    });
    expect(packInfoOf(null, "I made this for myself.\n\nNodes that tile and stitch.")).toEqual({ description: '', repositoryUrl: null, readmeSummary: 'Nodes that tile and stitch.' });
    expect(packInfoOf(null, 'Only a README.')).toEqual({ description: '', repositoryUrl: null, readmeSummary: 'Only a README.' });
    expect(packInfoOf(null, '')).toEqual({ description: '', repositoryUrl: null, readmeSummary: '' });
  });

  it('shows only web links', () => {
    expect(webUrl('https://github.com/a/b')).toBe('https://github.com/a/b');
    expect(webUrl(' http://example.org ')).toBe('http://example.org/');
    expect(webUrl('ftp://example.org')).toBeNull();
    expect(webUrl(null)).toBeNull();
  });
});
