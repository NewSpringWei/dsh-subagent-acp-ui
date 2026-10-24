# OpenCode 适配记录

## 应用简介

OpenCode 是开源的 AI 编程 agent，提供终端与桌面两种形态；ACP 入口是子命令 `opencode acp`。

- 官方入口：<https://opencode.ai/>
- 分发方式：npm 包 `@opencode/cli`（`npm i -g @opencode/cli`），也提供桌面版
- 技术栈：TypeScript / Node.js。npm 安装后 PATH 上的 `opencode` 是 `.cmd` 包装器，实际执行 `node_modules/@opencode/cli/bin/opencode.exe`

## 适配参数

| 项 | 值 |
|---|---|
| 启动命令 | `opencode`（PATH 名；npm 安装后可用） |
| 启动参数 | `acp` |
| 模型传法 | 环境变量 `OPENCODE_CONFIG_CONTENT={"model":"{model}"}` |
| 模型列表 | `session/new` 返回 `configOptions[id=model]`，实测 51 个 |
| 当前模型 | `currentValue` 形如 `opencode/glm-5.3-flash-free` |

## 验证记录

| 项 | 值 |
|---|---|
| 验证时间 | 2026-10-24 |
| 验证版本 | opencode v2.1.4（npm） |
| 握手耗时 | 约 1.5 s |
| 已验证能力 | 握手、模型列表、真实测试（verify）、`/acp-opencode` 命令注册 |

## 适配过程与坑

1. **`.cmd` 包装器不能直接 spawn**：npm 安装的 `opencode` 是 `opencode.cmd`，DSH 直接启动会得到 `ACP connection closed`（约 200 ms 后进程退出）。插件会自动解析 shim 内容，找到其真正调用的 `opencode.exe`，探测与委派都用解析后的路径。
2. **桌面版路径不稳定**：桌面版自带的 `opencode-cli.exe` 位于 `%LOCALAPPDATA%\Programs\@opencodedesktop\resources\`，不在 PATH，卸载桌面版后失效。改用 npm 安装后命令名稳定。
3. **`currentValue` 是 id**：配置页会把 id 映射成模型列表里的显示名，避免直接展示 `opencode/glm-5.3-flash-free` 这类内部标识。
