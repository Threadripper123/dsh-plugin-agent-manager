import test from 'node:test';
import assert from 'node:assert/strict';
import { buildState, filterAgents } from '../lib/store.js';

const files = [
  { id: 'alpha', text: '---\nname: alpha\ndescription: first\n---\nbody', mtimeMs: 1, size: 10 },
  { id: 'beta', text: '---\nname: beta\ndescription: second\ndisable-model-invocation: true\n---\nbody', mtimeMs: 2, size: 10 },
  { id: 'gamma', text: '---\nname: gamma\ndescription: third\n---\nbody', mtimeMs: 3, size: 10 }
];

const teams = [
  {
    id: 'team-x',
    name: 'X 团队',
    description: 'demo',
    lead: 'alpha',
    members: [{ agent: 'beta', role: '成员' }, { agent: 'missing', role: '缺失' }]
  }
];

test('buildState computes totals and team membership', () => {
  const state = buildState(files, teams);
  assert.deepEqual(state.totals, { agents: 3, enabled: 2, disabled: 1, teams: 1, enabledTeams: 0 });
  assert.deepEqual(state.agents.find((a) => a.id === 'alpha').teamIds, ['team-x']);
  assert.equal(state.teams[0].memberCount, 3);
  assert.equal(state.teams[0].enabled, false);
  assert.equal(state.teams[0].members.find((m) => m.agent === 'missing').missing, true);
});

test('filterAgents filters by status, team, and query', () => {
  const state = buildState(files, teams);
  assert.equal(filterAgents(state.agents, { status: 'disabled' }).length, 1);
  assert.equal(filterAgents(state.agents, { team: 'in-team' }).length, 2);
  assert.equal(filterAgents(state.agents, { q: 'gamma' }).length, 1);
});
