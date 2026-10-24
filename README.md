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

OpenCode、Qoder CLI、MiMo Code。

启动契约与官方入口在 `adapters/agents.json`，各家的适配记录在 `adapters/*.md`。新增一个 agent 只需改数据文件，不改代码。

## 限制

- 不能在调用时选模型：模型按目标全局固定
- 不能续跑：每次委派都是一次性运行
- 没有进程池：每次委派都要付进程启动 + 握手成本

这些是官方 provider 的既定行为，本插件不绕过。

## 许可证

[MIT](LICENSE)
