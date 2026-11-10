import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdownLite } from '../../src/renderer/components/chat/markdownLite';
import {
  chatRecordFromMessage,
  INTERRUPTED_ERROR,
  messageFromChatRecord,
  newToolCall,
  parseToolArgs,
  SAVED_RESULT_CAP,
  settleFromResult,
  toolKind,
  turnLanguage,
  withResultIds,
} from '../../src/renderer/services/llm/chatModel';
import { buildTargetRef, compactArgs, resultMessage, toolLabelKey } from '../../src/renderer/components/chat/toolPresentation';
import { objectLabel } from '../../src/renderer/components/chat/objectLabel';
import { checkFindingCount, findingNodeIds, groupCheckReport, nodeNamer } from '../../src/renderer/components/check/checkModel';
import { groupByAspect, isStale, missingAspects, recentExplanations, safeSourceUrl } from '../../src/renderer/components/explain/explainModel';
import {
  AGENT_BUILD_TOOLS,
  AGENT_KNOWLEDGE_TOOLS,
  AGENT_PROPOSAL_TOOLS,
  AGENT_READ_TOOLS,
  type Explanation,
  type GraphCheckReport,
} from '../../src/shared/contracts';
import { en, ru } from '../../src/shared/i18n';
import type { ChatMessage } from '../../src/renderer/types/chat';

describe('markdown-lite', () => {
  it('splits paragraphs, keeps line breaks, and reads inline code and bold', () => {
    const blocks = parseMarkdownLite('First line\nsecond line\n\nUse `KSampler` with **care**.');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ type: 'paragraph', lines: [[{ type: 'text', text: 'First line' }], [{ type: 'text', text: 'second line' }]] });
    expect(blocks[1]).toEqual({
      type: 'paragraph',
      lines: [[
        { type: 'text', text: 'Use ' },
        { type: 'code', text: 'KSampler' },
        { type: 'text', text: ' with ' },
        { type: 'strong', text: 'care' },
        { type: 'text', text: '.' },
      ]],
    });
  });

  it('reads bullet and numbered lists, and continues an item on an indented line', () => {
    const blocks = parseMarkdownLite('Steps:\n1. Load\n2. Sample\n   slowly\n- a\n- b');
    expect(blocks.map((block) => block.type)).toEqual(['paragraph', 'list', 'list']);
    const numbered = blocks[1];
    expect(numbered.type === 'list' && numbered.ordered).toBe(true);
    expect(numbered.type === 'list' && numbered.items[1]).toEqual([{ type: 'text', text: 'Sample slowly' }]);
    const bullets = blocks[2];
    expect(bullets.type === 'list' && !bullets.ordered && bullets.items.length).toBe(2);
  });

  it('keeps fenced code verbatim, also while the fence is still open during streaming', () => {
    expect(parseMarkdownLite('```\n<b>x</b>\n  y\n```')).toEqual([{ type: 'code', text: '<b>x</b>\n  y' }]);
    expect(parseMarkdownLite('Look:\n```\npartial')).toEqual([
      { type: 'paragraph', lines: [[{ type: 'text', text: 'Look:' }]] },
      { type: 'code', text: 'partial' },
    ]);
  });

  it('treats markup as text', () => {
    expect(parseInline('<img src=x onerror=alert(1)>')).toEqual([{ type: 'text', text: '<img src=x onerror=alert(1)>' }]);
    expect(parseMarkdownLite('')).toEqual([]);
  });

  // A model writes headings, tables and emphasis whether asked to or not; raw, they are "##" and "|" in an answer.
  it('reads headings, rules and quotes instead of showing their marks', () => {
    const blocks = parseMarkdownLite('## Что делает нода ##\ntext\n\n---\n> осторожно\n> с VAE\n\n#### deep');
    expect(blocks).toEqual([
      { type: 'heading', level: 2, tokens: [{ type: 'text', text: 'Что делает нода' }] },
      { type: 'paragraph', lines: [[{ type: 'text', text: 'text' }]] },
      { type: 'rule' },
      { type: 'quote', lines: [[{ type: 'text', text: 'осторожно' }], [{ type: 'text', text: 'с VAE' }]] },
      { type: 'heading', level: 3, tokens: [{ type: 'text', text: 'deep' }] },
    ]);
    // A hash without a space is a tag or a number, not a heading; a row of dashes after a bullet is a bullet.
    expect(parseMarkdownLite('#1 in the list')[0].type).toBe('paragraph');
  });

  it('reads a table, pads short rows and keeps a line with bars a line', () => {
    const blocks = parseMarkdownLite('| Поле | Значение | Зачем |\n|---|:---:|---|\n| steps | 20 | качество |\n| cfg | 8 |\nпосле');
    expect(blocks.map((block) => block.type)).toEqual(['table', 'paragraph']);
    const table = blocks[0];
    if (table.type !== 'table') throw new Error('not a table');
    expect(table.header.map((cell) => cell[0])).toEqual([{ type: 'text', text: 'Поле' }, { type: 'text', text: 'Значение' }, { type: 'text', text: 'Зачем' }]);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[1]).toEqual([[{ type: 'text', text: 'cfg' }], [{ type: 'text', text: '8' }], []]);
    expect(parseMarkdownLite('a | b | c')[0].type).toBe('paragraph');
    expect(parseMarkdownLite('| a | b |\nno dashes')[0].type).toBe('paragraph');
  });

  it('reads emphasis and leaves arithmetic and names with underscores alone', () => {
    expect(parseInline('это *важно* и _тоже_')).toEqual([
      { type: 'text', text: 'это ' }, { type: 'em', text: 'важно' }, { type: 'text', text: ' и ' }, { type: 'em', text: 'тоже' },
    ]);
    expect(parseInline('512 * 768 * 2')).toEqual([{ type: 'text', text: '512 * 768 * 2' }]);
    expect(parseInline('поля lora_name и strength_model')).toEqual([{ type: 'text', text: 'поля lora_name и strength_model' }]);
    expect(parseInline('__жирно__ и **тоже**')).toEqual([{ type: 'strong', text: 'жирно' }, { type: 'text', text: ' и ' }, { type: 'strong', text: 'тоже' }]);
    expect(parseInline('в `a * b * c` звёзды остаются')).toEqual([{ type: 'text', text: 'в ' }, { type: 'code', text: 'a * b * c' }, { type: 'text', text: ' звёзды остаются' }]);
  });

  it('keeps a link as words and address: the chat opens nothing', () => {
    expect(parseInline('см. [документацию](https://docs.comfy.org/x) здесь')).toEqual([{ type: 'text', text: 'см. документацию (https://docs.comfy.org/x) здесь' }]);
    expect(parseInline('[https://a.b/c](https://a.b/c)')).toEqual([{ type: 'text', text: 'https://a.b/c' }]);
  });
});

