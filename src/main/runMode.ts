/**
 * Whether this run is a development run: only an unpackaged app (`electron .` from the repository) started with
 * NODE_ENV=development. An installed app never loads the Vite dev server or opens DevTools, whatever the environment
 * says: a variable exported for another project must not make localhost:5173 the trusted app page.
 */
export function isDevelopmentRun(packaged: boolean, env: NodeJS.ProcessEnv = process.env): boolean {
  return !packaged && env.NODE_ENV === 'development';
}

/** Test-only switches (environment variables meant for the e2e build) are honoured only in an unpackaged app. */
export function testSwitchesAllowed(packaged: boolean, env: NodeJS.ProcessEnv = process.env): boolean {
  return !packaged && env.NODE_ENV === 'test';
}

/**
 * The scripted TEST provider (testLLMTransport.ts) answers with canned text: offered and accepted only in an
 * unpackaged app (development and the e2e suite, which runs the built files with Electron). An installed app refuses
 * it even when an old profile has it saved.
 */
export function scriptedProviderAllowed(packaged: boolean): boolean {
  return !packaged;
}
