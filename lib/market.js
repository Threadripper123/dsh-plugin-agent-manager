import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { homedir } from 'node:os';
import { AGENT_ID_RE, agentPath, agentRoot, cacheRoot, skillsRoot, httpError } from './paths.js';
import { parseFrontmatter, splitFrontmatter, stripFrontmatter, withName } from './frontmatter.js';
import { createTrashEntry } from './trash.js';
import { writeAtomic } from './atomic.js';

const CDN_BASE = 'https://acc-1258344699.cos.accelerate.myqcloud.com/workbuddy/expert-marketplace';
const ALLOWED_HOST = 'acc-1258344699.cos.accelerate.myqcloud.com';
const LOCAL_MANIFEST = join(homedir(), '.workbuddy', 'app', 'cache', 'experts', 'manifest.json');
const MAX_PROMPT_BYTES = 1024 * 1024;
const MAX_MANIFEST_BYTES = 8 * 1024 * 1024;

function normalizeName(raw, fallback) {
  const source = String(raw || fallback || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  if (!source || !AGENT_ID_RE.test(source)) {
    throw httpError(422, 'invalid_agent_name', `无法从提示词中推导合法的 agent 名称：${String(raw || fallback)}`);
  }
  return source;
}

function assertPromptFile(promptFile) {
  if (typeof promptFile !== 'string' || promptFile.length > 240) {
    throw httpError(422, 'invalid_prompt_file', '提示词路径不合法');
  }
  if (!promptFile.startsWith('/plugins/') || promptFile.includes('..') || promptFile.includes('\\') || !promptFile.endsWith('.md')) {
    throw httpError(422, 'invalid_prompt_file', `提示词路径不合法：${promptFile}`);
  }
  return promptFile;
}

function cdnUrl(promptFile) {
  return `${CDN_BASE}${assertPromptFile(promptFile)}`;
}

async function fetchBuffer(url, { maxBytes, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    const finalUrl = new URL(res.url || url);
    if (finalUrl.host !== ALLOWED_HOST) {
      throw httpError(502, 'unexpected_host', `下载地址跳转到非白名单域名：${finalUrl.host}`);
    }
    if (!res.ok) {
      throw httpError(502, 'download_failed', `下载失败（HTTP ${res.status}）：${url}`);
    }
    const length = Number(res.headers.get('content-length') || 0);
    if (length && length > maxBytes) {
      throw httpError(413, 'too_large', `文件过大：${length} bytes`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > maxBytes) {
      throw httpError(413, 'too_large', `文件过大：${buffer.length} bytes`);
    }
    return buffer;
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw httpError(504, 'download_timeout', `下载超时：${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function loadManifest({ refresh = false } = {}) {
  if (!refresh) {
    try {
      const parsed = JSON.parse(await readFile(LOCAL_MANIFEST, 'utf8'));
      if (Array.isArray(parsed.experts)) {
        return { manifest: parsed, source: 'local', fetchedAt: null, warning: null };
      }
    } catch {
      // fall through to CDN
    }
  }
  try {
    const buffer = await fetchBuffer(`${CDN_BASE}/expert_center.json`, { maxBytes: MAX_MANIFEST_BYTES, timeoutMs: 20000 });
    const parsed = JSON.parse(buffer.toString('utf8'));
    if (!Array.isArray(parsed.experts)) throw new Error('manifest shape invalid');
    await mkdir(cacheRoot(), { recursive: true });
    await writeFile(join(cacheRoot(), 'expert_center.json'), buffer, 'utf8');
    return { manifest: parsed, source: 'cdn', fetchedAt: new Date().toISOString(), warning: null };
  } catch (err) {
    try {
      const parsed = JSON.parse(await readFile(join(cacheRoot(), 'expert_center.json'), 'utf8'));
      if (Array.isArray(parsed.experts)) {
        return { manifest: parsed, source: 'cache', fetchedAt: null, warning: `CDN 不可用，已使用本地缓存：${err.message}` };
      }
    } catch {
      // ignore cache failure
    }
    throw httpError(502, 'market_unavailable', `无法加载专家市场清单：${err.message}`);
  }
}

function localize(value, fallback = '') {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  return value.zh || value.en || fallback;
}

export function listMarket(manifest, installedIds, { q = '', type = 'all', category = 'all', offset = 0, limit = 200 } = {}) {
  const needle = String(q).trim().toLowerCase();
  const all = (manifest.experts || [])
    .filter((expert) => expert && expert.promptFile)
    .map((expert) => {
      const kind = expert.expertType === 'team' || (expert.members && expert.members.length > 1) ? 'team' : 'agent';
      const name = localize(expert.displayName, expert.id);
      const profession = localize(expert.profession, '');
      const description = localize(expert.description || expert.displayDescription, '');
      return {
        marketId: expert.id,
        name,
        profession,
        description,
        type: kind,
        categoryId: expert.categoryId || '',
        memberCount: expert.members?.length || 0,
        installed: installedIds.has(expert.id) || installedIds.has(expert.agentName),
        tags: (expert.tags || []).map((tag) => localize(tag, '')).filter(Boolean),
        plugin: expert.plugin || ''
      };
    });
  const filtered = all.filter((item) => {
    if (type !== 'all' && item.type !== type) return false;
    if (category !== 'all' && item.categoryId !== category) return false;
    if (!needle) return true;
    return `${item.name} ${item.profession} ${item.description} ${item.marketId} ${item.tags.join(' ')}`
      .toLowerCase()
      .includes(needle);
  });
  const start = Math.max(0, Number(offset) || 0);
  return {
    total: filtered.length,
    offset: start,
    limit,
    items: filtered.slice(start, start + limit),
    categories: (manifest.categories || []).map((cat) => ({ id: cat.id, name: localize(cat.name, cat.id) }))
  };
}

function buildTeamSkill(team, memberRows) {
  const rows = memberRows
    .filter((row) => row.agent !== team.lead)
    .map((row) => `| \`${row.agent}\` | ${row.role || '成员'} |`)
    .join('\n');
  const description = `${team.name}（${memberRows.length} 人专家团）。${team.description || ''}`.trim();
  return `---
name: ${team.id}
description: ${JSON.stringify(description)}
---

# ${team.name}（Agent Team）

加载本技能后，优先把任务交给 \`${team.lead}\` 子代理；它会自行建团队、按角色分派并汇总交付。

## 成员（已装在 \`~/.codebuddy/agents/\`）

| Agent ID | 角色 |
|---|---|
| \`${team.lead}\` | 主理人 |
${rows}

## 执行步骤

1. **先读剧本**：\`Read\` 本目录下的 \`lead.md\`，按其中的工作流与分派规则执行。
2. **交给主理人**：用 Agent 工具 spawn \`${team.lead}\`，把完整需求作为任务说明。
3. **或由主会话亲自主持**：主会话可按 \`lead.md\` 自己当主理人，用 \`name\` + \`subagent_type\` 同名分派成员。
4. **收尾**：成员完成后关闭成员，\`TeamDelete\` 清理。

## 硬约束

- 成员 \`name\` 与 \`subagent_type\` 必须使用英文 Agent ID，不得用中文名。
- 不要代写成员的专业产出；所有跨成员信息流经主理人中转。
`;
}

/**
 * Install one market entry (agent or team).
 * Returns { installed, skipped, teamId, warnings }.
 */
export async function installFromMarket(entry, { conflict = 'skip' } = {}) {
  if (!entry || !entry.promptFile) {
    throw httpError(400, 'invalid_market_entry', '市场条目缺少 promptFile');
  }
  const isTeam = entry.expertType === 'team' || (entry.members && entry.members.length > 1);
  const sources = isTeam
    ? entry.members.map((member, index) => ({
        promptFile: member.promptFile,
        role: index === 0 || member.role === 'lead' ? '主理人' : member.profession || member.role || '成员',
        marketMemberId: member.id
      }))
    : [{ promptFile: entry.promptFile, role: '主理人', marketMemberId: entry.agentName || entry.id }];
  const leadSource = sources.find((source) => source.promptFile === entry.promptFile) || sources[0];
  const deduped = [];
  const seen = new Set();
  for (const source of sources) {
    if (!source.promptFile || seen.has(source.promptFile)) continue;
    seen.add(source.promptFile);
    deduped.push(source);
  }

  const created = [];
  const createdDirs = [];
  const installed = [];
  const skipped = [];
  let leadName = null;
  let leadText = '';
  const memberRows = [];

  try {
    for (const source of deduped) {
      const buffer = await fetchBuffer(cdnUrl(source.promptFile), { maxBytes: MAX_PROMPT_BYTES });
      const text = buffer.toString('utf8');
      const { fm } = splitFrontmatter(text);
      const meta = parseFrontmatter(fm);
      if (!meta.name || !meta.description) {
        throw httpError(422, 'invalid_prompt', `${source.promptFile} 缺少 name/description frontmatter`);
      }
      const name = normalizeName(meta.name, basename(source.promptFile, '.md'));
      const target = agentPath(name);
      if (source.promptFile === leadSource.promptFile) {
        leadName = name;
        leadText = text;
      }
      let exists = false;
      try {
        await readFile(target);
        exists = true;
      } catch {
        exists = false;
      }
      if (exists && conflict !== 'overwrite') {
        skipped.push({ name, reason: 'exists' });
        memberRows.push({ agent: name, role: source.role });
        continue;
      }
      if (exists) {
        await createTrashEntry({
          kind: 'agent',
          id: name,
          items: [{ root: 'agents', src: target, name: `${name}.md`, original: target }]
        });
      }
      await mkdir(agentRoot(), { recursive: true });
      const nextText = withName(text, name);
      await writeAtomic(target, nextText);
      created.push(target);
      installed.push({ name, role: source.role });
      memberRows.push({ agent: name, role: source.role });
    }

    let teamId = null;
    if (isTeam) {
      if (!leadName) {
        throw httpError(422, 'invalid_team', '团队条目缺少主理人提示词');
      }
      const slug = normalizeName(entry.plugin || entry.id, entry.id);
      teamId = `team-${slug}`;
      if (!/^team-[a-z0-9][a-z0-9-]{0,63}$/.test(teamId)) {
        throw httpError(422, 'invalid_team_id', `无法生成合法的团队 ID：${teamId}`);
      }
      const team = {
        schema: 1,
        id: teamId,
        name: localize(entry.displayName, entry.id),
        description: localize(entry.description, ''),
        lead: leadName,
        members: memberRows.filter((row) => row.agent !== leadName).map((row) => ({ agent: row.agent, role: row.role })),
        source: 'market',
        marketId: entry.id
      };
      const skillDir = join(skillsRoot(), teamId);
      const teamJson = join(skillDir, 'team.json');
      let teamExists = false;
      try {
        await readFile(teamJson);
        teamExists = true;
      } catch {
        teamExists = false;
      }
      if (!teamExists) {
        await mkdir(skillDir, { recursive: true });
        createdDirs.push(skillDir);
        await writeAtomic(teamJson, `${JSON.stringify(team, null, 2)}\n`);
        await writeAtomic(join(skillDir, 'SKILL.md'), buildTeamSkill(team, memberRows));
        await writeAtomic(join(skillDir, 'lead.md'), stripFrontmatter(leadText));
        created.push(teamJson, join(skillDir, 'SKILL.md'), join(skillDir, 'lead.md'));
      } else {
        skipped.push({ name: teamId, reason: 'team_exists' });
      }
    }

    return { installed, skipped, teamId, warnings: [] };
  } catch (err) {
    for (const path of created) {
      await rm(path, { force: true }).catch(() => {});
    }
    for (const dir of createdDirs.reverse()) {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
    throw err;
  }
}
