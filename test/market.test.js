import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installFromMarket, listMarket } from '../lib/market.js';

const manifest = {
  categories: [{ id: '02-Engineering', name: { zh: '技术工程' } }],
  experts: [
    {
      id: 'DemoExpert',
      expertType: 'agent',
      displayName: { zh: '演示专家' },
      profession: { zh: '演示工程师' },
      description: { zh: '一个演示专家' },
      promptFile: '/plugins/demo/agents/demo.md',
      agentName: 'demo',
      categoryId: '02-Engineering',
      tags: [{ zh: '演示' }]
    },
    {
      id: 'DemoTeam',
      expertType: 'team',
      displayName: { zh: '演示专家团' },
      description: { zh: '一个演示团队' },
      plugin: 'demo-team',
      promptFile: '/plugins/demo-team/agents/lead.md',
      members: [
        { id: 'lead', role: 'lead', profession: { zh: '主理人' }, promptFile: '/plugins/demo-team/agents/lead.md' },
        { id: 'member', role: 'member', profession: { zh: '成员' }, promptFile: '/plugins/demo-team/agents/member.md' }
      ],
      categoryId: '02-Engineering'
    }
  ]
};

test('listMarket maps names, types, and installed flags', () => {
  const result = listMarket(manifest, new Set(['DemoTeam']), { q: '演示', type: 'all', category: 'all' });
  assert.equal(result.total, 2);
  const expert = result.items.find((item) => item.marketId === 'DemoExpert');
  assert.equal(expert.name, '演示专家');
  assert.equal(expert.type, 'agent');
  assert.equal(expert.installed, false);
  const team = result.items.find((item) => item.marketId === 'DemoTeam');
  assert.equal(team.type, 'team');
  assert.equal(team.memberCount, 2);
  assert.equal(team.installed, true);
});

test('installFromMarket installs a single expert and skips on conflict', async () => {
  const root = await mkdtemp(join(tmpdir(), 'am-market-'));
  const prev = {
    agents: process.env.DSH_AGENT_MANAGER_AGENTS_DIR,
    skills: process.env.DSH_AGENT_MANAGER_SKILLS_DIR,
    data: process.env.DSH_AGENT_MANAGER_DATA_DIR
  };
  process.env.DSH_AGENT_MANAGER_AGENTS_DIR = join(root, 'agents');
  process.env.DSH_AGENT_MANAGER_SKILLS_DIR = join(root, 'skills');
  process.env.DSH_AGENT_MANAGER_DATA_DIR = join(root, 'data');
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).endsWith('/plugins/demo/agents/demo.md')) {
      return new Response('---\nname: demo-expert\ndescription: demo\n---\n\n# Demo\n', { status: 200 });
    }
    return new Response('missing', { status: 404 });
  };
  try {
    const first = await installFromMarket(manifest.experts[0], { conflict: 'skip' });
    assert.equal(first.installed.length, 1);
    const text = await readFile(join(root, 'agents', 'demo-expert.md'), 'utf8');
    assert.match(text, /name: demo-expert/);

    const second = await installFromMarket(manifest.experts[0], { conflict: 'skip' });
    assert.equal(second.installed.length, 0);
    assert.equal(second.skipped.length, 1);
  } finally {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(prev)) {
      const env = key === 'agents' ? 'DSH_AGENT_MANAGER_AGENTS_DIR' : key === 'skills' ? 'DSH_AGENT_MANAGER_SKILLS_DIR' : 'DSH_AGENT_MANAGER_DATA_DIR';
      if (value === undefined) delete process.env[env];
      else process.env[env] = value;
    }
    await rm(root, { recursive: true, force: true });
  }
});

test('installFromMarket installs a team with team.json and skill', async () => {
  const root = await mkdtemp(join(tmpdir(), 'am-market-team-'));
  const prev = {
    agents: process.env.DSH_AGENT_MANAGER_AGENTS_DIR,
    skills: process.env.DSH_AGENT_MANAGER_SKILLS_DIR,
    data: process.env.DSH_AGENT_MANAGER_DATA_DIR
  };
  process.env.DSH_AGENT_MANAGER_AGENTS_DIR = join(root, 'agents');
  process.env.DSH_AGENT_MANAGER_SKILLS_DIR = join(root, 'skills');
  process.env.DSH_AGENT_MANAGER_DATA_DIR = join(root, 'data');
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).includes('/plugins/demo-team/agents/lead.md')) {
      return new Response('---\nname: demo-team-lead\ndescription: lead\n---\n\n# Lead\n', { status: 200 });
    }
    if (String(url).includes('/plugins/demo-team/agents/member.md')) {
      return new Response('---\nname: demo-team-member\ndescription: member\n---\n\n# Member\n', { status: 200 });
    }
    return new Response('missing', { status: 404 });
  };
  try {
    const result = await installFromMarket(manifest.experts[1], { conflict: 'skip' });
    assert.equal(result.installed.length, 2);
    assert.equal(result.teamId, 'team-demo-team');
    const team = JSON.parse(await readFile(join(root, 'skills', 'team-demo-team', 'team.json'), 'utf8'));
    assert.equal(team.lead, 'demo-team-lead');
    assert.equal(team.members.length, 1);
    const skill = await readFile(join(root, 'skills', 'team-demo-team', 'SKILL.md'), 'utf8');
    assert.match(skill, /name: team-demo-team/);
    assert.match(skill, /demo-team-member/);
  } finally {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(prev)) {
      const env = key === 'agents' ? 'DSH_AGENT_MANAGER_AGENTS_DIR' : key === 'skills' ? 'DSH_AGENT_MANAGER_SKILLS_DIR' : 'DSH_AGENT_MANAGER_DATA_DIR';
      if (value === undefined) delete process.env[env];
      else process.env[env] = value;
    }
    await rm(root, { recursive: true, force: true });
  }
});
