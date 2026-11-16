import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { skillsRoot, assertTeamDirName } from './paths.js';
import { splitFrontmatter, parseFrontmatter } from './frontmatter.js';

const ID_IN_BACKTICKS = /`([a-z0-9][a-z0-9-]{0,63})`/g;

function tableRows(text) {
  const rows = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 2) continue;
    const idMatch = /^`([a-z0-9][a-z0-9-]{0,63})`$/.exec(cells[0]);
    if (!idMatch) continue;
    rows.push({ agent: idMatch[1], role: cells[1] || '' });
  }
  return rows;
}

export async function deriveTeam(skillDir, dirName) {
  let text = '';
  try {
    text = await readFile(join(skillDir, 'SKILL.md'), 'utf8');
  } catch {
    return null;
  }
  const { fm } = splitFrontmatter(text);
  const meta = parseFrontmatter(fm);
  const rows = tableRows(text);
  const leadRow = rows.find((row) => /主理人|lead/i.test(row.role));
  const tableIds = new Set(rows.map((row) => row.agent));
  const allIds = [...String(text).matchAll(ID_IN_BACKTICKS)].map((m) => m[1]);
  const inferredLead =
    leadRow?.agent ||
    allIds.find((id) => !tableIds.has(id) && /(?:^|-)lead$|chief-editor$/.test(id)) ||
    allIds.find((id) => !tableIds.has(id)) ||
    null;
  if (!inferredLead) return null;
  const members = rows
    .filter((row) => row.agent !== inferredLead)
    .filter((row, index, list) => list.findIndex((x) => x.agent === row.agent) === index);
  return {
    schema: 1,
    id: dirName,
    name: meta.displayName || meta.name || dirName,
    description: meta.description || '',
    lead: inferredLead,
    members,
    source: 'local',
    marketId: null
  };
}

export async function loadTeams() {
  const root = skillsRoot();
  let dirs = [];
  try {
    dirs = (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('team-'))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
  const teams = [];
  for (const dir of dirs) {
    if (!/^team-[a-z0-9-]+$/.test(dir)) continue;
    const skillDir = join(root, dir);
    let team = null;
    let derived = false;
    try {
      team = JSON.parse(await readFile(join(skillDir, 'team.json'), 'utf8'));
      if (!team || typeof team !== 'object' || !team.lead) team = null;
    } catch {
      team = null;
    }
    if (!team) {
      team = await deriveTeam(skillDir, dir);
      derived = Boolean(team);
    }
    if (!team) continue;
    teams.push({
      ...team,
      id: team.id || dir,
      dir,
      skillDir,
      skillPath: join(skillDir, 'SKILL.md'),
      derived
    });
  }
  return teams;
}

export async function saveTeam(team) {
  const dir = join(skillsRoot(), assertTeamDirName(team.id));
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'team.json'), `${JSON.stringify(team, null, 2)}\n`, 'utf8');
  return dir;
}

export function teamMemberIds(team) {
  const ids = [];
  if (team?.lead) ids.push(team.lead);
  for (const member of team?.members || []) {
    const id = typeof member === 'string' ? member : member?.agent;
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}
