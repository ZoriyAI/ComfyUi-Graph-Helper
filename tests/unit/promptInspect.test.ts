import { describe, expect, it } from 'vitest';
import {
  approxTokens,
  contradictions,
  holdsTrigger,
  inspectText,
  phrasesOf,
  readerOfClipType,
  readerOfFamily,
  weightsOf,
} from '../../src/shared/prompt/inspect';

const kinds = (text: string, role: 'positive' | 'negative' = 'positive', reader: 'clip' | 't5' | 'unknown' = 'clip') => inspectText(text, role, reader).map((item) => item.kind);

describe('reading a description the way ComfyUI will', () => {
  it('finds nothing wrong with a plain description, of either kind of model', () => {
    expect(kinds('a quiet lake at dawn, mist, soft light, (pine trees:1.2)')).toEqual([]);
    expect(kinds('A person walks along a beach at sunset. The camera follows from the side.', 'positive', 't5')).toEqual([]);
    expect(kinds('blurry, distorted hands, extra fingers', 'negative')).toEqual([]);
    expect(kinds('')).toEqual([]);
    expect(kinds('   \n ')).toEqual([]);
  });

  it('says a LoRA written into the text does nothing here', () => {
    const found = inspectText('a street at night, <lora:neon_style:0.8>, rain', 'positive', 'clip');
    expect(found).toEqual([{ kind: 'lora-tag', found: '<lora:neon_style:0.8>' }]);
    expect(kinds('portrait <lyco:soft:1>')).toEqual(['lora-tag']);
    expect(kinds('portrait < LoRA : soft : 1 >')).toEqual(['lora-tag']);
    // An embedding is ComfyUI's own form and is left alone.
    expect(kinds('a castle, embedding:fine_detail')).toEqual([]);
  });

  it('names forms that belong to other programs', () => {
    expect(inspectText('a red car BREAK a blue house', 'positive', 'clip')).toEqual([{ kind: 'foreign-syntax', found: 'BREAK' }]);
    expect(inspectText('a cat AND a dog', 'positive', 'clip')).toEqual([{ kind: 'foreign-syntax', found: 'AND' }]);
    expect(inspectText('a [forest:city:0.5] at night', 'positive', 'clip')).toEqual([{ kind: 'foreign-syntax', found: '[forest:city:0.5]' }]);
    expect(kinds('a [red|blue] ball')).toEqual(['foreign-syntax']);
    expect(kinds('a ball, [shadow]')).toEqual(['foreign-syntax']);
    // The words in a sentence are words.
    expect(kinds('salt and pepper, breakfast, a breaking wave')).toEqual([]);
    // Curly braces are ComfyUI's own random choice.
    expect(kinds('a {red|blue} ball')).toEqual([]);
  });

  it('counts parentheses, leaving escaped ones as letters', () => {
    expect(inspectText('a (castle:1.2, on a hill', 'positive', 'clip')).toEqual([{ kind: 'unbalanced', found: '', numbers: { open: 1, close: 0 } }]);
    expect(kinds('a castle), on a hill')).toEqual(['unbalanced']);
    expect(kinds('a film poster \\(1975\\), grain')).toEqual([]);
    expect(kinds('((castle)), (hill:1.1)')).toEqual([]);
  });

  it('warns about a weight that breaks pictures, and about weights a sentence reader mostly ignores', () => {
    expect(inspectText('a (castle:1.9) on a hill', 'positive', 'clip')).toEqual([{ kind: 'weight-high', found: '(castle:1.9)' }]);
    expect(kinds('a (castle:1.5) on a hill')).toEqual([]);
    expect(kinds('a (castle:0.6) on a hill')).toEqual([]);
    expect(inspectText('A (castle:1.2) on a hill.', 'positive', 't5')).toEqual([{ kind: 'weight-ignored', found: '(castle:1.2)' }]);
    expect(kinds('A (castle:1.8) on a hill.', 'positive', 't5')).toEqual(['weight-high', 'weight-ignored']);
    // Not known how the model reads: nothing is said of weights as such.
    expect(kinds('A (castle:1.2) on a hill.', 'positive', 'unknown')).toEqual([]);
    expect(weightsOf('(a b:1.25), (c: 0.5 ), (d)')).toEqual([{ words: 'a b', weight: 1.25, raw: '(a b:1.25)' }, { words: 'c', weight: 0.5, raw: '(c: 0.5 )' }]);
  });

  it('points at a negation in what is wanted, never in what is not', () => {
    expect(inspectText('a street with no cars', 'positive', 'clip')).toEqual([{ kind: 'negation', found: 'no' }]);
    expect(kinds('a room without windows')).toEqual(['negation']);
    expect(kinds('no cars, not blurry', 'negative')).toEqual([]);
    // Parts of words are not negations.
    expect(kinds('a kimono, a piano, notes on a desk, snow')).toEqual([]);
  });

  it('notices a description that is not in English', () => {
    expect(kinds('тихое озеро на рассвете, туман')).toEqual(['not-english']);
    expect(kinds('озеро без лодок')).toEqual(['negation', 'not-english']);
    // A few foreign letters in an English description are a name, not a language.
    expect(kinds('a poster with the word Привет on a brick wall, evening light, long shadows')).toEqual([]);
  });

  it('measures length against what the reader takes', () => {
    expect(approxTokens('a quiet lake at dawn, mist')).toBe(7);
    expect(approxTokens('')).toBe(0);
    // A long word is several pieces to a tokenizer.
    expect(approxTokens('photorealistic')).toBe(3);
    const long = Array.from({ length: 170 }, (_, index) => `word${index % 9}`).join(' ');
    expect(inspectText(long, 'positive', 'clip')).toEqual([{ kind: 'too-long', found: 'clip', numbers: { tokens: 170 } }]);
    expect(kinds(long, 'positive', 't5')).toEqual([]);
    expect(kinds(long, 'positive', 'unknown')).toEqual([]);
    const veryLong = Array.from({ length: 470 }, (_, index) => `word${index % 9}`).join(' ');
    expect(kinds(veryLong, 'positive', 't5')).toEqual(['too-long']);
  });

  it('keeps what it shows short', () => {
    const found = inspectText(`a [${'very '.repeat(40)}long thing]`, 'positive', 'clip');
    expect(found[0].found.length).toBeLessThanOrEqual(49);
    expect(found[0].found.endsWith('…')).toBe(true);
  });
});

