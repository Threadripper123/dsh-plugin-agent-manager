import { readdir, readFile, stat, mkdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  AGENT_ID_RE,
  agentPath,
  agentRoot,
  dataRoot,
  httpError,
  logFile
} from './paths.js';
import { parseFrontmatter, setDisabled, splitFrontmatter } from './frontmatter.js';
import { buildState, displayNameFor, professionFor } from './store.js';
import { loadTeams, teamMemberIds } from './teams.js';
import { createTrashEntry, listTrash, purgeTrash, restoreTrash } from './trash.js';
import { installFromMarket, listMarket, loadManifest } from './market.js';
import { writeAtomic } from './atomic.js';

export const name = 'agent-manager';
export const inject = ['connection'];

const API_PREFIX = '/api/dsh-plugin-agent-manager';
const MAX_BODY_BYTES = 2 * 1024 * 1024;

function json(status, payload, headOnly = false) {
  return new Response(headOnly ? null : JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function ok(data, headOnly = false) {
  return json(200, { ok: true, data }, headOnly);
}

function fail(err) {
  const status = Number.isInteger(err?.statusCode) ? err.statusCode : 500;
  return json(status, {
    ok: false,
    code: typeof err?.code === 'string' ? err.code : 'internal_error',
    error: String(err?.message || err)
  });
}

async function log(message) {
  try {
    await mkdir(dataRoot(), { recursive: true });
    await appendFile(logFile(), `[${new Date().toISOString()}] ${message}\n`, 'utf8');
  } catch {
    // logging must never break the request
  }
}

async function readAgentFiles() {
  const root = agentRoot();
  let entries = [];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const id = entry.name.slice(0, -3);
    if (!AGENT_ID_RE.test(id)) continue;
    const path = join(root, entry.name);
    try {
      const [text, info] = await Promise.all([readFile(path, 'utf8'), stat(path)]);
      files.push({ id, text, mtimeMs: info.mtimeMs, size: info.size });
    } catch {
      // skip unreadable files
    }
  }
  return files;
}

async function findTeam(id) {
  const teams = await loadTeams();
  return teams.find((team) => team.id === id || team.dir === id) || null;
}

async function assertWritableRequest(req) {
  if (req.headers.get('x-dsh-agent-manager') !== '1') {
    throw httpError(403, 'missing_marker', '缺少写操作标记头');
  }
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw httpError(415, 'unsupported_media_type', '写操作必须使用 application/json');
  }
}

async function readBody(req) {
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) {
    throw httpError(413, 'body_too_large', '请求体过大');
  }
  if (!text.trim()) throw httpError(400, 'empty_body', '请求体不能为空');
  try {
    return JSON.parse(text);
  } catch {
    throw httpError(400, 'invalid_json', '请求体不是合法 JSON');
  }
}

async function handleState() {
  return buildState(await readAgentFiles(), await loadTeams());
}

async function handleDetail(url) {
  const kind = url.searchParams.get('kind') || 'agent';
  const id = url.searchParams.get('id') || '';
  if (kind === 'team') {
    const team = await findTeam(id);
    if (!team) throw httpError(404, 'team_not_found', `找不到团队：${id}`);
    const agents = buildState(await readAgentFiles(), [team]).agents;
    const byId = new Map(agents.map((agent) => [agent.id, agent]));
    return {
      kind: 'team',
      team,
      members: teamMemberIds(team).map((agentId) => ({
        agent: agentId,
        role: agentId === team.lead ? '主理人' : (team.members || []).find((m) => (m.agent || m) === agentId)?.role || '',
        exists: byId.has(agentId),
        disabled: byId.get(agentId)?.disabled ?? null
      }))
    };
  }
  if (!AGENT_ID_RE.test(id)) throw httpError(400, 'invalid_id', `非法的专家 ID：${id}`);
  const path = agentPath(id);
  let text = '';
  let info = null;
  try {
    [text, info] = await Promise.all([readFile(path, 'utf8'), stat(path)]);
  } catch {
    throw httpError(404, 'agent_not_found', `找不到专家：${id}`);
  }
  const { fm, body } = splitFrontmatter(text);
  const meta = parseFrontmatter(fm);
  return {
    kind: 'agent',
    id,
    name: displayNameFor(id, meta),
    profession: professionFor(id, meta),
    meta,
    disabled: /^disable-model-invocation:\s*true\s*$/im.test(fm),
    mtimeMs: info.mtimeMs,
    size: info.size,
    text,
    body
  };
}