describe('tool classification', () => {
  it('maps every agent tool to its family and anything else to other', () => {
    for (const name of AGENT_READ_TOOLS) expect(toolKind(name)).toBe('read');
    for (const name of AGENT_KNOWLEDGE_TOOLS) expect(toolKind(name)).toBe('knowledge');
    for (const name of AGENT_PROPOSAL_TOOLS) expect(toolKind(name)).toBe('proposal');
    for (const name of AGENT_BUILD_TOOLS) expect(toolKind(name)).toBe('build');
    expect(toolKind('somethingElse')).toBe('other');
  });

  it('has an English and a Russian label for every agent tool', () => {
    const all = [...AGENT_READ_TOOLS, ...AGENT_KNOWLEDGE_TOOLS, ...AGENT_PROPOSAL_TOOLS, ...AGENT_BUILD_TOOLS];
    for (const name of all) {
      expect(toolLabelKey(name)).toBe(`agent.tools.${name}`);
      expect((en.agent.tools as Record<string, string>)[name]).toBeTruthy();
      expect((ru.agent.tools as Record<string, string>)[name]).toBeTruthy();
    }
    expect(toolLabelKey('nope')).toBeNull();
  });

  it('settles results and copies proposal and explanation ids', () => {
    expect(settleFromResult({ success: false, error: 'Missing nodeType' })).toEqual({ status: 'error', error: 'Missing nodeType' });
    expect(settleFromResult({ success: true })).toEqual({ status: 'success' });
    expect(settleFromResult('plain')).toEqual({ status: 'success' });
    const proposal = withResultIds({ ...newToolCall('c1', 'proposeNode'), status: 'success', result: { success: true, proposalId: 'p-1' } });
    expect(proposal.proposalId).toBe('p-1');
    const explain = withResultIds({ ...newToolCall('c2', 'explain'), status: 'success', result: { explanationId: 'e-1' } });
    expect(explain.explanationId).toBe('e-1');
    const failed = withResultIds({ ...newToolCall('c3', 'proposeNode'), status: 'error', result: { proposalId: 'p-2' } });
    expect(failed.proposalId).toBeUndefined();
  });

  it('reads arguments from an object or a JSON string', () => {
    expect(parseToolArgs({ a: 1 })).toEqual({ a: 1 });
    expect(parseToolArgs('{"nodeType":"KSampler"}')).toEqual({ nodeType: 'KSampler' });
    expect(parseToolArgs('not json')).toEqual({});
    expect(parseToolArgs(undefined)).toEqual({});
  });

  it('summarises arguments and outcomes compactly and redacts secret-shaped text', () => {
    const args = compactArgs({ nodeType: 'KSampler', note: 'long note', x: 10, empty: '', key: 'sk-proj-AbC123_def-GHI456' }, ['note']);
    expect(args).toEqual([
      { key: 'nodeType', value: 'KSampler' },
      { key: 'x', value: '10' },
      { key: 'key', value: '[redacted]' },
    ]);
    expect(compactArgs({ text: 'x'.repeat(200) })[0].value.length).toBeLessThanOrEqual(80);
    const ok = { ...newToolCall('c', 'addNode'), status: 'success' as const, result: { success: true, message: 'Added KSampler node', nodeId: 'n1' } };
    expect(resultMessage(ok)).toBe('Added KSampler node');
    expect(buildTargetRef(ok)).toEqual({ kind: 'node', id: 'n1' });
    const connect = { ...newToolCall('c', 'connectNodes'), status: 'success' as const, result: { edgeId: 'e1' } };
    expect(buildTargetRef(connect)).toEqual({ kind: 'edge', id: 'e1' });
    expect(buildTargetRef({ ...newToolCall('c', 'removeNode', { nodeId: 'n1' }), status: 'success' })).toBeNull();
    expect(buildTargetRef({ ...newToolCall('c', 'getGraph'), status: 'success' })).toBeNull();
    const failed = { ...newToolCall('c', 'addNode'), status: 'error' as const, error: 'Bearer sk-live-token rejected' };
    expect(resultMessage(failed)).not.toContain('sk-live');
  });

  it('reads the turn language from i18next', () => {
    expect(turnLanguage('ru')).toBe('ru');
    expect(turnLanguage('ru-RU')).toBe('ru');
    expect(turnLanguage('en')).toBe('en');
    expect(turnLanguage(undefined)).toBe('en');
  });
});

