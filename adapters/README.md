# agent 适配记录

本目录只有两个文件：

- `agents.json` —— 程序读取的预设数据（「添加目标」下拉、在线更新）
- `README.md` —— 本记录

## 一览

| agent | 安装方式 | 启动命令 | ACP 入口 | 模型传法 |
|---|---|---|---|---|
| OpenCode | npm 全局安装 | `opencode` | `acp` 子命令 | `OPENCODE_CONFIG_CONTENT` 环境变量 |
| Qoder CLI | 官方安装器 | `qoderclicn` | `--acp` 开关 | `--model <id>` 参数 |
| MiMo Code | 官方安装器 | `mimo` | `acp` 子命令 | `MIMOCODE_CONFIG_CONTENT` 环境变量 |
| CodeBuddy Code | npm 全局安装 | `cmd /c codebuddy` | `--acp` 开关 | `--model <id>` 参数 |
| Kimi Code | 官方安装器 | `kimi` | `acp` 子命令 | `-m/--model <alias>` 全局参数 |
| MiniMax Code | npm 全局安装 | `cmd /c mcode` | `acp` 子命令 | `-m/--model <provider/model>` 全局参数 |

## 安装方式与启动命令

| 安装方式 | PATH 上 | 启动方式 | 启动命令写法 |
|---|---|---|---|
| 官方安装器 | 真实 `.exe` | 直接启动 | 命令名或绝对路径 |
| npm（`.exe` 型 shim，如 OpenCode） | `.cmd` 包装器，内部调用真实 exe | 经命令解析启动 | 命令名，插件自动解析到内部 exe |
| npm（`node <script>` 型 shim，如 CodeBuddy / MiniMax） | `.cmd` 调用 node 脚本 | 经系统 shell 启动 | `cmd /c <命令>` |

shim 形式变化时（`.exe` 型 ↔ `node <script>` 型），改启动命令为 `cmd`、参数以 `/c <命令>` 开头，或用「浏览…」选定真实可执行文件。

---

## OpenCode

**简介**：开源的 AI 编程 agent，提供终端与桌面两种形态。

- 官方入口：<https://opencode.ai/>
- 安装方式：npm 全局安装（`npm i -g @opencode/cli`）
- PATH 上：`.cmd` 型 shim，插件自动解析到内部 `opencode.exe`

**适配参数**

| 项 | 值 |
|---|---|
| 启动命令 | `opencode` |
| 启动参数 | `acp` |
| 模型传法 | `OPENCODE_CONFIG_CONTENT={"model":"{model}"}` |
| 模型列表 | 实测 51 个 |
| 当前模型 | `opencode/glm-5.3-flash-free`（GLM-5.3-Flash Free） |

**验证记录**

| 项 | 值 |
|---|---|
| 验证时间 | 2026-10-24 |
| 验证版本 | 2.1.4 |
| 握手耗时 | 约 1.5 s |
| 验证内容 | 握手、模型列表、真实调用 |

**说明**

1. PATH 上是 `.cmd` 包装器，由插件解析到内部 exe 后启动。
2. 桌面版自带的可执行文件不在 PATH；npm 安装后命令名为 `opencode`。
3. `currentValue` 是模型 id，配置页会映射成显示名。

---

## Qoder CLI

**简介**：Qoder 的终端编程 agent。

