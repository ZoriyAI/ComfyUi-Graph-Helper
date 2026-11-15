/**
 * The output folder for e2e screenshots and logs that a person may want to open after a run.
 * Used by the e2e specs that save pictures (desktop, desktop-captures, workspace-motion, mcp-access, and others).
 * One folder keeps CI uploads simple: the workflow uploads it as a whole when a run fails.
 */
import * as fs from 'fs';
import * as path from 'path';

/**
 * Where e2e tests put screenshots and logs worth a look after a run: `test-results/artifacts` (ignored by git and
 * uploaded by CI on failure), or the folder named by TEST_ARTIFACTS.
 */
export const ARTIFACT_DIR = path.resolve(process.env.TEST_ARTIFACTS || path.join('test-results', 'artifacts'));

/** The path for one artifact file; the folder is created on first use. */
export function artifact(name: string): string {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  return path.join(ARTIFACT_DIR, name);
}
