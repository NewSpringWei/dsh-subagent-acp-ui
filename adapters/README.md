# 已验证 agent 适配记录

本目录只有两个文件：

- `agents.json` —— 程序读取的预设数据（「添加目标」下拉、在线更新）
- `README.md` —— 本记录

## 状态说明

- ✅ 已验证：握手 + 模型列表通过，真实测试能到达服务端并拿到业务响应（包括 403、余额不足这类账号层错误）
- ⚠️ 待登录验证：`session/new` 返回 `Authentication required`，需要先登录再验

**判定标准**：能测到账号受限（订阅不含权限、余额不足）就算链路通了——那属于账号问题，不是适配问题。

## 一览

| agent | 安装方式 | 启动命令 | ACP 入口 | 模型传法 | 状态 |
|---|---|---|---|---|---|
| OpenCode | npm 全局安装 | `opencode` | `acp` 子命令 | `OPENCODE_CONFIG_CONTENT` 环境变量 | ✅ |
| Qoder CLI | 官方安装器 | `qoderclicn` | `--acp` 开关 | `--model <id>` 参数 | ✅ |
| MiMo Code | 官方安装器 | `mimo` | `acp` 子命令 | `MIMOCODE_CONFIG_CONTENT` 环境变量 | ✅ |
| CodeBuddy Code | npm 全局安装 | `cmd /c codebuddy` | `--acp` 开关 | `--model <id>` 参数 | ✅ |
| Kimi Code | 官方安装器 | `kimi` | `acp` 子命令 | `-m/--model <alias>` 全局参数 | ✅ 已验证（账号受限） |
| MiniMax Code | npm 全局安装 | `cmd /c mcode` | `acp` 子命令 | `-m/--model <provider/model>` 全局参数 | ✅ 已验证（账号受限） |

## 安装方式的差异与对策

安装方式决定 PATH 上是什么，进而决定启动命令怎么写：

| 安装方式 | PATH 上 | 能否直接 spawn | 对策 |
|---|---|---|---|
| 官方安装器 | 真实 `.exe` | 能 | 启动命令直接写命令名或绝对路径 |
| npm（`.exe` 型 shim，如 OpenCode） | `.cmd` 包装器，内部调用真实 exe | 不能 | 插件自动解析 shim，找到内部 exe |
| npm（`node <script>` 型 shim，如 CodeBuddy / MiniMax） | `.cmd` 调用 node 脚本 | 不能，且解析器无法还原启动参数 | 用 `cmd /c <命令>` 交给系统 shell |

**风险**：npm 升级可能改变 shim 形式（`.exe` 型 ↔ `node <script>` 型）。届时自动解析失效，表现是 `ACP connection closed`。解决办法是：

1. 把启动命令改成 `cmd`、参数改成 `/c <命令> ...`
2. 或用「浏览…」直接选真实可执行文件

---

## OpenCode ✅

**简介**：开源的 AI 编程 agent，提供终端与桌面两种形态。

- 官方入口：<https://opencode.ai/>
- 安装方式：**npm 全局安装** `npm i -g @opencode/cli`（Windows 官方推荐）
- PATH 上：`.cmd` 型 shim → 插件自动解析到 `node_modules/@opencode/cli/bin/opencode.exe`

**适配参数**

| 项 | 值 |
|---|---|
| 启动命令 | `opencode` |
| 启动参数 | `acp` |
| 模型传法 | `OPENCODE_CONFIG_CONTENT={"model":"{model}"}` |
| 模型列表 | 实测 51 个 |
| 当前模型 | 形如 `opencode/glm-5.3-flash-free` |

**验证记录**

| 项 | 值 |
|---|---|
| 验证时间 | 2026-10-24 |
| 验证版本 | 2.1.4（npm） |
| 握手耗时 | 约 1.5 s |
| 已验证能力 | 握手、模型列表、真实测试、`/acp-opencode` 命令 |

**坑**

1. `.cmd` 包装器不能直接 spawn，会得到 `ACP connection closed`（约 200 ms 后退出）。
2. 桌面版自带的 `opencode-cli.exe` 不在 PATH，卸载桌面版后失效；npm 安装后命令名才稳定。
3. `currentValue` 是模型 id，配置页会映射成显示名。

