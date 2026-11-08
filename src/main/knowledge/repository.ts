import type Database from 'better-sqlite3';
import type {
  Explanation,
  ExplanationInput,
  GraphCheckReport,
  ListExplanationsRequest,
  ModelDetail,
  ModelSummary,
  NodeClassDetail,
  NodeClassSummary,
  SearchModelsRequest,
  SearchNodesRequest,
} from '../../shared/contracts/knowledge';

/**
 * Knowledge repository contract. The KB workstream implements these against SQLite (migration v9).
 * Other main-process modules (agent tools, IPC) call only these functions.
 */
export function searchNodeClasses(_db: Database.Database, _request: SearchNodesRequest): NodeClassSummary[] {
  throw new Error('knowledge: searchNodeClasses is not implemented yet');
}

export function nodeClassDetail(_db: Database.Database, _classType: string): NodeClassDetail | null {
  throw new Error('knowledge: nodeClassDetail is not implemented yet');
}

export function searchModels(_db: Database.Database, _request: SearchModelsRequest): ModelSummary[] {
  throw new Error('knowledge: searchModels is not implemented yet');
}

export function modelDetail(_db: Database.Database, _directory: string, _name: string): ModelDetail | null {
  throw new Error('knowledge: modelDetail is not implemented yet');
}

export function listExplanations(_db: Database.Database, _request: ListExplanationsRequest): Explanation[] {
  throw new Error('knowledge: listExplanations is not implemented yet');
}

export function saveExplanation(_db: Database.Database, _input: ExplanationInput): Explanation {
  throw new Error('knowledge: saveExplanation is not implemented yet');
}

/** Checks the current projection of a project against the catalog. Never queues anything. */
export function checkGraph(_db: Database.Database, _projectId: string): GraphCheckReport {
  throw new Error('knowledge: checkGraph is not implemented yet');
}