describe('ChatRecord mapping', () => {
  const message: ChatMessage = {
    id: 'msg-1',
    role: 'assistant',
    content: 'Done',
    timestamp: 1700000000000.7,
    toolCalls: [
      { ...newToolCall('call-1', 'proposeNode', { nodeType: 'KSampler', note: 'why' }), status: 'success', result: { success: true, proposalId: 'p-1', message: 'ok' }, proposalId: 'p-1' },
      { ...newToolCall('call-2', 'getGraph'), status: 'success', result: { success: true, message: 'graph', nodes: 'x'.repeat(SAVED_RESULT_CAP * 2) } },
    ],
  };

  it('maps a message to a record with the revision and compact tool calls', () => {
    const record = chatRecordFromMessage(message, 'project-1', 'rev-9');
    expect(record).toMatchObject({ id: 'msg-1', projectId: 'project-1', role: 'assistant', content: 'Done', timestamp: 1700000000000, graphRevisionId: 'rev-9' });
    expect(record.toolCalls).toHaveLength(2);
    const [proposal, read] = record.toolCalls as Array<Record<string, unknown>>;
    expect(proposal).toMatchObject({ id: 'call-1', toolName: 'proposeNode', kind: 'proposal', status: 'success', proposalId: 'p-1' });
    expect(read.result).toEqual({ success: true, message: 'graph', truncated: true });
    expect(chatRecordFromMessage({ id: 'u', role: 'user', content: 'hi', timestamp: 1 }, 'p', null)).toMatchObject({ toolCalls: null, graphRevisionId: null });
  });

  it('maps a record back, restoring kinds and ids, and shows calls saved while pending as failed', () => {
    const record = chatRecordFromMessage(message, 'project-1', 'rev-9');
    const back = messageFromChatRecord(record);
    expect(back.graphRevisionId).toBe('rev-9');
    expect(back.toolCalls?.[0]).toMatchObject({ id: 'call-1', name: 'proposeNode', toolName: 'proposeNode', kind: 'proposal', status: 'success', proposalId: 'p-1', args: { nodeType: 'KSampler', note: 'why' } });
    const pending = messageFromChatRecord({ ...record, toolCalls: [{ id: 'x', toolName: 'addNode', status: 'pending' }, 'junk', { nope: true }] });
    expect(pending.toolCalls).toHaveLength(1);
    expect(pending.toolCalls?.[0]).toMatchObject({ status: 'error', kind: 'build', error: INTERRUPTED_ERROR });
  });
});

