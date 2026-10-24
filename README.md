# dsh-subagent-acp-ui

DeepSeek Harness 的 **ACP 子智能体体验层**：基于官方 [`@deepseek-ai/dsh-subagent-acp`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/subagent/subagent-acp) 接入多个 ACP agent，提供配置页、握手测试和路由 skill。

它**不实现任何 ACP 客户端**。每个目标挂载一个官方 ACP provider 插件和一个官方 `dsh-tool-subagent` 实例；ACP 协议行为与官方逐字节一致。

## 它做什么

对每个配置的目标：

| 产物 | 名称 |
|---|---|
| 子代理 provider | `acp_<目标>` |
| 面向模型的委派工具 | `subagent_acp_<目标>` |

另外注册：

- `acp_targets` 工具 —— 在对话里增删改查目标、跑握手测试，无需打开配置页。
- `acp-subagent-routing` skill —— 渐进披露：什么时候委派、怎么选目标、有哪些真实限制。
- `/acp-<目标> <任务>` 命令 —— 精确唤醒：用户已经明确要派给谁时，一条命令直接发起委派，跳过「让模型调用工具」这一轮。命令走同一个官方 provider，不新增 ACP 路径。
- `/acp-ui-test` 端点 —— 配置页「测试」按钮使用，只做握手，不消耗模型 token。

## 精确唤醒命令

每个启用的目标注册一个 `/acp-<目标>` 命令，例如配置了 `qoder` 就是 `/acp-qoder`：

```
/acp-qoder 把 src/a.ts 的错误处理改成 Result 风格，只改这一个文件，改完回报路径
```

行为与模型调用 `subagent_acp_qoder` 工具一致：启动目标进程、跑一次 ACP 握手、把任务交给它，结果回到当前会话。区别只是省掉了模型先决定“要不要派、派给谁”的那一轮。命令不会弹模型选择，模型用该目标的全局配置。


## 安装

```powershell
dsh plugin --profile <profile> add file:<path-to-plugin>/code
```

安装后打开「插件 → ACP 子智能体」配置目标，或直接用 `acp_targets` 工具。

## 配置示例

```yaml
- id: subagent-acp-ui
  name: dsh-subagent-acp-ui
  config:
    targets:
      - name: agent-a
        command: agent-a-cli
        args: ['acp']
        permission: auto
      - name: agent-b
        command: agent-b-cli
        args: ['--acp']
        permission: allow
```

每个目标的三要素：**可执行文件路径**、**ACP 子命令/参数**、**该 CLI 已完成登录**。

## 全局固定模型

`model` 字段给该目标固定一个模型，每次委派都用它。模型如何传给 CLI 由你决定：在 `args` 或 `env` 的值里写 `{model}` 占位符，保存时展开。

```yaml
      - name: agent-a            # 通过命令行参数传
        command: agent-a-cli
        args: ['--acp', '--model', '{model}']
        model: some-model-id
      - name: agent-b            # 通过配置类环境变量传
        command: agent-b-cli
        args: ['acp']
        model: provider/model-id
        env:
          SOME_CONFIG_CONTENT: '{"model":"{model}"}'
```

规则：

- `model` 为空时，含 `{model}` 的参数对会被整体省略，环境变量项会被删除，不会留下悬空参数。
- 配置页的「获取模型」按钮会实际握一次手，列出该 CLI 在 `session/new` 里公布的模型；选中后写入 `model`。
- 模型是否真的生效取决于该 CLI 认不认这个参数/环境变量；「获取模型」返回的 `currentValue` 就是它启动后的实际模型。

## 字段

| 字段 | 默认 | 说明 |
|---|---|---|
| `name` | 必填 | 实例名，决定 provider、工具名；必须唯一 |
| `command` | 必填 | 启动该 ACP agent 的可执行文件 |
| `args` | `['acp']` | 启动参数；可写 `{model}` 占位符 |
| `model` | 空 | 全局固定模型；留空用 CLI 默认 |
| `permission` | `auto` | 自动应答权限请求：`allow` / `reject` / `auto` |
| `env` | `{}` | 额外环境变量；值里可写 `{model}` 占位符 |
| `enabled` | `true` | 关闭后不注册，但保留配置 |

## 失败时用户看到什么

配置页的「测试」按钮与 `acp_targets test` 都不消耗模型 token。失败时只给**事实**：

1. **失败阶段**：`process` / `initialize` / `new-session` / `result`
2. **原始错误**：ACP 错误消息
3. **CLI stderr 尾部**（最多 1500 字符）——多数 CLI 会自己写明原因

插件**不枚举原因、不给建议**。配置页会提示把错误发到对话里，由主智能体结合原始错误、退出码和 stderr 分析；`acp_targets test` 也把同样的原始事实交给模型。

这样设计的好处是：新的 CLI 失败模式不需要更新插件，分析能力跟着主模型走。

真正委派失败时，官方 provider 返回一行 `Subagent failure (provider: ACP; stage: ...; category: ...)`；routing skill 教模型按「定位阶段 → 读事实 → 复现一次 → 归因到最小可验证假设 → 给用户一个动作」的顺序分析，而不是套固定结论。

## 任务颗粒度（routing skill 的一部分）

routing skill 不只回答「何时委派」，还覆盖：

- **切分标准**：一次委派 = 一个能独立验收的交付物；太小的自己做，太大的拆开
- **必给要素**：工作目录、约束、验收标准、产物形式、回报格式
- **结果落地**：要求子智能体直接写文件并回报路径，而不是把内容贴回对话
- **失败处理**：按 `stage / category` 决定是修配置、换目标，还是收回主会话

skill 是渐进披露的：只有 name / description / whenToUse 进入工具目录，正文按需加载。

## 真实限制（来自官方 ACP provider）

- **不能在调用时选子智能体模型**：官方 provider 不声明 `agentOptions` 能力，请求会被 seam 拒绝。模型由该 CLI 自己的配置决定。
- **不能续跑**：ACP 子智能体不接受后续消息，每次委派都是一次性运行。
- **没有进程池**：每次委派都付一次进程启动 + ACP 握手成本。
- **不支持** preset、委派深度上限、结构化输出。
- **只回传最终文本**：子智能体的推理与工具调用不会进入父会话。

这些都是官方 provider 的既定行为，本插件不绕过。

## 与旧 `dsh-subagent-opencode` 的关系

旧插件自带一套 ACP 驱动与 SSH 传输，已被官方 provider 取代。本插件剥离了 SSH（远端应当是「工作空间」，不是「子代理」），只保留体验层，并把驱动换成官方实现。

## 许可证

[MIT](LICENSE)
