/** The configured agent reads real templates and modifies its own independent native copies. */
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migrate } from '../../src/main/settings/migrate';
import { commitCommand, ensureWorkspace, readProjection, startRun } from '../../src/main/commands/commit';
import { createAgentTools, type AgentToolDefinition } from '../../src/main/agent/tools';
import { createBuildTools } from '../../src/main/agent/buildTools';
import { BUILD_TOOL_SPECS } from '../../src/shared/commands/toolSpecs';
import { readCatalog } from '../../src/main/catalog/repository';
import { runOwned } from '../../src/main/agent/ownership';
const P = 'desktop';
function setup() { const db = new Database(':memory:'); migrate(db); ensureWorkspace(db); const read = () => readProjection(db,P)!; return {db,read}; }
describe('guided blueprint agent', () => {
  it('searches all templates, reads the actual typed inner graph, and reports missing ids', async () => {
    const { db, read } = setup();
    const tools = createAgentTools({db,projectId:P,runId:null,revision:read().currentRevisionId,toolContext:()=>({catalog:readCatalog(db)})}) as Record<string,AgentToolDefinition>;
    const result = await tools.searchBlueprints.execute({query:'',limit:50}) as any; expect(result.total).toBe(115); expect(result.nextOffset).toBe(50);
    const frame = await tools.inspectBlueprint.execute({templateId:'get_any_video_frame'}) as any; expect(frame.success).toBe(true); expect(frame.definitions[0].inputs.map((p:any)=>p.type)).toContain('VIDEO'); expect(frame.nodes.length).toBe(5);
    expect(await tools.inspectBlueprint.execute({templateId:'not-a-template'})).toMatchObject({success:false}); db.close();
  });
  it('builds an independent copy, edits its inner namespace, and protects the teacher’s existing graph', async () => {
    const { db, read } = setup();
    const user = commitCommand(db,{projectId:P,actionId:'teacher',expectedRevisionId:read().currentRevisionId,actor:'manual',runId:null,payload:{type:'create-subgraph',name:'Teacher original',nodeIds:[],inputs:[],outputs:[]}}); const teacherId = (user.result as any).definitionId;
    const run = startRun(db,P); const tools = createBuildTools(BUILD_TOOL_SPECS,{db,run:{projectId:P,runId:run.runId,expectedRevisionId:run.expectedRevisionId},toolContext:()=>({snapshot:read().snapshot as never,catalog:readCatalog(db)})});
    expect(await tools.insertBlueprint.execute({templateId:'get_any_video_frame',inSubgraph:teacherId})).toMatchObject({success:false});
    const added = await tools.insertBlueprint.execute({templateId:'image_outpainting_qwen_image',name:'Student variation',why:'Study a separate editable copy.'}) as any; expect(added.success).toBe(true); expect(added.definitionIds).toHaveLength(3);
    expect(runOwned(db,P,run.runId).definitions.size).toBe(3);
    const changed = await tools.addNode.execute({nodeType:'Note',inSubgraph:added.definitionId,title:'Practice note'}) as any; expect(changed.success).toBe(true);
    expect((read().snapshot.subgraphs!.find((d)=>d.id===teacherId)!.nodes)).toHaveLength(0);
    const reads = createAgentTools({db,projectId:P,runId:run.runId,revision:read().currentRevisionId}) as Record<string,AgentToolDefinition>;
    expect(await reads.getGraph.execute({definitionId:added.definitionId,limit:50})).toMatchObject({success:true,definitionId:added.definitionId}); db.close();
  });
});
