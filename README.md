# dsh-subagent-acp-ui

DeepSeek Harness 的 ACP 子智能体体验层：基于官方 [`@deepseek-ai/dsh-subagent-acp`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/subagent/subagent-acp) 接入多个 ACP agent，提供配置页、连通性检测和路由 skill。

它**不实现任何 ACP 客户端**：每个目标挂载一个官方 provider 和一个官方 `dsh-tool-subagent` 实例，协议行为与官方一致。

## 安装

```powershell
# 锁定版本（推荐）
dsh plugin --profile <profile> add github:NewSpringWei/dsh-subagent-acp-ui#v0.1.0

# 或跟随 main
dsh plugin --profile <profile> add github:NewSpringWei/dsh-subagent-acp-ui
```

装好后重启实例，在「插件 → ACP 子智能体」里配置目标。

本地开发时用 `file:` 指向 checkout：

```powershell
dsh plugin --profile <profile> add file:<path-to-plugin>/code
```

## 配置

在「插件 → ACP 子智能体」里添加目标（选已验证的 agent 会自动填好启动命令与模型传法），或直接写配置：

```yaml
- id: subagent-acp-ui
  name: dsh-subagent-acp-ui
  config:
    targets:
      - name: opencode
        command: opencode
        args: ['acp']
        model: opencode/glm-5.3-flash-free
        env:
          OPENCODE_CONFIG_CONTENT: '{"model":"{model}"}'
```

每个目标需要：可执行文件、ACP 启动参数、该 CLI 已完成登录。`args` / `env` 里可写 `{model}` 占位符，保存时用 `model` 字段展开；`model` 留空则省略该参数。

## 提供什么

对每个启用的目标：

| 产物 | 名称 |
|---|---|
| 子代理 provider | `acp_<目标>` |
| 委派工具 | `subagent_acp_<目标>` |
| 精确命令 | `/acp-<目标> <任务>` |

另外注册：

- `acp_targets` 工具 —— 对话里增删改查目标；`test` 免费握手，`test mode="verify"` 花少量 token 真实验证
- `acp-subagent-routing` skill —— 何时委派、怎么切任务、失败时怎么分析

## 已验证的 agent

OpenCode、Qoder CLI、MiMo Code、CodeBuddy Code、Kimi Code、MiniMax Code。

适配记录见 [`adapters/README.md`](adapters/README.md)，预设数据在 [`adapters/agents.json`](adapters/agents.json)。

## 适配清单在线更新

预设数据支持在线更新，加/改 agent **不需要发版**：

- 插件启动时从 `adaptersUrl` 拉取清单（默认 jsDelivr 镜像），按 `id` 合并到内置预设
- 缓存位置：`~/.dsh/subagent-acp-ui/adapters-cache.json`，升级插件不会丢
- 手动触发刷新：`POST /acp-ui-refresh`
- 需要即时生效时，把 `adaptersUrl` 换成带 commit 的地址（绕过 jsDelivr 缓存）

只有**源码改动**才需要更新插件版本。

## 限制

- 不能在调用时选模型：模型按目标全局固定
- 不能续跑：每次委派都是一次性运行
- 没有进程池：每次委派都要付进程启动 + 握手成本

这些是官方 provider 的既定行为，本插件不绕过。

## 许可证

[MIT](LICENSE)

---

## English

The ACP subagent UX layer for DeepSeek Harness: builds on the official [`@deepseek-ai/dsh-subagent-acp`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/subagent/subagent-acp) provider to connect several ACP agents, with a configuration page, a connectivity probe, and a routing skill.

It does **not** implement any ACP client: each target mounts one official provider and one official `dsh-tool-subagent` instance, so protocol behavior is identical to the official one.

### Installation

```powershell
# pinned version (recommended)
dsh plugin --profile <profile> add github:NewSpringWei/dsh-subagent-acp-ui#v0.1.0

# or follow main
dsh plugin --profile <profile> add github:NewSpringWei/dsh-subagent-acp-ui
```

Restart the instance after installing, then configure targets under "Plugins → ACP Subagents".

For local development, point `file:` at the checkout:

```powershell
dsh plugin --profile <profile> add file:<path-to-plugin>/code
```

### Configuration

Add targets under "Plugins → ACP Subagents" (picking a verified agent auto-fills the launch command and model passing), or write the config directly:

```yaml
- id: subagent-acp-ui
  name: dsh-subagent-acp-ui
  config:
    targets:
      - name: opencode
        command: opencode
        args: ['acp']
        model: opencode/glm-5.3-flash-free
        env:
          OPENCODE_CONFIG_CONTENT: '{"model":"{model}"}'
```

Each target needs an executable, ACP launch arguments, and a logged-in CLI. `args` / `env` may contain a `{model}` placeholder that is expanded from the `model` field on save; leave `model` empty to omit that argument.

The plugin also ships an entry-placement card with one live switch per surface (left sidebar, Settings navigation, Plugins tab), so where the plugin appears is configurable without a save button.

### What it provides

For each enabled target:

| Artifact | Name |
|---|---|
| Subagent provider | `acp_<target>` |
| Delegation tool | `subagent_acp_<target>` |
| Exact command | `/acp-<target> <task>` |

It also registers:

- the `acp_targets` tool — add, edit, inspect, or remove targets in-session; `test` performs a free handshake, `test mode="verify"` spends a few tokens on a real check
- the `acp-subagent-routing` skill — when to delegate, how to split tasks, how to analyze failures

### Verified agents

OpenCode, Qoder CLI, MiMo Code, CodeBuddy Code, Kimi Code, MiniMax Code.

See [`adapters/README.md`](adapters/README.md) for adaptation notes and [`adapters/agents.json`](adapters/agents.json) for preset data.

### Online adapter updates

Preset data supports online updates, so adding or changing an agent does **not** require a release:

- on startup the plugin fetches the adapter list from `adaptersUrl` (jsDelivr by default) and merges it into the built-in presets by `id`
- cache: `~/.dsh/subagent-acp-ui/adapters-cache.json`, preserved across upgrades
- manual refresh: `POST /acp-ui-refresh`
- to apply immediately, use a commit-pinned URL for `adaptersUrl` (bypasses the jsDelivr cache)

Only **source changes** require a plugin version bump.

### Limitations

- no per-call model selection: the model is fixed per target
- no resume: every delegation is a one-shot run
- no process pool: each delegation pays process startup and handshake cost

These are established behaviors of the official provider and are not worked around by this plugin.

### License

[MIT](LICENSE)