---

## Qoder CLI ✅

**简介**：Qoder 的终端编程 agent。

- 官方入口：<https://qoder.cn/cli>
- 安装方式：**官方安装器**，默认装到 `C:\Users\<用户>\.qoder-cn\bin\qoderclicn\qoderclicn.exe`
- PATH 上：真实 `.exe`，可直接 spawn

**适配参数**

| 项 | 值 |
|---|---|
| 启动命令 | `qoderclicn` |
| 启动参数 | `--acp --model {model}` |
| 模型传法 | `--model <id>` 参数 |
| 模型列表 | 实测 12 个 |
| 当前模型 | 形如 `dfmodel`，显示名 `DeepSeek-Flash` |

**验证记录**

| 项 | 值 |
|---|---|
| 验证时间 | 2026-10-24 |
| 验证版本 | 未采集（安装包无版本号可解析） |
| 握手耗时 | 约 1.5 s |
| 已验证能力 | 握手、模型列表、真实测试、`/acp-qoder` 命令 |

**坑**

1. ACP 入口是开关 `--acp`，不是子命令 `acp`，写错会直接退出。
2. 模型只能通过 `--model <id>` 传，没有等价环境变量。
3. `currentValue` 是内部 id（`dfmodel`），与显示名（`DeepSeek-Flash`）不同，需要映射。

---

## MiMo Code ✅

**简介**：小米的 AI 编程 agent，形态与 OpenCode 高度相似。

- 官方入口：<https://mimo.xiaomi.com/zh/mimocode>
- 安装方式：**官方安装器**，默认装到 `C:\Users\<用户>\.mimocode\bin\mimo.exe`
- PATH 上：真实 `.exe`，可直接 spawn（与 OpenCode 的 shim 形成对照）

**适配参数**

| 项 | 值 |
|---|---|
| 启动命令 | `mimo` |
| 启动参数 | `acp` |
| 模型传法 | `MIMOCODE_CONFIG_CONTENT={"model":"{model}"}` |
| 模型列表 | 实测 16 个 |
| 当前模型 | 形如 `mimo/mimo-auto` |

**验证记录**

| 项 | 值 |
|---|---|
| 验证时间 | 2026-10-24 |
| 验证版本 | 未采集（安装包无版本号可解析） |
| 握手耗时 | 约 4.4 s（四家中最慢） |
| 已验证能力 | 握手、模型列表、真实测试、`/acp-mimo` 命令 |

**坑**

1. 冷启动慢，探测超时预算要留足（默认 12 s 够用；真实测试 120 s）。
2. 模型配置还有 `~/.config/mimocode/mimocode.jsonc` 一条路；适配选择环境变量注入，不改用户文件。
3. `currentValue` 带 provider 前缀（`mimo/mimo-auto`），配置页映射成显示名。

---

## CodeBuddy Code ✅

**简介**：腾讯云代码助手 CodeBuddy 的命令行智能体，原生支持 ACP，可作为服务端被编辑器接入。

- 官方入口：<https://www.codebuddy.cn/cli/>
- ACP 文档：<https://www.codebuddy.cn/docs/cli/acp>（镜像：<https://cloud.tencent.cn/document/product/1831/137021>）
- 安装方式：**npm 全局安装** `npm i -g @tencent-ai/codebuddy-code`
- PATH 上：`node "<pkg>/bin/codebuddy"` 型 shim → 解析器无法还原，必须 `cmd /c`

**适配参数**

| 项 | 值 |
|---|---|
| 启动命令 | `cmd` |
| 启动参数 | `/c codebuddy --acp --model {model}` |
| 模型传法 | `--model <id>` 参数 |
| 模型列表 | 实测 19 个 |
| ACP 传输 | `--acp` 默认 stdio |

**验证记录**

| 项 | 值 |
|---|---|
| 验证时间 | 2026-10-26 |
| 验证版本 | 2.176.0（npm） |
| 握手耗时 | 约 3.8 s |
| 已验证能力 | 握手、模型列表、真实测试、`--model` 参数 |

