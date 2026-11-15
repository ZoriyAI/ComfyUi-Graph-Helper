import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { ExtensionDrafts } from '../../src/main/extensions/drafts';
import { OLLAMA_STARTER } from '../../src/main/extensions/ollamaStarter';
import { createExtensionDraftTool } from '../../src/main/agent/extensionDraftTool';

describe('reviewable custom extension packages', () => {
  it('exports an intact readable ZIP, bounded volatile drafts and no code execution', async () => {
    const store = new ExtensionDrafts(); const draft = store.add(OLLAMA_STARTER, 'starter');
    const checked = spawnSync('python3', ['-c', 'import sys,io,zipfile,base64,json\nz=zipfile.ZipFile(io.BytesIO(base64.b64decode(sys.stdin.read())))\nassert z.testzip() is None\nassert json.loads(z.read("nodewise_ollama/nodewise-extension.json"))["verification"] == "source-only"\nprint(json.dumps(z.namelist()))'], { input: draft.archiveBase64, encoding: 'utf8' });
    expect(checked.status, checked.stderr).toBe(0); expect(JSON.parse(checked.stdout)).toContain('nodewise_ollama/nodes.py');
    for (let i = 0; i < 12; i++) store.add(OLLAMA_STARTER); expect(store.get(draft.id)).toBeNull();
    const controller = new AbortController(); controller.abort(); expect(await createExtensionDraftTool(controller.signal, store).execute(OLLAMA_STARTER)).toMatchObject({ success: false });
    expect(await createExtensionDraftTool(undefined, store).execute(OLLAMA_STARTER)).toMatchObject({ success: true, verification: 'source-only' });
  });
  it('rejects traversal, case collisions, missing registration and oversized sources', () => {
    const store = new ExtensionDrafts();
    for (const path of ['../escape.py', '/tmp/source.py', 'a/../x.py', 'a//x.py', 'README.md', 'nodewise-extension.json']) expect(() => store.add({ ...OLLAMA_STARTER, files: [...OLLAMA_STARTER.files, { path, content: '' }] })).toThrow();
    expect(() => store.add({ ...OLLAMA_STARTER, files: OLLAMA_STARTER.files.filter((f) => f.path !== 'nodes.py') })).toThrow(/registration/);
    expect(() => store.add({ ...OLLAMA_STARTER, files: [...OLLAMA_STARTER.files, ...Array.from({ length: 8 }, (_, i) => ({ path: `big${i}.py`, content: 'x'.repeat(40000) }))] })).toThrow(/256/);
  });
  it('compiles owned starter Python and checks all schemas/chat/embed/cosine contracts offline without optional imports', () => {
    const source = OLLAMA_STARTER.files.find((f) => f.path === 'nodes.py')!.content;
    const checked = spawnSync('python3', ['-c', String.raw`import sys,json,math
source=sys.stdin.read()
scope={}
exec(compile(source,"nodewise_ollama/nodes.py","exec"),scope)
classes=scope["NODE_CLASS_MAPPINGS"]
assert len(classes)==4
for cls in classes.values():
    assert cls.INPUT_TYPES()["required"]
    assert hasattr(cls,cls.FUNCTION)
assert "PIL" not in sys.modules and "torch" not in sys.modules and "numpy" not in sys.modules
calls=[]
def fake(base,endpoint,payload):
    calls.append((base,endpoint,payload))
    if endpoint=="/api/embed": return {"embeddings":[[1.0,0.0]]}
    return {"message":{"content":"A clear prompt"},"done":True}
scope["post"]=fake
assert classes["NodeWiseOllamaChat"]().run("text","system","test:tag","http://localhost:11434","0")==("A clear prompt",)
assert calls[-1][1]=="/api/chat" and calls[-1][2]["stream"] is False
assert calls[-1][2]["keep_alive"]=="0"
emb=classes["NodeWiseOllamaEmbeddings"]().run("hello","embed:tag","http://localhost:11434","0")
assert emb[0]==[[1.0,0.0]] and json.loads(emb[1])==emb[0]
assert calls[-1][1]=="/api/embed" and calls[-1][2]["truncate"] is False
cos=classes["NodeWiseEmbeddingCosine"]()
assert cos.run([[1.,0.]],[[0.,1.]])==(0.,)
assert cos.run([[1.,0.]],[[1.,0.]])==(1.,)
for a,b in [([[0.,0.]],[[1.,0.]]),([[1.]],[[1.,2.]]),([[math.nan]],[[1.]])]:
    try: cos.run(a,b); raise AssertionError("invalid vectors accepted")
    except ValueError: pass
scope["post"]=lambda *args: {"embeddings":[[math.nan]]}
try: classes["NodeWiseOllamaEmbeddings"]().run("x","m","http://localhost","0"); raise AssertionError("NaN accepted")
except ValueError: pass
print("4 native schemas and offline chat/embed/cosine contracts passed; no model execution")
`], { input: source, encoding: 'utf8' });
    expect(checked.status, checked.stderr).toBe(0); expect(checked.stdout).toContain('4 native schemas');
  });
});