async function handleToggle(body) {
  const kind = body?.kind === 'team' ? 'team' : 'agent';
  const ids = Array.isArray(body?.ids) ? [...new Set(body.ids)] : [];
  if (!ids.length) throw httpError(400, 'missing_ids', '缺少要操作的 ID');
  const enabled = Boolean(body?.enabled);

  let targets = [];
  if (kind === 'team') {
    const teams = await loadTeams();
    for (const id of ids) {
      const team = teams.find((item) => item.id === id || item.dir === id);
      if (!team) throw httpError(404, 'team_not_found', `找不到团队：${id}`);
      targets.push(...teamMemberIds(team));
    }
  } else {
    targets = ids;
  }
  targets = [...new Set(targets)];

  const changed = [];
  const skipped = [];
  for (const id of targets) {
    try {
      if (!AGENT_ID_RE.test(id)) throw httpError(400, 'invalid_id', `非法的专家 ID：${id}`);
      const path = agentPath(id);
      const text = await readFile(path, 'utf8');
      const next = setDisabled(text, !enabled);
      if (next === text) {
        skipped.push({ id, reason: 'unchanged' });
      } else {
        await writeAtomic(path, next);
        changed.push(id);
      }
    } catch (err) {
      skipped.push({ id, reason: err?.code || String(err?.message || err) });
    }
  }
  return { kind, enabled, changed, skipped };
}

async function handleTrash(body) {
  const kind = body?.kind === 'team' ? 'team' : 'agent';
  const id = String(body?.id || '');
  if (!id) throw httpError(400, 'missing_id', '缺少 ID');

  if (kind === 'team') {
    const team = await findTeam(id);
    if (!team) throw httpError(404, 'team_not_found', `找不到团队：${id}`);
    const items = teamMemberIds(team).map((agentId) => ({
      root: 'agents',
      src: agentPath(agentId),
      name: `${agentId}.md`,
      original: agentPath(agentId)
    }));
    items.push({
      root: 'skills',
      src: team.skillDir,
      name: team.dir,
      original: team.skillDir
    });
    const manifest = await createTrashEntry({ kind: 'team', id: team.id, items });
    return { trashId: manifest.trashId, moved: manifest.items.length };
  }

  if (!AGENT_ID_RE.test(id)) throw httpError(400, 'invalid_id', `非法的专家 ID：${id}`);
  const path = agentPath(id);
  const manifest = await createTrashEntry({
    kind: 'agent',
    id,
    items: [{ root: 'agents', src: path, name: `${id}.md`, original: path }]
  });
  if (!manifest.items.length) throw httpError(404, 'agent_not_found', `找不到专家：${id}`);
  return { trashId: manifest.trashId, moved: manifest.items.length };
}

async function installedSet(agents, teams) {
  const set = new Set();
  for (const agent of agents) {
    set.add(agent.id);
    set.add(agent.agentName);
  }
  for (const team of teams) {
    if (team.lead) set.add(team.lead);
    if (team.marketId) set.add(team.marketId);
  }
  return set;
}

