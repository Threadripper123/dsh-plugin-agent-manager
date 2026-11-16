/** dsh 专家管理：侧边栏入口 + 独立页面。 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-agent-manager/client',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useState } = React;

    const ID = 'agent-manager';
    const API = '/api/dsh-plugin-agent-manager';
    const STYLE_ID = 'dsh-am-style';

    const CSS = `
.dsh-am{height:100%;min-height:420px;box-sizing:border-box;display:flex;flex-direction:column;color:var(--dsw-alias-label-primary,#1f2328);font-size:13px}
.dsh-am-head{padding:18px 22px 8px;display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px 18px}
.dsh-am-title{font-size:19px;font-weight:650;letter-spacing:.2px;margin:0}
.dsh-am-sub{color:var(--dsw-alias-label-tertiary,#8b949e);font-size:12px}
.dsh-am-stats{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto}
.dsh-am-stat{border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.24));border-radius:999px;padding:3px 10px;font-size:12px;background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.05))}
.dsh-am-stat b{font-variant-numeric:tabular-nums}
.dsh-am-tabs{display:flex;gap:4px;padding:4px 22px 0;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18))}
.dsh-am-tab{border:0;background:transparent;color:var(--dsw-alias-label-secondary,#57606a);padding:8px 14px;border-radius:8px 8px 0 0;cursor:pointer;font:inherit}
.dsh-am-tab[data-active=true]{color:var(--dsw-alias-label-primary,#1f2328);background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1));font-weight:600}
.dsh-am-body{flex:1 1 auto;min-height:0;overflow:auto;padding:14px 22px 28px}
.dsh-am-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.dsh-am-input,.dsh-am-select{font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.06));border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.24));border-radius:8px;padding:6px 10px;outline:none;min-width:0}
.dsh-am-input{flex:1 1 220px;max-width:420px}
.dsh-am-select{padding:6px 8px}
.dsh-am-btn{font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.24));background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.06));color:inherit;border-radius:8px;padding:5px 11px}
.dsh-am-btn:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12))}
.dsh-am-btn[disabled]{opacity:.5;cursor:default}
.dsh-am-btn.danger{color:var(--dsw-alias-label-danger,#b42318);border-color:color-mix(in srgb,var(--dsw-alias-label-danger,#b42318) 35%,transparent)}
.dsh-am-btn.primary{background:var(--dsw-alias-label-primary,#1f2328);color:var(--dsw-alias-bg-layer-1,#fff);border-color:transparent}
.dsh-am-list{display:flex;flex-direction:column;gap:8px}
.dsh-am-row{border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18));border-radius:12px;padding:11px 13px;background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.04));display:flex;gap:12px;align-items:flex-start}
.dsh-am-row[data-disabled=true]{opacity:.62}
.dsh-am-main{flex:1 1 auto;min-width:0}
.dsh-am-name{font-weight:620;display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.dsh-am-id{font-family:var(--dsh-font-mono,ui-monospace,Menlo,Consolas,monospace);font-size:11px;color:var(--dsw-alias-label-tertiary,#8b949e)}
.dsh-am-role{font-size:11px;color:var(--dsw-alias-label-secondary,#57606a);border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.22));border-radius:999px;padding:0 7px}
.dsh-am-desc{color:var(--dsw-alias-label-secondary,#57606a);font-size:12px;line-height:1.55;margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.dsh-am-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}
.dsh-am-tag{font-size:10.5px;color:var(--dsw-alias-label-secondary,#57606a);background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1));border-radius:999px;padding:1px 7px}
.dsh-am-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;flex:0 0 auto;max-width:230px}
.dsh-am-switch{position:relative;width:38px;height:22px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.24));background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12));cursor:pointer;flex:0 0 auto;padding:0}
.dsh-am-switch::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:0 1px 2px rgba(0,0,0,.2);transition:left .15s}
.dsh-am-switch[data-on=true]{background:#2da44e;border-color:#2da44e}
.dsh-am-switch[data-on=true]::after{left:18px}
.dsh-am-team-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:10px}
.dsh-am-card{border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18));border-radius:13px;padding:13px;background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.04));display:flex;flex-direction:column;gap:8px}
.dsh-am-card[data-disabled=true]{opacity:.64}
.dsh-am-card-head{display:flex;gap:8px;align-items:flex-start}
.dsh-am-card-head .dsh-am-main{flex:1}
.dsh-am-chips{display:flex;gap:5px;flex-wrap:wrap}
.dsh-am-chip{font-size:11px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.22));border-radius:999px;padding:1px 8px;color:var(--dsw-alias-label-secondary,#57606a)}
.dsh-am-chip[data-missing=true]{color:#b42318;border-color:rgba(180,35,24,.4)}
.dsh-am-chip[data-lead=true]{font-weight:600;color:var(--dsw-alias-label-primary,#1f2328)}
.dsh-am-muted{color:var(--dsw-alias-label-tertiary,#8b949e);font-size:12px}
.dsh-am-empty{padding:40px 0;text-align:center;color:var(--dsw-alias-label-tertiary,#8b949e)}
.dsh-am-overlay{position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:80;display:flex;align-items:center;justify-content:center;padding:24px}
.dsh-am-modal{background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#1f2328);border-radius:14px;max-width:820px;width:100%;max-height:82vh;display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.24));box-shadow:0 18px 60px rgba(0,0,0,.3)}
.dsh-am-modal-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18))}
.dsh-am-modal-head .dsh-am-main{flex:1}
.dsh-am-modal-body{overflow:auto;padding:14px 16px}
.dsh-am-pre{white-space:pre-wrap;word-break:break-word;font-family:var(--dsh-font-mono,ui-monospace,Menlo,Consolas,monospace);font-size:11.5px;line-height:1.6;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08));border-radius:10px;padding:12px;margin:10px 0 0}
.dsh-am-toast{position:fixed;right:22px;bottom:22px;z-index:90;background:var(--dsw-alias-label-primary,#1f2328);color:var(--dsw-alias-bg-layer-1,#fff);padding:9px 13px;border-radius:10px;font-size:12px;max-width:420px;box-shadow:0 8px 30px rgba(0,0,0,.25)}
.dsh-am-toast[data-kind=error]{background:#b42318}
.dsh-am-icon{display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;line-height:1;border:1px solid currentColor;border-radius:6px;width:20px;height:20px}
`;

    function ensureStyle() {
      let style = document.getElementById(STYLE_ID);
      if (!style) {
        style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = CSS;
        document.head.appendChild(style);
      }
    }

    function removeStyle() {
      document.getElementById(STYLE_ID)?.remove();
    }

    function apiUrl(path) {
      if (typeof document === 'undefined' || !document.baseURI) return path;
      try {
        const base = new URL(document.baseURI);
        if (!base.pathname.endsWith('/')) base.pathname += '/';
        return new URL(path.replace(/^\//, ''), base.href).href;
      } catch {
        return path;
      }
    }

    async function api(path, options = {}) {
      const headers = {};
      let body;
      if (options.body !== undefined) {
        headers['content-type'] = 'application/json';
        headers['x-dsh-agent-manager'] = '1';
        body = JSON.stringify(options.body);
      }
      const res = await fetch(apiUrl(`${API}${path}`), {
        method: options.method || 'GET',
        headers,
        body,
        credentials: 'same-origin'
      });
      let payload = null;
      try {
        payload = await res.json();
      } catch {
        throw new Error(`接口返回异常（HTTP ${res.status}）`);
      }
      if (!payload?.ok) throw new Error(payload?.error || `请求失败（HTTP ${res.status}）`);
      return payload.data;
    }

    function Icon({ size }) {
      const px = typeof size === 'number' ? Math.max(12, Math.round(size * 0.72)) : 16;
      return h('span', { className: 'dsh-am-icon', style: { width: px, height: px, fontSize: Math.max(9, px - 6) } }, '专');
    }

    function Switch({ on, disabled, onChange, title }) {
      return h('button', {
        type: 'button',
        className: 'dsh-am-switch',
        'data-on': on ? 'true' : 'false',
        disabled,
        title: title || (on ? '点击禁用' : '点击启用'),
        onClick: onChange
      });
    }

    function Tab({ id, active, children, onClick }) {
      return h('button', {
        type: 'button',
        className: 'dsh-am-tab',
        'data-active': active === id ? 'true' : 'false',
        onClick: () => onClick(id)
      }, children);
    }

    function Page() {
      const [state, setState] = useState(null);
      const [tab, setTab] = useState('agents');
      const [q, setQ] = useState('');
      const [status, setStatus] = useState('all');
      const [teamFilter, setTeamFilter] = useState('all');
      const [market, setMarket] = useState(null);
      const [marketQ, setMarketQ] = useState('');
      const [marketType, setMarketType] = useState('all');
      const [marketCat, setMarketCat] = useState('all');
      const [trash, setTrash] = useState([]);
      const [detail, setDetail] = useState(null);
      const [busy, setBusy] = useState('');
      const [toast, setToast] = useState(null);
      const toastTimer = React.useRef(null);

      const notify = useCallback((message, kind = 'ok') => {
        setToast({ message, kind });
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 4200);
      }, []);

      const load = useCallback(async () => {
        try {
          setState(await api('/state'));
        } catch (err) {
          notify(err.message, 'error');
        }
      }, [notify]);

      const loadTrash = useCallback(async () => {
        try {
          setTrash(await api('/trash'));
        } catch (err) {
          notify(err.message, 'error');
        }
      }, [notify]);

      const loadMarket = useCallback(async (refresh = false) => {
        try {
          const params = new URLSearchParams({
            q: marketQ,
            type: marketType,
            category: marketCat
          });
          if (refresh) params.set('refresh', '1');
          setMarket(await api(`/market?${params.toString()}`));
        } catch (err) {
          setMarket({ items: [], categories: [], total: 0, error: err.message });
        }
      }, [marketQ, marketType, marketCat]);

      useEffect(() => {
        load();
        loadTrash();
      }, [load, loadTrash]);

      useEffect(() => {
        if (tab !== 'market') return undefined;
        const timer = setTimeout(() => loadMarket(false), 260);
        return () => clearTimeout(timer);
      }, [tab, loadMarket]);

      useEffect(() => {
        if (tab === 'trash') loadTrash();
      }, [tab, loadTrash]);

      const agents = state?.agents || [];
      const teams = state?.teams || [];
      const filteredAgents = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return agents.filter((agent) => {
          if (status === 'enabled' && agent.disabled) return false;
          if (status === 'disabled' && !agent.disabled) return false;
          if (teamFilter === 'in-team' && agent.teamIds.length === 0) return false;
          if (teamFilter === 'solo' && agent.teamIds.length > 0) return false;
          if (!needle) return true;
          return `${agent.name} ${agent.agentName} ${agent.id} ${agent.description}`.toLowerCase().includes(needle);
        });
      }, [agents, q, status, teamFilter]);

      async function toggleAgent(agent) {
        setBusy(agent.id);
        try {
          await api('/toggle', { method: 'POST', body: { kind: 'agent', ids: [agent.id], enabled: agent.disabled } });
          await load();
          notify(agent.disabled ? `已启用 ${agent.name}` : `已禁用 ${agent.name}（新会话生效）`);
        } catch (err) {
          notify(err.message, 'error');
        } finally {
          setBusy('');
        }
      }

      async function toggleTeam(team) {
        setBusy(team.id);
        try {
          await api('/toggle', { method: 'POST', body: { kind: 'team', ids: [team.id], enabled: !team.enabled } });
          await load();
          notify(team.enabled ? `已停用 ${team.name}` : `已启用 ${team.name}（新会话生效）`);
        } catch (err) {
          notify(err.message, 'error');
        } finally {
          setBusy('');
        }
      }

      async function trashItem(kind, id, name) {
        if (!window.confirm(`确定卸载「${name}」？文件会移入回收站，可恢复。`)) return;
        setBusy(id);
        try {
          const result = await api('/trash', { method: 'POST', body: { kind, id } });
          await load();
          await loadTrash();
          notify(`已移入回收站（${result.moved} 项）`);
        } catch (err) {
          notify(err.message, 'error');
        } finally {
          setBusy('');
        }
      }

      async function installItem(item) {
        setBusy(item.marketId);
        try {
          const result = await api('/market/install', {
            method: 'POST',
            body: { marketId: item.marketId, conflict: 'skip' }
          });
          await load();
          await loadMarket(false);
          notify(`安装完成：新增 ${result.installed.length}，跳过 ${result.skipped.length}`);
        } catch (err) {
          notify(err.message, 'error');
        } finally {
          setBusy('');
        }
      }

      async function restore(entry) {
        setBusy(entry.trashId);
        try {
          await api('/restore', { method: 'POST', body: { trashId: entry.trashId } });
          await load();
          await loadTrash();
          notify('已恢复');
        } catch (err) {
          notify(err.message, 'error');
        } finally {
          setBusy('');
        }
      }

      async function purge(entry) {
        if (!window.confirm('彻底删除后无法恢复，确定继续？')) return;
        setBusy(entry.trashId);
        try {
          await api('/purge', { method: 'POST', body: { trashId: entry.trashId } });
          await loadTrash();
          notify('已彻底删除');
        } catch (err) {
          notify(err.message, 'error');
        } finally {
          setBusy('');
        }
      }

      async function openDetail(kind, id) {
        setDetail({ loading: true, kind, id });
        try {
          const data = await api(`/detail?kind=${kind}&id=${encodeURIComponent(id)}`);
          setDetail({ loading: false, ...data });
        } catch (err) {
          setDetail({ loading: false, error: err.message, kind, id });
        }
      }

      function renderAgentRow(agent) {
        const teamNames = (agent.teamIds || []).map((teamId) => teams.find((team) => team.id === teamId)?.name || teamId);
        return h('div', { className: 'dsh-am-row', key: agent.id, 'data-disabled': agent.disabled ? 'true' : 'false' },
          h('div', { className: 'dsh-am-main' },
            h('div', { className: 'dsh-am-name' },
              h('span', null, agent.name),
              h('span', { className: 'dsh-am-role' }, agent.profession || '专家'),
              h('span', { className: 'dsh-am-id' }, agent.id)
            ),
            h('div', { className: 'dsh-am-desc' }, agent.description || '（无描述）'),
            teamNames.length > 0 && h('div', { className: 'dsh-am-tags' }, teamNames.map((name) => h('span', { className: 'dsh-am-tag', key: name }, name)))
          ),
          h('div', { className: 'dsh-am-actions' },
            h(Switch, {
              on: !agent.disabled,
              disabled: busy === agent.id,
              onChange: () => toggleAgent(agent)
            }),
            h('button', { type: 'button', className: 'dsh-am-btn', onClick: () => openDetail('agent', agent.id) }, '详情'),
            h('button', {
              type: 'button',
              className: 'dsh-am-btn danger',
              disabled: busy === agent.id,
              onClick: () => trashItem('agent', agent.id, agent.name)
            }, '卸载')
          )
        );
      }

      function renderTeamCard(team) {
        const lead = team.lead;
        return h('div', { className: 'dsh-am-card', key: team.id, 'data-disabled': team.enabled ? 'false' : 'true' },
          h('div', { className: 'dsh-am-card-head' },
            h('div', { className: 'dsh-am-main' },
              h('div', { className: 'dsh-am-name' }, h('span', null, team.name), h('span', { className: 'dsh-am-id' }, team.id)),
              h('div', { className: 'dsh-am-desc' }, team.description || '（无描述）')
            ),
            h(Switch, { on: team.enabled, disabled: busy === team.id, onChange: () => toggleTeam(team) })
          ),
          h('div', { className: 'dsh-am-chips' },
            h('span', {
              className: 'dsh-am-chip',
              'data-lead': 'true',
              'data-missing': team.leadExists ? 'false' : 'true'
            }, `主理人：${lead}${team.leadExists ? '' : '（缺失）'}`),
            (team.members || []).map((member) => h('span', {
              className: 'dsh-am-chip',
              key: member.agent,
              'data-missing': member.missing ? 'true' : 'false'
            }, `${member.role || '成员'}：${member.agent}`))
          ),
          h('div', { className: 'dsh-am-actions', style: { maxWidth: 'none', justifyContent: 'flex-start' } },
            h('button', { type: 'button', className: 'dsh-am-btn', onClick: () => openDetail('team', team.id) }, '详情'),
            h('button', {
              type: 'button',
              className: 'dsh-am-btn danger',
              disabled: busy === team.id,
              onClick: () => trashItem('team', team.id, team.name)
            }, '整组卸载')
          )
        );
      }

      function renderDetail() {
        if (!detail) return null;
        return h('div', { className: 'dsh-am-overlay', onClick: () => setDetail(null) },
          h('div', { className: 'dsh-am-modal', onClick: (event) => event.stopPropagation() },
            h('div', { className: 'dsh-am-modal-head' },
              h('div', { className: 'dsh-am-main' },
                h('div', { className: 'dsh-am-name' }, detail.loading ? '加载中…' : (detail.kind === 'team' ? detail.team?.name : (detail.name || detail.meta?.name)) || detail.id),
                h('div', { className: 'dsh-am-id' }, detail.id)
              ),
              h('button', { type: 'button', className: 'dsh-am-btn', onClick: () => setDetail(null) }, '关闭')
            ),
            h('div', { className: 'dsh-am-modal-body' },
              detail.error && h('div', { className: 'dsh-am-muted' }, detail.error),
              !detail.loading && !detail.error && detail.kind === 'agent' && h('div', null,
                h('div', { className: 'dsh-am-muted' }, detail.meta?.description || ''),
                h('pre', { className: 'dsh-am-pre' }, detail.body || '')
              ),
              !detail.loading && !detail.error && detail.kind === 'team' && h('div', null,
                h('div', { className: 'dsh-am-muted' }, detail.team?.description || ''),
                h('div', { className: 'dsh-am-chips', style: { marginTop: 10 } },
                  (detail.members || []).map((member) => h('span', {
                    className: 'dsh-am-chip',
                    key: member.agent,
                    'data-missing': member.exists ? 'false' : 'true',
                    'data-lead': member.agent === detail.team?.lead ? 'true' : 'false'
                  }, `${member.role || '成员'}：${member.agent}`))
                )
              )
            )
          )
        );
      }

      return h('div', { className: 'dsh-am' },
        h('div', { className: 'dsh-am-head' },
          h('div', null,
            h('h1', { className: 'dsh-am-title' }, '专家管理'),
            h('div', { className: 'dsh-am-sub' }, '管理 ~/.codebuddy/agents 与专家团，改动对新会话生效')
          ),
          h('div', { className: 'dsh-am-stats' },
            h('span', { className: 'dsh-am-stat' }, '专家 ', h('b', null, state?.totals?.agents ?? '—')),
            h('span', { className: 'dsh-am-stat' }, '启用 ', h('b', null, state?.totals?.enabled ?? '—')),
            h('span', { className: 'dsh-am-stat' }, '禁用 ', h('b', null, state?.totals?.disabled ?? '—')),
            h('span', { className: 'dsh-am-stat' }, '团队 ', h('b', null, state?.totals?.teams ?? '—')),
            h('button', { type: 'button', className: 'dsh-am-btn', onClick: () => { load(); loadTrash(); if (tab === 'market') loadMarket(true); } }, '刷新')
          )
        ),
        h('div', { className: 'dsh-am-tabs' },
          h(Tab, { id: 'agents', active: tab, onClick: setTab }, `专家（${agents.length}）`),
          h(Tab, { id: 'teams', active: tab, onClick: setTab }, `专家团（${teams.length}）`),
          h(Tab, { id: 'market', active: tab, onClick: setTab }, '市场'),
          h(Tab, { id: 'trash', active: tab, onClick: setTab }, `回收站（${trash.length}）`)
        ),
        h('div', { className: 'dsh-am-body' },
          tab === 'agents' && h('div', null,
            h('div', { className: 'dsh-am-toolbar' },
              h('input', {
                className: 'dsh-am-input',
                placeholder: '搜索名称、ID、描述…',
                value: q,
                onChange: (event) => setQ(event.target.value)
              }),
              h('select', { className: 'dsh-am-select', value: status, onChange: (event) => setStatus(event.target.value) },
                h('option', { value: 'all' }, '全部状态'),
                h('option', { value: 'enabled' }, '已启用'),
                h('option', { value: 'disabled' }, '已禁用')
              ),
              h('select', { className: 'dsh-am-select', value: teamFilter, onChange: (event) => setTeamFilter(event.target.value) },
                h('option', { value: 'all' }, '全部来源'),
                h('option', { value: 'in-team' }, '仅团队'),
                h('option', { value: 'solo' }, '仅独立专家')
              )
            ),
            !state && h('div', { className: 'dsh-am-empty' }, '加载中…'),
            state && filteredAgents.length === 0 && h('div', { className: 'dsh-am-empty' }, '没有匹配的专家'),
            h('div', { className: 'dsh-am-list' }, filteredAgents.map(renderAgentRow))
          ),
          tab === 'teams' && h('div', null,
            !state && h('div', { className: 'dsh-am-empty' }, '加载中…'),
            state && teams.length === 0 && h('div', { className: 'dsh-am-empty' }, '还没有装专家团'),
            h('div', { className: 'dsh-am-team-grid' }, teams.map(renderTeamCard))
          ),
          tab === 'market' && h('div', null,
            h('div', { className: 'dsh-am-toolbar' },
              h('input', {
                className: 'dsh-am-input',
                placeholder: '搜索 WorkBuddy 专家/专家团…',
                value: marketQ,
                onChange: (event) => setMarketQ(event.target.value)
              }),
              h('select', { className: 'dsh-am-select', value: marketType, onChange: (event) => setMarketType(event.target.value) },
                h('option', { value: 'all' }, '全部类型'),
                h('option', { value: 'agent' }, '独立专家'),
                h('option', { value: 'team' }, '专家团')
              ),
              h('select', { className: 'dsh-am-select', value: marketCat, onChange: (event) => setMarketCat(event.target.value) },
                h('option', { value: 'all' }, '全部分类'),
                (market?.categories || []).map((cat) => h('option', { key: cat.id, value: cat.id }, cat.name))
              ),
              h('button', { type: 'button', className: 'dsh-am-btn', onClick: () => loadMarket(true) }, '刷新市场')
            ),
            market?.error && h('div', { className: 'dsh-am-muted', style: { marginBottom: 10 } }, market.error),
            market?.warning && h('div', { className: 'dsh-am-muted', style: { marginBottom: 10 } }, market.warning),
            !market && h('div', { className: 'dsh-am-empty' }, '加载市场…'),
            market && market.items.length === 0 && h('div', { className: 'dsh-am-empty' }, '没有匹配的条目'),
            h('div', { className: 'dsh-am-list' }, (market?.items || []).map((item) => h('div', { className: 'dsh-am-row', key: item.marketId },
              h('div', { className: 'dsh-am-main' },
                h('div', { className: 'dsh-am-name' },
                  h('span', null, item.name),
                  h('span', { className: 'dsh-am-role' }, item.type === 'team' ? `专家团 · ${item.memberCount} 人` : '专家'),
                  h('span', { className: 'dsh-am-id' }, item.marketId)
                ),
                h('div', { className: 'dsh-am-desc' }, item.description || '（无描述）'),
                h('div', { className: 'dsh-am-tags' }, (item.tags || []).slice(0, 4).map((tag) => h('span', { className: 'dsh-am-tag', key: tag }, tag)))
              ),
              h('div', { className: 'dsh-am-actions' },
                item.installed
                  ? h('span', { className: 'dsh-am-muted' }, '已安装')
                  : h('button', {
                      type: 'button',
                      className: 'dsh-am-btn primary',
                      disabled: busy === item.marketId,
                      onClick: () => installItem(item)
                    }, busy === item.marketId ? '安装中…' : '安装')
              )
            ))),
            market && market.total > market.items.length && h('div', { className: 'dsh-am-muted', style: { marginTop: 10 } }, `仅显示前 ${market.items.length} / ${market.total} 条`)
          ),
          tab === 'trash' && h('div', null,
            trash.length === 0 && h('div', { className: 'dsh-am-empty' }, '回收站是空的'),
            h('div', { className: 'dsh-am-list' }, trash.map((entry) => h('div', { className: 'dsh-am-row', key: entry.trashId },
              h('div', { className: 'dsh-am-main' },
                h('div', { className: 'dsh-am-name' }, h('span', null, entry.id), h('span', { className: 'dsh-am-role' }, entry.kind === 'team' ? '专家团' : '专家')),
                h('div', { className: 'dsh-am-desc' }, `${entry.items?.length || 0} 项 · ${new Date(entry.createdAt).toLocaleString()}`)
              ),
              h('div', { className: 'dsh-am-actions' },
                h('button', { type: 'button', className: 'dsh-am-btn primary', disabled: busy === entry.trashId, onClick: () => restore(entry) }, '恢复'),
                h('button', { type: 'button', className: 'dsh-am-btn danger', disabled: busy === entry.trashId, onClick: () => purge(entry) }, '彻底删除')
              )
            )))
          )
        ),
        renderDetail(),
        toast && h('div', { className: 'dsh-am-toast', 'data-kind': toast.kind }, toast.message)
      );
    }

    function apply(ctx) {
      ensureStyle();
      const stop = ctx.slots.inject('main', () => {
        const unregisterPage = ctx.slots.register({ name: 'main', key: ID }, Page);
        const stopSidebar = ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: ID,
          order: 30,
          label: () => '专家管理'
        }, Icon));
        return () => {
          try { stopSidebar?.(); } catch { /* ignore */ }
          try { unregisterPage?.(); } catch { /* ignore */ }
          removeStyle();
        };
      });
      return stop;
    }

    const exports = { apply, inject: ['slots'] };
    return exports;
  }
});
