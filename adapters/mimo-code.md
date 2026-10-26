# MiMo Code 适配记录

## 应用简介

MiMo Code 是小米的 AI 编程 agent；ACP 入口是子命令 `mimo acp`。

- 官方入口：<https://mimo.xiaomi.com/zh/mimocode>
- 分发方式：官方安装包，默认安装到 `C:\Users\<用户>\.mimocode\bin\mimo.exe`

## 适配参数

| 项 | 值 |
|---|---|
| 启动命令 | `mimo`（PATH 名；安装后可用） |
| 启动参数 | `acp` |
| 模型传法 | 环境变量 `MIMOCODE_CONFIG_CONTENT={"model":"{model}"}` |
| 模型列表 | `session/new` 返回 `configOptions[id=model]`，实测 16 个 |
| 当前模型 | `currentValue` 形如 `mimo/mimo-auto` |

## 验证记录

| 项 | 值 |
|---|---|
| 验证时间 | 2026-10-24 |
| 安装方式 | **官方安装器（安装包安装，非 npm）** |
| 验证版本 | 未采集（安装包未提供可解析的版本号） |
| 握手耗时 | 约 4.4 s（三者中最慢） |
| 已验证能力 | 握手、模型列表、真实测试（verify）、`/acp-mimo` 命令注册 |

## 安装方式与启动解析

MiMo Code 通过 **官方安装器** 分发，安装后 PATH 上是真实 `mimo.exe`，DSH 可以直接 spawn，不需要 shim 解析。

- 与 OpenCode 形成对照：两者界面和启动参数高度相似（同为 opencode 形态），但 OpenCode 官方推荐 npm 安装、PATH 上是 `.cmd` shim，需要插件解析；MiMo 是安装包分发的真实 exe，省掉这一步。
- 启动命令沿用了裸命令名 `mimo`，依赖安装器写入 PATH；若某天安装器不再写 PATH，需要用「浏览…」选定 `mimo.exe` 的绝对路径。
- 若将来 MiMo 改走 npm 分发，同样要按 shim 形式调整启动命令（解析或 `cmd /c`）。

## 适配过程与坑

1. **启动慢**：冷启动到握手完成约 4.4 s，探测超时预算需要留足（默认 12 s 够用；真实测试用 120 s）。
2. **模型配置有两条路**：除了环境变量 `MIMOCODE_CONFIG_CONTENT`，还支持 `~/.config/mimocode/mimocode.jsonc` 里的 `model` 字段。适配选择环境变量注入，避免改写用户配置文件。
3. **`currentValue` 带 provider 前缀**：形如 `mimo/mimo-auto`，配置页会映射成列表里的显示名。
