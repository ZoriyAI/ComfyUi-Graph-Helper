/**
 * Which development and test switches this run may honour. Read by main/index.ts (dev server, the scripted
 * provider) and main/mcp/browser.ts (test switches). Every answer is no in an installed app, whatever the
 * environment says.
 */

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
 *
 * NODEWISE_PACKAGED_PROVIDERS=1 makes an unpackaged run offer exactly the providers an installed app offers. The
 * public screenshots (tests/e2e/public-shots, `npm run shots:public`) are taken from an unpackaged run and set it,
 * so Settings ▸ Assistant shows what a person who installed the app sees, without the TEST card. It can only take
 * the TEST provider away, never give it to an installed app.
 */
export function scriptedProviderAllowed(packaged: boolean, env: NodeJS.ProcessEnv = process.env): boolean {
  return !packaged && env.NODEWISE_PACKAGED_PROVIDERS !== '1';
}
