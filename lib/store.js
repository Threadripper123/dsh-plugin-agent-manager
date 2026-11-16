import { splitFrontmatter, parseFrontmatter, isDisabled } from './frontmatter.js';

function text(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.zh || value.en || '';
}

const ALIASES = {
  'code-review-expert': { name: '火眼眼', profession: '代码审查专家' },
  'mcp-build-expert': { name: '协议通', profession: 'MCP 构建专家' },
  'security-engineer': { name: '盾甲甲', profession: '安全工程师' },
  'llm-wiki': { name: '知库库', profession: '知识管理专家' },
  'engineering-workflow-coach': { name: '工序达', profession: '工程实践专家' },
  'strategy-backtest-expert': { name: '回测明算', profession: '量化策略回测师' },
  'system-architect': { name: '架构通', profession: '软件架构师' },
  'ai-engineer': { name: '深网网', profession: 'AI 工程师' },
  'data-analytics-reporter': { name: '舒明析', profession: '数据分析报告师' },
  'dev-ops-automation-engineer': { name: '一键达', profession: 'DevOps 自动化工程师' },
  'financial-modeling-expert': { name: '建模模', profession: '金融建模专家' },
  'data-exploration-expert': { name: '探数数', profession: '数据探索专家' }
};

export function displayNameFor(id, meta) {
  const fromMeta = text(meta?.displayName) || meta?.name;
  if (fromMeta && fromMeta !== id) return fromMeta;
  return ALIASES[id]?.name || fromMeta || id;
}

export function professionFor(id, meta) {
  return text(meta?.profession) || ALIASES[id]?.profession || '';
}

export function agentFromFile({ id, text: source, mtimeMs, size }) {
  const { fm, body } = splitFrontmatter(source);
  const meta = parseFrontmatter(fm);
  return {
    id,
    name: displayNameFor(id, meta),
    agentName: meta.name || id,
    profession: professionFor(id, meta),
    description: text(meta.description),
    disabled: isDisabled(fm),
    mtimeMs: mtimeMs || 0,
    size: size || String(source ?? '').length,
    bodyLength: body.length,
    hasFrontmatter: splitFrontmatter(source).has
  };
}

export function buildState(agentFiles, teams) {
  const baseAgents = agentFiles.map(agentFromFile);
  const byId = new Map(baseAgents.map((agent) => [agent.id, agent]));

  const decoratedTeams = teams.map((team) => {
    const leadAgent = team.lead ? byId.get(team.lead) : null;
    const members = (team.members || []).map((member) => {
      const id = typeof member === 'string' ? member : member?.agent;
      const found = id ? byId.get(id) : null;
      return {
        agent: id,
        role: typeof member === 'object' && member ? member.role || '' : '',
        exists: Boolean(found),
        disabled: found ? found.disabled : null,
        missing: !found
      };
    });
    return {
      ...team,
      leadExists: Boolean(leadAgent),
      leadDisabled: leadAgent ? leadAgent.disabled : null,
      members,
      memberCount: members.length + (leadAgent ? 1 : 0),
      enabled: Boolean(leadAgent && !leadAgent.disabled && members.every((m) => m.exists && m.disabled !== true))
    };
  });

  const agents = baseAgents.map((agent) => {
    const teamIds = decoratedTeams
      .filter((team) => team.lead === agent.id || team.members.some((m) => m.agent === agent.id))
      .map((team) => team.id);
    return { ...agent, teamIds };
  }).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));

  const disabled = agents.filter((agent) => agent.disabled).length;
  return {
    agents,
    teams: decoratedTeams,
    totals: {
      agents: agents.length,
      enabled: agents.length - disabled,
      disabled,
      teams: decoratedTeams.length,
      enabledTeams: decoratedTeams.filter((team) => team.enabled).length
    },
    warnings: []
  };
}

export function filterAgents(agents, { q = '', status = 'all', team = 'all' } = {}) {
  const needle = String(q).trim().toLowerCase();
  return agents.filter((agent) => {
    if (status === 'enabled' && agent.disabled) return false;
    if (status === 'disabled' && !agent.disabled) return false;
    if (team === 'in-team' && agent.teamIds.length === 0) return false;
    if (team === 'solo' && agent.teamIds.length > 0) return false;
    if (!needle) return true;
    return `${agent.name} ${agent.agentName} ${agent.id} ${agent.description}`.toLowerCase().includes(needle);
  });
}
