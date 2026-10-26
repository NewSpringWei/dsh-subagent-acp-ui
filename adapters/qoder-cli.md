# Qoder CLI 适配记录

## 应用简介

Qoder CLI 是 Qoder 的终端编程 agent；ACP 入口是开关 `--acp`。

- 官方入口：<https://qoder.cn/cli>
- 分发方式：官方安装包，默认安装到 `C:\Users\<用户>\.qoder-cn\bin\qoderclicn\qoderclicn.exe`

## 适配参数

| 项 | 值 |
|---|---|
| 启动命令 | `qoderclicn`（PATH 名；安装后可用） |
| 启动参数 | `--acp --model {model}` |
| 模型传法 | 命令行参数 `--model <id>` |
| 模型列表 | `session/new` 返回 `configOptions[id=model]`，实测 12 个 |
| 当前模型 | `currentValue` 形如 `qmodel_38max`，显示名为 `Qwen3.8-Max` |

## 验证记录

| 项 | 值 |
|---|---|
| 验证时间 | 2026-10-24 |
| 安装方式 | **官方安装器（安装包安装，非 npm）** |
| 验证版本 | 未采集（安装包未提供可解析的版本号） |
| 握手耗时 | 约 1.5 s |
| 已验证能力 | 握手、模型列表、真实测试（verify）、`/acp-qoder` 命令注册 |

## 适配过程与坑

1. **ACP 入口是开关而不是子命令**：必须写 `--acp`（不是 `acp`），写错会被 CLI 当成未知参数直接退出。
2. **模型只能通过参数传**：`--model <id>`，没有等价的环境变量配置项；未配置模型时不会带默认值，探测到的 `currentValue` 是 CLI 自己的默认模型。
3. **`currentValue` 是内部 id**：`qmodel_38max` 与显示名 `Qwen3.8-Max` 不同，配置页需要做映射。
