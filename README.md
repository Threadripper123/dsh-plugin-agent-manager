# dsh-plugin-agent-manager

在 DeepSeek Harness 里管理自定义专家与专家团。

## 功能

- 侧边栏「专家管理」入口 + 独立页面
- 专家列表：搜索、按状态/团队筛选、详情预览
- 启用/禁用：写入/删除 agent frontmatter 的 `disable-model-invocation`
- 专家团：主理人 + 成员卡片，整组启停、整组卸载
- 回收站：卸载移入 `~/.dsh/agent-manager/trash/`，可恢复或彻底删除
- 市场：从 WorkBuddy 专家市场安装单个专家或整团（lead + 全部成员 + team.json + 团队技能）

## 数据位置

| 内容 | 路径 |
|---|---|
| 专家 agent | `~/.codebuddy/agents/*.md` |
| 团队技能 | `~/.dsh/skills/team-*/` |
| 团队元数据 | `~/.dsh/skills/team-*/team.json` |
| 回收站 / 缓存 / 日志 | `~/.dsh/agent-manager/` |
| 市场清单（优先） | `~/.workbuddy/app/cache/experts/manifest.json` |

## 安装

1. 把本目录放到 `~/.dsh/profiles/desktop/plugin-agent-manager`
2. 在 `~/.dsh/profiles/desktop/package.json`：
   - `dependencies` 加 `"dsh-plugin-agent-manager": "file:./plugin-agent-manager"`
   - `dsh.profile.bundles` 追加 `"dsh-plugin-agent-manager"`
3. 在 profile 目录执行 `corepack pnpm install`
4. 完全退出并重开 DSH

## API

前缀 `/api/dsh-plugin-agent-manager`：

- `GET /state`
- `GET /detail?kind=agent|team&id=`
- `POST /toggle` `{kind,ids,enabled}`
- `POST /trash` `{kind,id}` / `GET /trash`
- `POST /restore` `{trashId}`
- `POST /purge` `{trashId}`
- `GET /market?q=&type=&category=&offset=&refresh=1`
- `POST /market/install` `{marketId,conflict}`

写操作需要请求头 `x-dsh-agent-manager: 1` 与 `content-type: application/json`。

## 测试

```bash
node --test test/*.test.js
```