**坑**

1. npm shim 是 `node <script>` 形式（不是 `.exe` 包装器），只能用 `cmd /c`。
2. `--permission-mode` 是 CLI 内部策略，与 ACP 的 `session/request_permission` 是两回事。
3. 模型 id 与显示名不同（`hy4-preview` ↔ `Hy4 preview`）。

---

## Kimi Code ✅ 已验证（账号额度受限）

**简介**：Kimi 的终端编程 agent，提供 ACP 服务端。

- 官方入口：<https://www.kimi.com/>
- 安装方式：**官方安装器**，默认装到 `C:\Users\<用户>\.kimi-code\bin\kimi.exe`
- PATH 上：真实 `.exe`；新装后需要重启 DSH，会话 PATH 才会带进来（未重启时可用绝对路径）

**适配参数**

| 项 | 值 |
|---|---|
| 启动命令 | `kimi` |
| 启动参数 | `-m {model} acp`（全局选项在子命令前；留空则省略 `-m`） |
| 模型传法 | `-m/--model <alias>` 全局参数 |
| 模型列表 | 实测 6 个 |
| 当前模型 | `kimi-code/kimi-for-coding`（显示名 `K2.8 Preview`） |
| 登录方式 | `kimi acp --login`（设备码登录），`--region mainland-cn\|global` |

**验证记录**

| 项 | 值 |
|---|---|
| 验证时间 | 2026-10-26 |
| 验证版本 | 2.3.2 |
| 握手耗时 | 约 1.0 s |
| 已验证能力 | 握手、模型列表（6 个） |
| 未通过项 | 真实测试：`403 Your current subscription does not have access to Kimi Code right now`（订阅不含 Kimi Code，需升级套餐） |

**模型列表**（6）：`kimi-code/kimi-for-coding`（K2.8 Preview）、`kimi-code/kimi-for-coding-highspeed`（K2.7 Code Highspeed）、`kimi-code/k3`、`kimi-code/k3-256k`、`kimi-code/k3.1-pro`、`kimi-code/k3.1-pro-highspeed`

**结论**：适配层面可用（入口、模型列表、启动方式都已确认）；真实委派受账号订阅限制，升级套餐后即可用。

---

## MiniMax Code ✅ 已验证（账号额度受限）

**简介**：MiniMax 的终端编程 agent，提供 ACP 服务端。

- 官方入口：<https://agent.minimax.cn/docs/cli/integrations>（ACP 集成文档）
- 安装方式：**npm 全局安装** `npm i -g @minimax-ai/code`，命令 `mcode`
- PATH 上：`node ".../@minimax-ai/code/cli.js"` 型 shim → 必须 `cmd /c`

**适配参数**

| 项 | 值 |
|---|---|
| 启动命令 | `cmd` |
| 启动参数 | `/c mcode -m {model} acp`（留空则省略 `-m`） |
| 模型传法 | `-m/--model <provider/model>` 全局参数 |
| 模型列表 | 实测 4 个 |
| 当前模型 | `m:minimax:MiniMax-M3.1-Flash:v:thinking`（显示名 `M3.1-Flash · thinking`） |
| 登录方式 | `mcode login` |

**验证记录**

| 项 | 值 |
|---|---|
| 验证时间 | 2026-10-26 |
| 验证版本 | 0.6.12（npm） |
| 握手耗时 | 约 8.7 s |
| 已验证能力 | 握手、模型列表（4 个） |
| 未通过项 | 真实测试：`Internal error: MiniMax Code Runtime failed: insufficient balance (1008)`（余额不足） |

**模型列表**（4）：`m:minimax:MiniMax-M3.1-Flash:v:`（M3.1-Flash）、`m:minimax:MiniMax-M3.1-Flash:v:thinking`（M3.1-Flash · thinking）、`m:minimax:MiniMax-M3:v:`（M3）、`m:minimax:MiniMax-M3:v:thinking`（M3 · thinking）

**结论**：适配层面可用；真实委派受账号余额限制，充值后即可用。
