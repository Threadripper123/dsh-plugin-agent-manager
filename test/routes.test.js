import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'am-routes-'));
  const agents = join(root, 'agents');
  const skills = join(root, 'skills');
  const data = join(root, 'data');
  await mkdir(agents, { recursive: true });
  await mkdir(join(skills, 'team-demo'), { recursive: true });
  await writeFile(join(agents, 'alpha.md'), '---\nname: alpha\ndescription: first\n---\nbody\n', 'utf8');
  await writeFile(join(agents, 'beta.md'), '---\nname: beta\ndescription: second\n---\nbody\n', 'utf8');
  await writeFile(join(skills, 'team-demo', 'team.json'), JSON.stringify({
    schema: 1,
    id: 'team-demo',
    name: '演示团队',
    description: 'demo',
    lead: 'alpha',
    members: [{ agent: 'beta', role: '成员' }],
    source: 'local'
  }), 'utf8');
  return { root, agents, skills, data };
}

function withEnv({ agents, skills, data }) {
  process.env.DSH_AGENT_MANAGER_AGENTS_DIR = agents;
  process.env.DSH_AGENT_MANAGER_SKILLS_DIR = skills;
  process.env.DSH_AGENT_MANAGER_DATA_DIR = data;
}

function clearEnv() {
  delete process.env.DSH_AGENT_MANAGER_AGENTS_DIR;
  delete process.env.DSH_AGENT_MANAGER_SKILLS_DIR;
  delete process.env.DSH_AGENT_MANAGER_DATA_DIR;
}

async function loadApp() {
  const mod = await import(`../lib/index.js?routes=${Date.now()}`);
  const routes = [];
  const ctx = {
    connection: { fetch: { register(route) { routes.push(route); return () => {}; } } },
    effect(fn) { fn(); }
  };
  mod.apply(ctx);
  return { routes, mod };
}

function findRoute(routes, suffix) {
  const route = routes.find((item) => item.path.endsWith(suffix));
  assert.ok(route, `missing route ${suffix}`);
  return route;
}

test('state route returns agents and teams', async () => {
  const env = await setup();
  withEnv(env);
  try {
    const { routes } = await loadApp();
    const res = await findRoute(routes, '/state').fetch(new Request('http://localhost/api/x/state'));
    const payload = await res.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.data.totals.agents, 2);
    assert.equal(payload.data.totals.teams, 1);
    assert.equal(payload.data.teams[0].name, '演示团队');
  } finally {
    clearEnv();
    await rm(env.root, { recursive: true, force: true });
  }
});

test('toggle route writes the disable flag', async () => {
  const env = await setup();
  withEnv(env);
  try {
    const { routes } = await loadApp();
    const route = findRoute(routes, '/toggle');
    const req = new Request('http://localhost/api/x/toggle', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dsh-agent-manager': '1' },
      body: JSON.stringify({ kind: 'agent', ids: ['alpha'], enabled: false })
    });
    const res = await route.fetch(req);
    const payload = await res.json();
    assert.equal(payload.ok, true);
    assert.deepEqual(payload.data.changed, ['alpha']);
    const text = await readFile(join(env.agents, 'alpha.md'), 'utf8');
    assert.match(text, /disable-model-invocation: true/);
  } finally {
    clearEnv();
    await rm(env.root, { recursive: true, force: true });
  }
});

test('toggle rejects writes without the marker header', async () => {
  const env = await setup();
  withEnv(env);
  try {
    const { routes } = await loadApp();
    const route = findRoute(routes, '/toggle');
    const req = new Request('http://localhost/api/x/toggle', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'agent', ids: ['alpha'], enabled: false })
    });
    const res = await route.fetch(req);
    assert.equal(res.status, 403);
  } finally {
    clearEnv();
    await rm(env.root, { recursive: true, force: true });
  }
});

test('trash and restore move an agent through the recycle bin', async () => {
  const env = await setup();
  withEnv(env);
  try {
    const { routes } = await loadApp();
    const trashRoute = findRoute(routes, '/trash');
    const req = new Request('http://localhost/api/x/trash', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dsh-agent-manager': '1' },
      body: JSON.stringify({ kind: 'agent', id: 'alpha' })
    });
    const trashed = await (await trashRoute.fetch(req)).json();
    assert.equal(trashed.ok, true);
    await assert.rejects(stat(join(env.agents, 'alpha.md')));

    const restoreRoute = findRoute(routes, '/restore');
    const restoreReq = new Request('http://localhost/api/x/restore', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dsh-agent-manager': '1' },
      body: JSON.stringify({ trashId: trashed.data.trashId })
    });
    const restored = await (await restoreRoute.fetch(restoreReq)).json();
    assert.equal(restored.ok, true);
    const text = await readFile(join(env.agents, 'alpha.md'), 'utf8');
    assert.match(text, /name: alpha/);
  } finally {
    clearEnv();
    await rm(env.root, { recursive: true, force: true });
  }
});
