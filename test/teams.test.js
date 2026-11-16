import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

async function withSkills(fn) {
  const root = await mkdtemp(join(tmpdir(), 'am-teams-'));
  const prev = process.env.DSH_AGENT_MANAGER_SKILLS_DIR;
  process.env.DSH_AGENT_MANAGER_SKILLS_DIR = root;
  try {
    await fn(root);
  } finally {
    if (prev === undefined) delete process.env.DSH_AGENT_MANAGER_SKILLS_DIR;
    else process.env.DSH_AGENT_MANAGER_SKILLS_DIR = prev;
    await rm(root, { recursive: true, force: true });
  }
}

test('derives a team from SKILL.md when team.json is missing', async () => {
  await withSkills(async (root) => {
    const dir = join(root, 'team-demo');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'SKILL.md'), `---
name: team-demo
description: Demo team
---

优先把任务交给 \`demo-lead\` 子代理。

| Agent ID | 角色 |
|---|---|
| \`demo-worker\` | 工程师 |
| \`demo-qa\` | QA |
`, 'utf8');

    const { loadTeams } = await import(`../lib/teams.js?derived=${Date.now()}`);
    const teams = await loadTeams();
    assert.equal(teams.length, 1);
    assert.equal(teams[0].lead, 'demo-lead');
    assert.equal(teams[0].derived, true);
    assert.deepEqual(teams[0].members.map((m) => m.agent).sort(), ['demo-qa', 'demo-worker']);
  });
});

test('saveTeam writes team.json and loadTeams prefers it', async () => {
  await withSkills(async (root) => {
    const { saveTeam } = await import(`../lib/teams.js?save=${Date.now()}`);
    const team = {
      id: 'team-saved',
      name: '保存团队',
      description: 'x',
      lead: 'lead',
      members: [{ agent: 'member', role: '成员' }],
      source: 'local',
      marketId: null
    };
    await saveTeam(team);
    const { loadTeams } = await import(`../lib/teams.js?read=${Date.now()}`);
    const teams = await loadTeams();
    const found = teams.find((item) => item.id === 'team-saved');
    assert.equal(found.derived, false);
    assert.equal(found.name, '保存团队');
    assert.equal(found.lead, 'lead');
  });
});