- 官方入口：<https://qoder.cn/cli>
- 安装方式：官方安装器（默认目录 `C:\Users\<用户>\.qoder-cn\bin\qoderclicn\`）
- PATH 上：真实 `.exe`，可直接启动

**适配参数**

| 项 | 值 |
|---|---|
| 启动命令 | `qoderclicn` |
| 启动参数 | `--acp --model {model}` |
| 模型传法 | `--model <id>` 参数 |
| 模型列表 | 实测 12 个 |
| 当前模型 | `dfmodel`（DeepSeek-Flash） |

**验证记录**

| 项 | 值 |
|---|---|
| 验证时间 | 2026-10-24 |
| 验证版本 | 1.1.78 |
| 握手耗时 | 约 1.5 s |
| 验证内容 | 握手、模型列表、真实调用 |

**说明**

1. ACP 入口为开关 `--acp`。
2. 模型通过 `--model <id>` 传入，无等价环境变量。
3. `currentValue` 是内部 id，与显示名不同，配置页做映射。

---

## MiMo Code

**简介**：小米的 AI 编程 agent，形态与 OpenCode 相近。

- 官方入口：<https://mimo.xiaomi.com/zh/mimocode>
- 安装方式：官方安装器（默认目录 `C:\Users\<用户>\.mimocode\bin\`）
- PATH 上：真实 `.exe`，可直接启动

**适配参数**

| 项 | 值 |
|---|---|
| 启动命令 | `mimo` |
| 启动参数 | `acp` |
| 模型传法 | `MIMOCODE_CONFIG_CONTENT={"model":"{model}"}` |
| 模型列表 | 实测 16 个 |
| 当前模型 | `mimo/mimo-auto`（MiMo Auto (free)/MiMo Auto） |

**验证记录**

| 项 | 值 |
|---|---|
| 验证时间 | 2026-10-24 |
| 验证版本 | 0.1.15 |
| 握手耗时 | 约 4.4 s |
| 验证内容 | 握手、模型列表、真实调用 |

**说明**

1. 冷启动约 4.4 s，探测超时预算需覆盖启动时间。
2. 模型配置另有 `~/.config/mimocode/mimocode.jsonc` 的 `model` 字段；适配采用环境变量注入。
3. `currentValue` 带 provider 前缀，配置页映射成显示名。

---

## CodeBuddy Code

**简介**：腾讯云代码助手 CodeBuddy 的命令行智能体，原生支持 ACP。

- 官方入口：<https://www.codebuddy.cn/cli/>
- ACP 文档：<https://www.codebuddy.cn/docs/cli/acp>
- 安装方式：npm 全局安装（`npm i -g @tencent-ai/codebuddy-code`）
- PATH 上：`node "<pkg>/bin/codebuddy"` 型 shim，经系统 shell 启动

**适配参数**

| 项 | 值 |
|---|---|
| 启动命令 | `cmd` |
| 启动参数 | `/c codebuddy --acp --model {model}` |
| 模型传法 | `--model <id>` 参数 |
| 模型列表 | 实测 19 个 |
| 当前模型 | `hy3`（Hy3，CLI 默认） |
| ACP 传输 | `--acp` 默认 stdio |

**验证记录**

| 项 | 值 |
|---|---|
| 验证时间 | 2026-10-26 |
| 验证版本 | 2.176.0 |
| 握手耗时 | 约 3.8 s |
| 验证内容 | 握手、模型列表、真实调用 |

**说明**

1. shim 为 `node <script>` 形式，经 `cmd /c` 启动。
2. `--permission-mode` 是 CLI 内部策略，与 ACP 的 `session/request_permission` 是两项独立配置。
3. 模型 id 与显示名不同（`hy4-preview` ↔ `Hy4 preview`），配置页做映射。

---

## Kimi Code

**简介**：Kimi 的终端编程 agent，提供 ACP 服务端。

- 官方入口：<https://www.kimi.com/>
- 安装方式：官方安装器（默认目录 `C:\Users\<用户>\.kimi-code\bin\`）
- PATH 上：真实 `.exe`，可直接启动

**适配参数**

| 项 | 值 |
|---|---|
| 启动命令 | `kimi` |
| 启动参数 | `-m {model} acp` |
| 模型传法 | `-m/--model <alias>` 全局参数 |
| 模型列表 | 实测 6 个 |
| 当前模型 | `kimi-code/kimi-for-coding`（K2.8 Preview） |
| 登录方式 | `kimi acp --login`，`--region mainland-cn\|global` |

**验证记录**

| 项 | 值 |
|---|---|
| 验证时间 | 2026-10-26 |
| 验证版本 | 2.3.2 |
| 握手耗时 | 约 1.0 s |
| 验证内容 | 握手、模型列表、真实调用 |

**说明**

1. ACP 入口为 `kimi acp`（stdio），模型选项 `-m` 位于子命令之前。
2. 新装后需重启 DSH，会话 PATH 才包含安装目录；未重启时可用绝对路径。
3. 模型列表来自 `session/new` 的 `configOptions`，与会话内可选模型一致。

---

## MiniMax Code

**简介**：MiniMax 的终端编程 agent，提供 ACP 服务端。

- 官方入口：<https://agent.minimax.cn/docs/cli/integrations>
- 安装方式：npm 全局安装（`npm i -g @minimax-ai/code`，命令 `mcode`）
- PATH 上：`node ".../@minimax-ai/code/cli.js"` 型 shim，经系统 shell 启动

**适配参数**

| 项 | 值 |
|---|---|
| 启动命令 | `cmd` |
| 启动参数 | `/c mcode -m {model} acp` |
| 模型传法 | `-m/--model <provider/model>` 全局参数 |
| 模型列表 | 实测 4 个 |
| 当前模型 | `m:minimax:MiniMax-M3.1-Flash:v:thinking`（M3.1-Flash · thinking） |
| 登录方式 | `mcode login` |

**验证记录**

| 项 | 值 |
|---|---|
| 验证时间 | 2026-10-26 |
| 验证版本 | 0.6.12 |
| 握手耗时 | 约 8.7 s |
| 验证内容 | 握手、模型列表、真实调用 |

**说明**

1. shim 为 `node cli.js` 形式，经 `cmd /c` 启动。
2. 模型选项 `-m/--model <provider/model>` 位于子命令之前。
3. 冷启动约 8.7 s，探测超时预算需覆盖启动时间。
