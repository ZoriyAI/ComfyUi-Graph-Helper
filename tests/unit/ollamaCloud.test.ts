/**
 * Ollama's cloud models on "Your own server": the name pattern (shared/config/ollamaCloud.ts) and every sentence the
 * window builds from it (the toolbar chip, the provider card and the list of what goes out in Settings ▸ Assistant,
 * the model picker, Settings ▸ Privacy, the conversation log). Such a model must never be called local: the
 * question and the graph leave the computer through Ollama.
 */
import { describe, expect, it } from 'vitest';
import { answerPlace, isOllamaCloudModel } from '../../src/shared/config/ollamaCloud';
import { providerCardDescriptionKey, providerNoteKey, sendsOutside, sentWhere } from '../../src/renderer/state/providerState';
import { modelSuggestions } from '../../src/renderer/components/settings/sections/pickerItems';
import { providerLabelKey } from '../../src/renderer/components/log/modelLogView';
import { createTranslator } from '../../src/shared/i18n';

describe('the Ollama cloud name pattern', () => {
  it('matches the cloud names', () => {
    for (const name of ['x:cloud', 'x-cloud', 'x:latest-cloud', 'org/x:cloud', 'gemma4:cloud', 'glm-5.3-flash:cloud', 'gpt-oss:120b-cloud', ' GEMMA4:Cloud ']) {
      expect(isOllamaCloudModel(name), name).toBe(true);
    }
  });

  it('leaves local names alone', () => {
    for (const name of ['cloudy:7b', 'x:8b', 'qwen3.5:9b', 'cloud', 'x:cloudy', 'x-cloudy', 'x:8b-cloudless', 'wordcloud:7b', '', '   ']) {
      expect(isOllamaCloudModel(name), name).toBe(false);
    }
  });

  it('places a cloud name on your own server outside the computer, whatever else is chosen', () => {
    expect(answerPlace('local', 'gemma4:cloud')).toBe('ollama-cloud');
    expect(answerPlace('local', 'qwen3.5:9b')).toBe('local');
    expect(answerPlace('openai', 'gpt-x')).toBe('cloud');
    expect(answerPlace('compatible', 'gemma4')).toBe('cloud');
    expect(answerPlace('test', 'x:cloud')).toBe('test');
    expect(answerPlace('', '')).toBe('none');
  });
});

describe('what the window says about an Ollama cloud model', () => {
  const en = createTranslator('en');
  const ru = createTranslator('ru');
  const cloudSentence = /Ollama's cloud: your question and the graph leave this computer through Ollama/;

  it('the toolbar chip says it leaves the computer', () => {
    expect(providerNoteKey('local', 'none', 'gemma4:cloud')).toBe('provider.localCloud');
    expect(providerNoteKey('local', 'none', 'qwen3.5:9b')).toBe('provider.local');
    expect(providerNoteKey('local', 'none')).toBe('provider.local');
    expect(en('provider.localCloud')).toMatch(cloudSentence);
    expect(ru('provider.localCloud')).toContain('уходят с этого компьютера через Ollama');
  });

  it('the card of your own server says it, and the list of what goes out is shown', () => {
    expect(providerCardDescriptionKey('local', 'gemma4:cloud')).toBe('preferences.providerDesc.localCloud');
    expect(providerCardDescriptionKey('local', 'qwen3.5:9b')).toBe('preferences.providerDesc.local');
    expect(providerCardDescriptionKey('', '')).toBe('preferences.providerDesc.none');
    expect(providerCardDescriptionKey('openai', 'x:cloud')).toBe('preferences.providerDesc.openai');
    expect(en('preferences.providerDesc.localCloud')).toMatch(cloudSentence);
    expect(sendsOutside('local', 'gemma4:cloud')).toBe(true);
    expect(sendsOutside('local', 'qwen3.5:9b')).toBe(false);
    expect(sendsOutside('anthropic', '')).toBe(true);
    expect(sendsOutside('test', '')).toBe(false);
    expect(en('providers.ollamaCloud', { model: 'gemma4:cloud' })).toBe('The model “gemma4:cloud” runs in Ollama\'s cloud, not on this computer. Your question and the graph leave this computer through Ollama, and Ollama bills you for the use. The request still goes to the address above.');
    expect(ru('providers.ollamaCloud', { model: 'gemma4:cloud' })).toContain('«gemma4:cloud» работает в облаке Ollama');
    expect(en('providers.localCloudNames')).toContain('“:cloud” or “-cloud”');
  });

  it('the model picker marks a cloud model on your own server only', () => {
    const t = createTranslator('en');
    const rows = modelSuggestions([{ id: 'gemma4:cloud' }, { id: 'qwen3.5:9b' }], t, true);
    expect(rows[0].badges?.map((badge) => badge.text)).toContain("Ollama's cloud");
    expect(rows[1].badges ?? []).toEqual([]);
    expect(modelSuggestions([{ id: 'x:cloud' }], t)[0].badges ?? []).toEqual([]);
  });

  it('Settings ▸ Privacy says where a question goes now', () => {
    const cloud = sentWhere('local', 'gemma4:cloud');
    expect(cloud.key).toBe('preferences.sentWhere.ollamaCloud');
    expect(en(cloud.key, cloud.values)).toBe('Now the model “gemma4:cloud” runs in Ollama\'s cloud: your question and the graph leave this computer through Ollama, although the address is your own server.');
    expect(ru(cloud.key, cloud.values)).toContain('«gemma4:cloud»');
    expect(sentWhere('local', 'qwen3.5:9b').key).toBe('preferences.sentWhere.local');
    const openai = sentWhere('openai', 'gpt-x');
    expect(en(openai.key, openai.values)).toBe('Now it goes to OpenAI, outside this computer.');
    expect(sentWhere('compatible', 'x').key).toBe('preferences.sentWhere.compatible');
    expect(sentWhere('test', '').key).toBe('preferences.sentWhere.test');
    expect(sentWhere('', '').key).toBe('preferences.sentWhere.none');
    for (const key of ['none', 'test', 'local', 'ollamaCloud', 'cloud', 'compatible']) {
      const full = `preferences.sentWhere.${key}`;
      expect(en(full, { model: 'm', provider: 'P' }), full).not.toBe(full);
      expect(ru(full, { model: 'm', provider: 'P' }), full).not.toBe(full);
    }
  });

  it('the conversation log names it as Ollama\'s cloud, not a local model', () => {
    expect(providerLabelKey('local', 'gemma4:cloud')).toBe('modelLog.provider.localCloud');
    expect(providerLabelKey('local', 'qwen3.5:9b')).toBe('modelLog.provider.local');
    expect(en('modelLog.provider.localCloud')).toBe("Ollama's cloud through your own server");
    expect(ru('modelLog.provider.localCloud')).toBe('облако Ollama через ваш сервер');
  });
});