async function handleMarket(url) {
  const refresh = url.searchParams.get('refresh') === '1';
  const { manifest, source, warning } = await loadManifest({ refresh });
  const agents = await readAgentFiles();
  const teams = await loadTeams();
  const state = buildState(agents, teams);
  const data = listMarket(manifest, await installedSet(state.agents, teams), {
    q: url.searchParams.get('q') || '',
    type: url.searchParams.get('type') || 'all',
    category: url.searchParams.get('category') || 'all',
    offset: Number(url.searchParams.get('offset') || 0),
    limit: Math.min(500, Math.max(1, Number(url.searchParams.get('limit') || 200)))
  });
  return { ...data, source, warning, fetchedAt: new Date().toISOString() };
}

async function handleInstall(body) {
  const marketId = String(body?.marketId || '');
  if (!marketId) throw httpError(400, 'missing_market_id', '缺少 marketId');
  const conflict = body?.conflict === 'overwrite' ? 'overwrite' : 'skip';
  let { manifest } = await loadManifest();
  let entry = (manifest.experts || []).find((item) => item.id === marketId);
  if (!entry) {
    ({ manifest } = await loadManifest({ refresh: true }));
    entry = (manifest.experts || []).find((item) => item.id === marketId);
  }
  if (!entry) throw httpError(404, 'market_entry_not_found', `市场里找不到：${marketId}`);
  const result = await installFromMarket(entry, { conflict });
  await log(`install ${marketId}: installed=${result.installed.length} skipped=${result.skipped.length}`);
  return result;
}

function route(handler) {
  return async (req) => {
    try {
      return await handler(req);
    } catch (err) {
      await log(`ERROR ${req.method} ${req.url}: ${err?.stack || err}`);
      return fail(err);
    }
  };
}

function jsonBody(handler) {
  return route(async (req) => {
    await assertWritableRequest(req);
    return handler(await readBody(req), req);
  });
}

export function buildRoutes() {
  return [
    {
      path: `${API_PREFIX}/state`,
      methods: ['GET', 'HEAD'],
      fetch: route(async (req) => ok(await handleState(), req.method === 'HEAD'))
    },
    {
      path: `${API_PREFIX}/detail`,
      methods: ['GET'],
      fetch: route(async (req) => ok(await handleDetail(new URL(req.url, 'http://localhost'))))
    },
    {
      path: `${API_PREFIX}/toggle`,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: jsonBody(async (body) => ok(await handleToggle(body)))
    },
    {
      path: `${API_PREFIX}/trash`,
      methods: ['GET', 'POST'],
      requestBody: 'buffered',
      fetch: route(async (req) => {
        if (req.method === 'GET') return ok(await listTrash());
        await assertWritableRequest(req);
        return ok(await handleTrash(await readBody(req)));
      })
    },
    {
      path: `${API_PREFIX}/restore`,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: jsonBody(async (body) => ok(await restoreTrash(String(body?.trashId || ''))))
    },
    {
      path: `${API_PREFIX}/purge`,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: jsonBody(async (body) => {
        const trashId = String(body?.trashId || '');
        if (!trashId) throw httpError(400, 'missing_trash_id', '缺少 trashId');
        return ok(await purgeTrash(trashId));
      })
    },
    {
      path: `${API_PREFIX}/market`,
      methods: ['GET'],
      fetch: route(async (req) => ok(await handleMarket(new URL(req.url, 'http://localhost'))))
    },
    {
      path: `${API_PREFIX}/market/install`,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: jsonBody(async (body) => ok(await handleInstall(body)))
    }
  ];
}

export function apply(ctx) {
  const routes = buildRoutes();
  const install = () => routes.map((item) => ctx.connection.fetch.register({
    path: item.path,
    methods: item.methods,
    requestBody: item.requestBody || 'buffered',
    fetch: item.fetch
  }));
  if (typeof ctx.effect === 'function') {
    ctx.effect(() => {
      const disposers = install();
      return () => {
        for (const disposeRoute of disposers) {
          try {
            if (typeof disposeRoute === 'function') disposeRoute();
          } catch {
            // ignore
          }
        }
      };
    }, 'agent-manager routes');
  } else {
    install();
  }
}