describe('two texts against each other', () => {
  it('finds the same thing asked for and forbidden', () => {
    expect(contradictions('a portrait, (soft light:1.2), film grain', 'blurry, Soft Light, extra fingers')).toEqual(['soft light']);
    expect(contradictions('a portrait, soft light', 'blurry, extra fingers')).toEqual([]);
    expect(contradictions('', 'blurry')).toEqual([]);
    // Two letters are not a phrase.
    expect(contradictions('a, an, of', 'a, an, of')).toEqual([]);
    expect(phrasesOf('A portrait. (Soft light:1.2),\n film   grain; x')).toEqual(['a portrait', 'soft light', 'film grain']);
  });

  it('looks for the words of a LoRA the way a person would', () => {
    expect(holdsTrigger('A street at night, Neon  Rain on glass', ['neon rain'])).toBe(true);
    expect(holdsTrigger('a street at night', ['neon rain', 'wet glass'])).toBe(false);
    expect(holdsTrigger('a street, wet glass', ['neon rain', 'wet glass'])).toBe(true);
    expect(holdsTrigger('anything', [])).toBe(false);
    expect(holdsTrigger('anything', ['  '])).toBe(false);
  });
});

describe('how a model reads text', () => {
  it('is told by the kind of text encoder that is loaded', () => {
    expect(readerOfClipType('stable_diffusion')).toBe('clip');
    expect(readerOfClipType('sdxl')).toBe('clip');
    for (const type of ['wan', 'flux', 'sd3', 'qwen_image', 'hunyuan_video', 'lumina2']) expect(readerOfClipType(type), type).toBe('t5');
    expect(readerOfClipType('')).toBe('unknown');
    expect(readerOfClipType(undefined)).toBe('unknown');
  });

  it('is told by the family of a checkpoint', () => {
    for (const family of ['sd15', 'sdxl', 'pony', 'illustrious']) expect(readerOfFamily(family), family).toBe('clip');
    for (const family of ['flux1', 'sd3', 'wan2.2', 'qwen-image', 'zimage']) expect(readerOfFamily(family), family).toBe('t5');
    expect(readerOfFamily('unknown')).toBe('unknown');
  });
});
