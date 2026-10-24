/**
 * Model-facing `acp_targets` tool: manage the ACP targets from a conversation
 * instead of the Plugins page.
 *
 * Writes go through the Harness settings service — the same path the browser
 * form uses — so a save rebuilds the provider/tool registrations immediately.
 *
 * `test` has two levels: the default probe runs the ACP handshake and lists the
 * models (no model tokens), while `mode: "verify"` sends one short prompt (a few
 * model tokens) and is the only real end-to-end availability check.
 *
 * @module dsh-subagent-acp-ui/targets-tool
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import { expandModelArgs, expandModelEnv } from './model-args.js'
import { probeTarget, VERIFY_PROMPT } from './probe.js'

/** Normalize one target so the settings document stays canonical. */
export function normalizeTarget(raw) {
  const name = String(raw?.name ?? '').trim()
  return {
    name,
    command: String(raw?.command ?? '').trim(),
    args: Array.isArray(raw?.args) ? raw.args.map(String) : ['acp'],
    model: String(raw?.model ?? '').trim(),
    permission: ['allow', 'reject', 'auto'].includes(raw?.permission) ? raw.permission : 'auto',
    env: raw?.env !== null && typeof raw?.env === 'object' ? raw.env : {},
    enabled: raw?.enabled !== false,
  }
}

/** One line describing a target. */
function summarize(target) {
  const model = typeof target.model === 'string' && target.model !== '' ? `\t模型=${target.model}` : ''
  return `${target.name}\t${target.command} ${(target.args ?? []).join(' ')}\t权限=${target.permission}${model}\t${target.enabled === false ? '已禁用' : '启用'}`
}

/**
 * Build the management tool definition.
 * @param options - host context plus the live targets reader and writer.
 * @returns the tool definition to register on `ctx.tools`.
 */
export function createTargetsTool(options) {
  const { ctx, readTargets, writeTargets } = options

  return defineTool({
    name: 'acp_targets',
    description: '管理 ACP 子智能体目标（增删改查与连通性/可用性测试）。list 列出；add 添加；update 修改；remove 删除。test 默认做一次 ACP 握手并返回模型列表——连通性检查，不消耗模型 token；test 传 mode="verify" 会真实发送一次短提示——消耗少量 token，验证端到端是否真的可用。修改与配置界面同一条保存路径，保存后立即生效。',
    parameters: {
      action: {
        type: 'string',
        required: true,
        description: 'list / add / update / remove / test',
      },
      name: {
        type: 'string',
        description: '目标实例名；add/update/remove/test 必填',
      },
      mode: {
        type: 'string',
        description: '仅 test 使用：probe（默认，握手 + 拉取模型，不消耗 token）或 verify（真实调用一次模型，消耗少量 token）',
      },
      target: {
        type: 'object',
        description: 'add/update 的字段',
        additionalProperties: true,
        properties: {
          command: { type: 'string', description: '启动该 ACP agent 的可执行文件（PATH 名或绝对路径）' },
          model: { type: 'string', description: '全局固定模型；留空用该 CLI 的默认模型' },
          permission: { type: 'string', description: 'allow / reject / auto' },
          enabled: { type: 'boolean', description: '是否启用' },
        },
      },
    },
    output: {
      schema: { type: 'string' },
      description: '操作结果',
    },
    async execute(args) {
      const action = String(args.action ?? '').trim()
      const current = readTargets()
      const name = String(args.name ?? '').trim()

      if (action === 'list') {
        if (current.length === 0) return '当前没有配置任何 ACP 目标。用 add 添加一个，例如 { action: "add", name: "my-agent", target: { command: "agent-cli", args: ["acp"] } }。'
        return current.map(summarize).join('\n')
      }

      if (name === '') return '缺少 name。'

      if (action === 'add') {
        if (current.some(item => item.name === name)) return `目标已存在：${name}。用 update 修改。`
        const next = [...current, normalizeTarget({ ...args.target, name })]
        await writeTargets(next)
        return `已添加目标 ${name}。已注册 provider acp_${name.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase()} 与工具 subagent_acp_<名称>。`
      }

      if (action === 'update') {
        const index = current.findIndex(item => item.name === name)
        if (index < 0) return `目标不存在：${name}。`
        const next = current.map((item, i) => i === index ? normalizeTarget({ ...item, ...args.target, name }) : item)
        await writeTargets(next)
        return `已更新目标 ${name}。`
      }

      if (action === 'remove') {
        if (!current.some(item => item.name === name)) return `目标不存在：${name}。`
        await writeTargets(current.filter(item => item.name !== name))
        return `已删除目标 ${name}。`
      }

      if (action === 'test') {
        const target = current.find(item => item.name === name)
        if (target === undefined) return `目标不存在：${name}。`
        const verify = String(args.mode ?? 'probe').trim() === 'verify'
        const model = typeof target.model === 'string' ? target.model.trim() : ''
        const resolved = {
          ...target,
          args: expandModelArgs(target.args ?? ['acp'], model),
          env: expandModelEnv(target.env ?? {}, model),
          cwd: process.cwd(),
        }
        const result = verify
          ? await probeTarget(ctx, resolved, 120_000, VERIFY_PROMPT)
          : await probeTarget(ctx, resolved)
        if (result.ok === true) {
          return verify
            ? `真实测试通过（已消耗少量模型 token，${result.ms}ms）：${result.message}`
            : `连通性测试通过（握手，未消耗模型 token，${result.ms}ms）：${result.message}`
        }
        const where = result.stage === undefined ? '' : `，阶段 ${result.stage}`
        const stderr = typeof result.stderr === 'string' && result.stderr !== ''
          ? `\nCLI stderr（尾部）：\n${result.stderr}`
          : ''
        const label = verify ? '真实测试失败' : '连通性测试失败'
        return `${label}（${result.ms}ms${where}）：${result.message}${stderr}\n\n请基于以上事实分析原因（路径 / 登录 / 参数 / 版本），给出一个最小验证动作；需要用户配合时直接说明。`
      }

      return `未知操作：${action}。可用 list / add / update / remove / test。`
    },
  })
}
