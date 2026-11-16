import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { lstat } from 'node:fs/promises';

export const AGENT_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const TEAM_DIR_RE = /^team-[a-z0-9][a-z0-9-]{0,63}$/;

export function homeDir() {
  return process.env.USERPROFILE?.trim() || homedir();
}

export function dshHome() {
  return process.env.DSH_HOME?.trim() || join(homeDir(), '.dsh');
}

export function agentRoot() {
  const override = process.env.DSH_AGENT_MANAGER_AGENTS_DIR?.trim();
  if (override) return override;
  const configDir = process.env.CODEBUDDY_CONFIG_DIR?.trim() || join(homeDir(), '.codebuddy');
  return join(configDir, 'agents');
}

export function skillsRoot() {
  return process.env.DSH_AGENT_MANAGER_SKILLS_DIR?.trim() || join(dshHome(), 'skills');
}

export function dataRoot() {
  return process.env.DSH_AGENT_MANAGER_DATA_DIR?.trim() || join(dshHome(), 'agent-manager');
}

export function trashRoot() {
  return join(dataRoot(), 'trash');
}

export function cacheRoot() {
  return join(dataRoot(), 'cache');
}

export function logFile() {
  return join(dataRoot(), 'agent-manager.log');
}

export function httpError(status, code, message) {
  const err = new Error(message);
  err.statusCode = status;
  err.code = code;
  return err;
}

export function assertAgentId(id) {
  if (typeof id !== 'string' || !AGENT_ID_RE.test(id)) {
    throw httpError(400, 'invalid_id', `非法的专家 ID：${String(id)}`);
  }
  return id;
}

export function assertTeamDirName(name) {
  if (typeof name !== 'string' || !TEAM_DIR_RE.test(name)) {
    throw httpError(400, 'invalid_team_dir', `非法的团队目录名：${String(name)}`);
  }
  return name;
}

function contain(root, candidate) {
  const r = resolve(root);
  const p = resolve(candidate);
  if (p !== r && !p.startsWith(r + sep)) {
    throw httpError(400, 'path_escape', '路径越界');
  }
  return p;
}

export function agentPath(id) {
  assertAgentId(id);
  const root = resolve(agentRoot());
  return contain(root, join(root, `${id}.md`));
}

export async function lstatSafe(path) {
  try {
    return await lstat(path);
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function assertNotSymlink(path) {
  const st = await lstatSafe(path);
  if (st?.isSymbolicLink()) {
    throw httpError(400, 'symlink_rejected', `拒绝操作符号链接：${path}`);
  }
  return st;
}