describe('object labels', () => {
  const graph = {
    nodes: [
      { id: 'n1', data: { title: 'Loader', comfyType: 'CheckpointLoaderSimple', inputs: [], outputs: [{ id: 'out-0', name: 'MODEL' }] } },
      { id: 'n2', data: { comfyType: 'KSampler', inputs: [{ id: 'in-0', name: 'model' }] } },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
  };
  it('names nodes, ports, edges, classes, models and the process', () => {
    expect(objectLabel({ kind: 'node', id: 'n1' }, graph, 'This graph')).toBe('Loader');
    expect(objectLabel({ kind: 'node', id: 'n2' }, graph, 'This graph')).toBe('KSampler');
    expect(objectLabel({ kind: 'node', id: 'gone', classType: 'VAEDecode' }, graph, 'This graph')).toBe('VAEDecode');
    expect(objectLabel({ kind: 'port', id: 'p', nodeId: 'n2', portName: 'in-0', direction: 'input' }, graph, '')).toBe('KSampler · model');
    expect(objectLabel({ kind: 'port', id: 'p', nodeId: 'n1', portName: 'out-0', direction: 'output' }, graph, '')).toBe('Loader · MODEL');
    expect(objectLabel({ kind: 'edge', id: 'e1' }, graph, '')).toBe('Loader → KSampler');
    expect(objectLabel({ kind: 'nodeClass', id: 'KSampler' }, graph, '')).toBe('KSampler');
    expect(objectLabel({ kind: 'model', id: 'loras/detail.safetensors' }, graph, '')).toBe('detail.safetensors');
    expect(objectLabel({ kind: 'process', id: 'process' }, graph, 'This graph')).toBe('This graph');
  });
});

describe('check report grouping', () => {
  const empty: GraphCheckReport = {
    ok: true, missingNodes: [], missingModels: [], typeMismatches: [], baseModelMismatches: [], unconnectedRequiredInputs: [], unknownNodeTypes: [],
  };

  it('is empty and zero for a clean report', () => {
    expect(groupCheckReport(empty)).toEqual([]);
    expect(checkFindingCount(empty)).toBe(0);
    expect(checkFindingCount(null)).toBe(0);
  });

  it('groups findings by type in report order with the object each one focuses', () => {
    const report: GraphCheckReport = {
      ok: false,
      missingNodes: [{ nodeId: 'n1', classType: 'Fancy' }],
      missingModels: [{ nodeId: 'n2', directory: 'checkpoints', name: 'a.safetensors' }],
      typeMismatches: [{ edgeId: 'e1', source: 'n1', target: 'n2', sourceType: 'IMAGE', targetType: 'LATENT' }],
      baseModelMismatches: [{ nodeId: 'n3', model: 'l.safetensors', modelBase: 'sdxl', otherNodeId: 'n2', otherModel: 'a.safetensors', otherBase: 'flux1' }],
      unconnectedRequiredInputs: [{ nodeId: 'n4', input: 'model', type: 'MODEL' }],
      unknownNodeTypes: ['Mystery'],
    };
    const groups = groupCheckReport(report, (nodeId, input) => (nodeId === 'n4' && input === 'model' ? 'in-0' : undefined));
    expect(groups.map((group) => group.type)).toEqual([
      'missingNodes', 'missingModels', 'typeMismatches', 'baseModelMismatches', 'unconnectedRequiredInputs', 'unknownNodeTypes',
    ]);
    expect(groups.every((group) => group.titleKey === `check.${group.type}`)).toBe(true);
    const refs = groups.map((group) => group.findings[0].ref);
    expect(refs[0]).toEqual({ kind: 'node', id: 'n1', classType: 'Fancy' });
    expect(refs[2]).toEqual({ kind: 'edge', id: 'e1' });
    expect(refs[4]).toEqual({ kind: 'port', id: 'n4:in-0', nodeId: 'n4', portName: 'in-0', direction: 'input' });
    expect(refs[5]).toEqual({ kind: 'nodeClass', id: 'Mystery', classType: 'Mystery' });
    expect(groups[0].findings[0].textKey).toBe('check.missingNodesItem');
    expect(checkFindingCount(report)).toBe(6);
    // Without a graph the sentences fall back to the node type, then to the id.
    expect(groups[0].findings[0].values.node).toBe('Fancy');
    expect(groups[2].findings[0].values).toMatchObject({ source: 'n1', target: 'n2', sourceId: 'n1', targetId: 'n2' });
    // With one, every kind of finding names its nodes by title and keeps the ids for the tooltip.
    const named = groupCheckReport(report, undefined, nodeNamer([
      { id: 'n1', data: { title: 'Load LoRA', comfyType: 'LoraLoader' } },
      { id: 'n2', data: { comfyType: 'KSampler' } },
      { id: 'n4', data: { title: 'Sampler', comfyType: 'KSampler' } },
    ]));
    expect(named[0].findings[0].values.node).toBe('Load LoRA');
    expect(named[1].findings[0].values.node).toBe('KSampler');
    expect(named[2].findings[0].values).toMatchObject({ source: 'Load LoRA', target: 'KSampler' });
    expect(named[4].findings[0].values.node).toBe('Sampler');
    expect(findingNodeIds(named[2].findings[0].values)).toEqual(['n1', 'n2']);
    expect(findingNodeIds(named[3].findings[0].values)).toEqual(['n3', 'n2']);
    // Every text key exists in both catalogs.
    for (const group of groups) {
      const leaf = group.findings[0].textKey.split('.')[1];
      expect((en.check as Record<string, string>)[leaf]).toBeTruthy();
      expect((ru.check as Record<string, string>)[leaf]).toBeTruthy();
    }
  });
});

describe('explanations', () => {
  const base: Explanation = {
    id: 'x', projectId: 'p', owner: { kind: 'node', id: 'n1' }, aspect: 'what', text: 't', provenance: 'inference',
    sourceUrl: null, revisionId: 'rev-1', createdBy: 'ai', createdAt: 1,
  };

  it('marks an explanation stale only when it names another revision', () => {
    expect(isStale(base, 'rev-1')).toBe(false);
    expect(isStale(base, 'rev-2')).toBe(true);
    expect(isStale({ revisionId: null }, 'rev-2')).toBe(false);
    expect(isStale(base, null)).toBe(false);
    expect(isStale(base, '')).toBe(false);
  });

  it('groups by aspect, newest first, and lists the aspects still missing', () => {
    const list = [
      { ...base, id: 'a', aspect: 'risk' as const, createdAt: 3 },
      { ...base, id: 'b', aspect: 'what' as const, createdAt: 1 },
      { ...base, id: 'c', aspect: 'what' as const, createdAt: 5 },
    ];
    const groups = groupByAspect(list);
    expect(groups.map((group) => group.aspect)).toEqual(['what', 'risk']);
    expect(groups[0].items.map((item) => item.id)).toEqual(['c', 'b']);
    expect(missingAspects(list)).toEqual(['why', 'connect', 'next']);
    expect(recentExplanations(list, 2).map((item) => item.id)).toEqual(['c', 'a']);
  });

  it('shows only http(s) sources', () => {
    expect(safeSourceUrl('https://example.com/a')).toBe('https://example.com/a');
    expect(safeSourceUrl('javascript:alert(1)')).toBeNull();
    expect(safeSourceUrl('file:///etc/passwd')).toBeNull();
    expect(safeSourceUrl(null)).toBeNull();
  });
});
