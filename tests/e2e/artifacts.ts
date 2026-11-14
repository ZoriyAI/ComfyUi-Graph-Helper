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
