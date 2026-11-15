/**
 * TEST fixture: a forwarding proxy in front of a fake MCP server (tests/fixtures/mcp/fakeMcpServer.ts) that can
 * misbehave on purpose, the way a busy or half-broken server does: delay every request, delay, drop, refuse or
 * replace single tool calls, or refuse every connection. Plain `http` on 127.0.0.1; nothing leaves the machine.
 *
 * A rule matches a JSON-RPC method (`tools/list`), a tool (`models`), or a tool with its first telling argument
 * (`models:loras`, `studio_capabilities:nodes`): the `section`, else `category`, else `action`.
 * Used by syncAddress.test.ts (integration) to make one model folder fail or a run hang while the address changes.
 */
import * as http from 'http';
import type { AddressInfo } from 'net';

/** One misbehaviour; the first rule that matches a request applies, `*` matches every request. */
export interface McpProxyRule {
  match: string;
  /** Wait this long before forwarding or answering. */
  delayMs?: number;
  /** Answer with this JSON-RPC `result` instead of forwarding. */
  result?: unknown;
  /** Answer with this HTTP status and an empty body. */
  status?: number;
  /** Close the connection without an answer. */
  drop?: boolean;
}

/** A running proxy. A test changes `state` while it runs to switch misbehaviour on and off. */
export interface McpProxy {
  /** The proxied MCP endpoint (same path as the target). */
  url: string;
  state: {
    rules: McpProxyRule[];
    /** Refuse every request by closing the socket (the server went away). */
    down: boolean;
    /** Delay every request by this much. */
    delayMs: number;
    /** Every request as its match key, in order. */
    log: string[];
  };
  close: () => Promise<void>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The match key of a JSON-RPC body: the method, or `tool:argument` for a tool call. */
export function requestKey(body: string): string {
  try {
    const message = JSON.parse(body) as { method?: string; params?: { name?: string; arguments?: Record<string, unknown> } };
    if (message.method !== 'tools/call') return message.method ?? '';
    const args = message.params?.arguments ?? {};
    return `${message.params?.name}:${String(args.section ?? args.category ?? args.action ?? '')}`;
  } catch {
    return '';
  }
}

/** Starts a proxy on a free 127.0.0.1 port that forwards to the MCP endpoint `target` unless a rule says otherwise. */
export async function startMcpProxy(target: string): Promise<McpProxy> {
  const to = new URL(target);
  const state: McpProxy['state'] = { rules: [], down: false, delayMs: 0, log: [] };
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', async () => {
      const body = Buffer.concat(chunks);
      if (state.down) {
        req.socket.destroy();
        return;
      }
      if (state.delayMs) await sleep(state.delayMs);
      const key = requestKey(body.toString('utf8'));
      state.log.push(key);
      const rule = state.rules.find((item) => item.match === '*' || key === item.match || key.startsWith(`${item.match}:`));
      if (rule) {
        if (rule.delayMs) await sleep(rule.delayMs);
        if (rule.drop) {
          req.socket.destroy();
          return;
        }
        if (rule.status) {
          res.writeHead(rule.status);
          res.end();
          return;
        }
        if (rule.result !== undefined) {
          const id = (JSON.parse(body.toString('utf8')) as { id?: unknown }).id;
          const headers: Record<string, string> = { 'content-type': 'application/json' };
          if (req.headers['mcp-session-id']) headers['mcp-session-id'] = String(req.headers['mcp-session-id']);
          res.writeHead(200, headers);
          res.end(JSON.stringify({ jsonrpc: '2.0', id, result: rule.result }));
          return;
        }
      }
      const forward = http.request({ host: to.hostname, port: to.port, path: req.url, method: req.method, headers: req.headers }, (upstream) => {
        res.writeHead(upstream.statusCode ?? 502, upstream.headers);
        upstream.pipe(res);
      });
      forward.on('error', () => {
        if (!res.headersSent) res.writeHead(502);
        res.end();
      });
      forward.end(body);
    });
  });
  const port = await new Promise<number>((resolve) => server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)));
  return {
    url: `http://127.0.0.1:${port}${to.pathname}`,
    state,
    close: () => new Promise<void>((resolve) => {
      server.closeAllConnections?.();
      server.close(() => resolve());
    }),
  };
}

/** A JSON-RPC tool result whose text is `value` as JSON, the way the fake server answers. */
export function toolText(value: unknown, isError = false): unknown {
  return { content: [{ type: 'text', text: JSON.stringify(value) }], isError };
}
