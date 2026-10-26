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

| agent | 验证状态 | 备注 |
|---|---|---|
| OpenCode | ✅ | 握手、模型列表、真实测试全部通过 |
| Qoder CLI | ✅ | 握手、模型列表、真实测试全部通过 |
| MiMo Code | ✅ | 握手、模型列表、真实测试全部通过 |
| CodeBuddy Code | ✅ | 握手、模型列表、真实测试全部通过 |
| Kimi Code | ✅ | 链路通；真实测试返回 403（账号订阅不含 Kimi Code） |
| MiniMax Code | ✅ | 链路通；真实测试返回余额不足 |

**判定标准**：握手 + 模型列表通过，且真实测试能到达服务端并拿到业务响应（包括 403、余额不足这类账号层错误），即视为链路已通。账号额度不属于适配问题。

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
