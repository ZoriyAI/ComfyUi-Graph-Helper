import type Database from 'better-sqlite3';
import { readPreferences } from '../settings/repository';
import { applyProxy, fetchIfProxied, internetFetch } from '../net/proxy';
import { configureSearchTransport, configureTransport, mainLLMService } from '../llmService';

/**
 * The network side of the providers: cloud model requests (and the model lists, the connection check and the
 * conversation log's recording) go through the proxy-aware fetch, and the proxy follows Settings ▸ Assistant ▸
 * Proxy. Called once at start and after every settings save.
 */
export async function applyNetworkSettings(db: Database.Database): Promise<void> {
  configureTransport(internetFetch);
  configureSearchTransport(fetchIfProxied);
  let typed = '';
  try {
    const network = readPreferences(db).network;
    typed = network.proxy;
    mainLLMService.setOpenAiAccount({ organization: network.openaiOrganization, project: network.openaiProject });
  } catch {
    typed = '';
  }
  await applyProxy(typed);
}
