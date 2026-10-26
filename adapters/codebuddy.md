# CodeBuddy Code 适配记录

## 应用简介

CodeBuddy Code 是腾讯云代码助手 CodeBuddy 的命令行智能体，原生支持 ACP 协议，可作为智能体服务端被支持 ACP 的客户端调用。

- 官方入口：<https://www.codebuddy.cn/cli/>
- ACP 文档：<https://www.codebuddy.cn/docs/cli/acp>（镜像：<https://cloud.tencent.cn/document/product/1831/137021>）
- 分发方式：npm 包 `@tencent-ai/codebuddy-code`（全局安装后得到 `codebuddy` / `codebuddy-code` / `cbc` 命令）

## 适配参数

| 项 | 值 |
|---|---|
| 启动命令 | `cmd`（Windows，经 `cmd /c` 启动） |
| 启动参数 | `/c codebuddy --acp --model {model}` |
| 模型传法 | 命令行参数 `--model <id>`；留空则用 CLI 默认模型 |
| 模型列表 | `session/new` 返回 `configOptions[id=model]`，实测 19 个 |
| ACP 传输 | `--acp` 默认 stdio（ndJsonStream） |

`--model` 支持的模型 ID（v2.176.0 实测）：`hy4-preview`、`hy3`、`hy3-x`、`step-5-preview`、`space-bunny`、`deepseek-v4.1-flash`、`glm-5.3`、`glm-5.3-flash`、`glm-5.2`、`glm-5.1`、`glm-5v-turbo`、`minimax-m3.1-flash`、`minimax-m3`、`minimax-m2.7`、`kimi-k3.1-pro`、`kimi-k3-1`、`kimi-k2.8-preview`、`deepseek-v4-pro`、`mimo-v2.6-pro`。

## 验证记录

| 项 | 值 |
|---|---|
| 验证时间 | 2026-10-26 |
| 验证版本 | 2.176.0（npm） |
| 握手耗时 | 约 3.8 s |
| 已验证能力 | 握手、模型列表（19 个）、`--model` 参数 |

## 适配过程与坑

1. **npm shim 不是 `.exe`**：`codebuddy.cmd` 的内容是 `node "<pkg>/bin/codebuddy"`，不是 opencode 那种 `*.exe` 包装器。DSH 直接 spawn `.cmd` 会得到 `ACP connection closed`，我们的命令解析器也解析不出可执行文件。解决方式是启动命令用 `cmd`、参数以 `/c codebuddy ...` 开头，让系统 shell 自己去解析 PATH 上的 shim。
2. **`--acp` 走 stdio**：另有 `--acp-transport streamable-http` 用于 HTTP 场景，这里不需要。
3. **模型 ID 与显示名不同**：如 `hy4-preview` 的显示名是 `Hy4 preview`，配置页会把 id 映射成显示名。
4. **`--permission-mode` 与 ACP 权限应答是两回事**：前者是 CLI 内部的权限策略（`acceptEdits` / `bypassPermissions` / `plan` 等），后者是 ACP 的 `session/request_permission` 应答；本插件用 `permission` 字段控制后者，没有传 `--permission-mode`。
5. **`--serve` 时 ACP 才走 HTTP**：文档明确 “Without `--acp`, ACP does not use stdio”，即单独 `--serve` 不会开启 stdio ACP。
