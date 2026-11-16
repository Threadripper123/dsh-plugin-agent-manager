import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('agentPath accepts valid ids and stays inside the agents dir', async () => {
  const root = await mkdtemp(join(tmpdir(), 'am-paths-'));
  const prev = process.env.DSH_AGENT_MANAGER_AGENTS_DIR;
  process.env.DSH_AGENT_MANAGER_AGENTS_DIR = root;
  try {
    await mkdir(root, { recursive: true });
    const { agentPath } = await import(`../lib/paths.js?a=${Date.now()}`);
    const path = agentPath('demo-expert');
    assert.equal(path, join(root, 'demo-expert.md'));
  } finally {
    if (prev === undefined) delete process.env.DSH_AGENT_MANAGER_AGENTS_DIR;
    else process.env.DSH_AGENT_MANAGER_AGENTS_DIR = prev;
    await rm(root, { recursive: true, force: true });
  }
});

test('agentPath rejects traversal and unsafe ids', async () => {
  const { agentPath } = await import(`../lib/paths.js?b=${Date.now()}`);
  for (const id of ['../evil', '..', 'a/b', 'A B', '', 'a'.repeat(65)]) {
    assert.throws(() => agentPath(id), /非法的专家 ID|路径越界/);
  }
});
