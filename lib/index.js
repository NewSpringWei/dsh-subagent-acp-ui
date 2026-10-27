/**
 * `dsh-subagent-acp-ui` — the experience layer over the official
 * `@deepseek-ai/dsh-subagent-acp` provider.
 *
 * This plugin owns no ACP client code. For every configured target it mounts
 * one official ACP provider plugin (which registers a `ctx.subagents` provider)
 * and one official `dsh-tool-subagent` instance (which exposes a model-facing
 * delegation tool pointing at that provider). Configuring targets therefore
 * never requires hand-editing YAML, and the ACP wire behavior stays exactly
 * the official one.
 *
 * Registers, per target:
 * - a `ctx.subagents` provider named `acp_<target>`;
 * - a model-facing tool named `subagent_acp_<target>`.
 *
 * Additionally registers:
 * - the `acp_targets` management tool (list / add / update / remove / test);
 * - the `acp-subagent-routing` skill (progressive disclosure of when to use
 *   which target);
 * - a `/acp-ui-test` endpoint used by the Plugins-page test button.
 *
 * @module dsh-subagent-acp-ui
 */
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import z from '@deepseek-ai/schemastery'
import { isVolatile } from '@deepseek-ai/cosmokit'
import * as AcpPlugin from '@deepseek-ai/dsh-subagent-acp'
import * as ToolPlugin from '@deepseek-ai/dsh-tool-subagent'
import { createTargetsTool } from './targets-tool.js'
import { expandModelArgs, expandModelEnv } from './model-args.js'
import { probeTarget, resolveExecutable, VERIFY_PROMPT } from './probe.js'

export const name = 'subagent-acp-ui'
export const inject = ['subagents', 'subprocess', 'tools']

/** Skill id published into the skill registry. */
const SKILL_NAME = 'acp-subagent-routing'
const SKILL_DESCRIPTION = '把自包含任务委派给已配置的 ACP 子智能体。子智能体在自己的进程、模型和工具里执行，只返回最终答案。English: delegate self-contained tasks to a configured ACP subagent; the child runs in its own process, model, and tools and returns only its final answer.'
const SKILL_WHEN_TO_USE = '任务自包含、可验收、且交给另一个 agent 更合适时（换模型、换工具链、换额度来源、需要进程隔离）；必须在当前会话内联完成或需要继续多轮的活不要交给 ACP 子智能体。English: self-contained, reviewable tasks that are better served by another agent; keep work that must stay inline or needs multi-turn continuation in this session.'
/** Routing skill body, kept as markdown beside the code so it is edited as prose. */
const SKILL_CONTENT = readFileSync(new URL('../skills/acp-subagent-routing/SKILL.md', import.meta.url), 'utf8')

/** One ACP target: where to find the CLI and how to answer its permission prompts. */
const TargetConfig = z.object({
  name: z.string().required().description('实例名称：决定 provider 名与工具名'),
  command: z.string().required().description('启动该 ACP agent 的可执行文件（PATH 名或绝对路径）'),
  args: z.array(z.string()).default(['acp']).description('启动参数；默认 ["acp"] 启动 ACP 服务端。可写 {model} 占位符'),
  model: z.string().description('全局固定模型。留空则用该 CLI 的默认模型'),
  modelLabel: z.string().description('模型显示名：配置页在选定模型时记录，用于列表里显示「名称（id）」'),
  permission: z.union(['allow', 'reject']).default('reject')
    .description('自动应答子 agent 的权限请求：allow 允许、reject 拒绝（官方默认）'),
  env: z.dict(z.string()).default({}).description('额外环境变量（叠加在清洗后的父进程环境之上）。值里可写 {model} 占位符'),
  enabled: z.boolean().default(true).description('是否启用该目标'),
})

/** Config: the ACP targets this deployment exposes. */
export const Config = z.object({
  // Volatile so the Settings/Plugins form projects it for live editing.
  targets: z.array(TargetConfig).default([]).volatile(),
  showSettingsRow: z.boolean().default(true)
    .description('在「设置」左侧导航显示 ACP 子智能体入口（默认开）'),
  showPluginsTab: z.boolean().default(false)
    .description('在「设置 → 内置插件」里显示 ACP 子智能体标签（默认关）'),
  adaptersUrl: z.string()
    .default('https://cdn.jsdelivr.net/gh/NewSpringWei/dsh-subagent-acp-ui@main/adapters/agents.json')
    .description('在线适配清单地址（默认 jsDelivr 镜像，raw.githubusercontent 在部分网络不可达）；按 id 合并到内置预设，只更新适配项，不改插件版本'),
})

/** Where a refreshed preset list is cached; survives plugin upgrades. */
function adaptersCachePath() {
  return join(homedir(), '.dsh', 'subagent-acp-ui', 'adapters-cache.json')
}

/** Read the preset list shipped inside this package. */
function builtinPresets() {
  try {
    const parsed = JSON.parse(readFileSync(new URL('../adapters/agents.json', import.meta.url), 'utf8'))
    return Array.isArray(parsed?.agents) ? parsed : { version: 1, agents: [] }
  } catch {
    return { version: 1, agents: [] }
  }
}

/** Read the cached online preset list, when a refresh succeeded before. */
function cachedPresets() {
  try {
    const parsed = JSON.parse(readFileSync(adaptersCachePath(), 'utf8'))
    return Array.isArray(parsed?.agents) ? parsed : undefined
  } catch {
    return undefined
  }
}

/** Merge online agents over the built-in ones by id. */
function mergePresets(base, extra) {
  const byId = new Map(base.agents.map(agent => [agent.id, agent]))
  for (const agent of extra.agents) {
    if (agent !== null && typeof agent === 'object' && typeof agent.id === 'string') byId.set(agent.id, agent)
  }
  return { version: base.version ?? 1, agents: [...byId.values()] }
}

/** Effective presets: the built-in list plus the latest cached online update. */
function readPresets() {
  const base = builtinPresets()
  const cached = cachedPresets()
  return cached === undefined ? base : mergePresets(base, cached)
}

/**
 * Fetch the online preset list and cache it.
 * @param url - installed-manifest URL of `adapters/agents.json`.
 * @returns the refresh outcome; failures keep the previous cache.
 */
async function refreshPresets(url) {
  if (typeof url !== 'string' || url === '') return { ok: false, message: '未配置适配清单地址' }
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) })
    if (!response.ok) return { ok: false, message: `HTTP ${response.status}` }
    const parsed = await response.json()
    if (!Array.isArray(parsed?.agents)) return { ok: false, message: '清单里没有 agents 数组' }
    const path = adaptersCachePath()
    mkdirSync(dirname(path), { recursive: true })
    const updatedAt = new Date().toISOString()
    writeFileSync(path, JSON.stringify({ version: parsed.version ?? 1, agents: parsed.agents, updatedAt }, null, 2), 'utf8')
    return { ok: true, count: parsed.agents.length, updatedAt }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Turn a display name into a loader-safe instance suffix.
 * @param value - configured target name.
 * @returns lower-case `[a-z0-9_]` identifier.
 */
function sanitize(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+/, '')
    .replace(/_+$/, '')
}

/**
 * Unwrap a volatile target list (the Plugins form mutates it in place).
 * @param raw - the configured or observed target value.
 * @returns the plain target array.
 */
function unwrapTargets(raw) {
  const value = isVolatile(raw) ? raw.get() : raw
  return Array.isArray(value) ? value : []
}

/**
 * Mount the official provider and tool plugins for one target.
 * @param ctx - host context carrying `subagents` and `tools`.
 * @param target - one resolved target.
 * @returns the mounted fibers.
 */
function mountTarget(ctx, target) {
  const instance = sanitize(target.name)
  const providerName = `acp_${instance}`
  const toolName = `subagent_acp_${instance}`
  const model = typeof target.model === 'string' ? target.model.trim() : ''
  const fibers = []

  fibers.push(ctx.plugin(AcpPlugin, {
    providerName,
    command: resolveExecutable(target.command),
    args: expandModelArgs(target.args, model),
    permission: target.permission,
    env: expandModelEnv(target.env, model),
  }))

  fibers.push(ctx.plugin(ToolPlugin, {
    provider: providerName,
    toolName,
    // The official ACP provider advertises no depthLimit capability, so a
    // numeric limit would be rejected at mount time.
    maxDepth: 'provider-managed',
  }))

  return fibers
}

/** Windows file-picker script; prints the chosen path, or nothing on cancel. */
const BROWSE_SCRIPT = [
  'Add-Type -AssemblyName System.Windows.Forms',
  '$d = New-Object System.Windows.Forms.OpenFileDialog',
  "$d.Filter = '可执行文件 (*.exe)|*.exe|所有文件 (*.*)|*.*'",
  "$d.Title = '选择 ACP agent 可执行文件'",
  'if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($d.FileName) }',
].join('; ')

/**
 * Open the host's native file picker and return the selected path.
 *
 * The browser cannot read a local file path, so "browse for the executable"
 * has to run on the host; the path comes back over the web endpoint.
 *
 * @returns the chosen path, or a failure carrying the reason.
 */
function browseForExecutable() {
  return new Promise(resolve => {
    let child
    try {
      child = spawn('powershell.exe', ['-NoProfile', '-STA', '-Command', BROWSE_SCRIPT], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
    } catch (error) {
      resolve({ ok: false, message: error instanceof Error ? error.message : String(error) })
      return
    }
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk.toString('utf8') })
    child.stderr.on('data', chunk => { stderr += chunk.toString('utf8') })
    const timer = setTimeout(() => {
      try { child.kill() } catch { /* already gone */ }
      resolve({ ok: false, message: '选择文件超时' })
    }, 120_000)
    child.once('error', error => {
      clearTimeout(timer)
      resolve({ ok: false, message: error instanceof Error ? error.message : String(error) })
    })
    child.once('close', () => {
      clearTimeout(timer)
      const path = stdout.trim()
      if (path !== '') {
        resolve({ ok: true, path })
        return
      }
      const error = stderr.trim()
      // Closing the dialog without picking a file is not a failure.
      if (error === '') {
        resolve({ ok: false, cancelled: true })
        return
      }
      resolve({ ok: false, message: error.slice(0, 500) })
    })
  })
}

/** Read and parse a JSON request body; an empty or invalid body yields `{}`. */
async function readJsonBody(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return {}
  }
}

/** Write one JSON response. */
function writeJson(response, value) {
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify(value))
}

/**
 * Apply the plugin.
 * @param ctx - host context.
 * @param config - resolved plugin configuration.
 */
export function apply(ctx, config) {
  let fibers = []
  let signature = ''
  let commandDisposers = []

  // Adapter presets refresh online; only code changes need a new plugin release.
  void refreshPresets(config.adaptersUrl).then(result => {
    if (result.ok !== true) {
      ctx.logger?.warn?.(`subagent-acp-ui: 适配清单在线更新失败：${result.message}`)
      return
    }
    ctx.logger?.info?.(`subagent-acp-ui: 适配清单已更新（${result.count} 项，${result.updatedAt}）`)
  })

  /** Drop every wake-up command; registration is redone on the next rebuild. */
  const disposeCommands = () => {
    for (const dispose of commandDisposers.reverse()) {
      try { dispose() } catch { /* the command service is already gone */ }
    }
    commandDisposers = []
  }

  const disposeAll = () => {
    disposeCommands()
    const previous = fibers
    fibers = []
    for (const fiber of previous.reverse()) {
      try {
        void fiber.dispose()
      } catch (error) {
        ctx.logger?.warn?.(`subagent-acp-ui: dispose failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  /** Read the live target list; the form updates the volatile array in place. */
  const readTargets = () => unwrapTargets(config.targets)

  /**
   * Register one exact wake-up command per enabled target: `/acp-<name> <task>`.
   *
   * The command delegates through the same official provider a tool call uses,
   * so it adds no second ACP path; it only skips the "ask the model to call the
   * tool" round.
   *
   * @param targets - the current target list.
   */
  const syncCommands = (targets) => {
    disposeCommands()
    const commands = ctx.get('commands')
    if (commands === undefined) return
    for (const target of targets) {
      if (target.enabled === false) continue
      const instance = sanitize(target.name)
      if (instance === '') continue
      const providerName = `acp_${instance}`
      try {
        const unregister = commands.register({
          name: `acp-${instance}`,
          description: `用「${target.name}」目标执行一次 ACP 子智能体委派`,
          input: { hint: '<任务>' },
          handler: async invocation => {
            const task = String(invocation.rawInput ?? '').trim()
            if (task === '') {
              return { kind: 'error', text: `请在命令后附加任务文本，例如：/acp-${instance} 查看当前目录` }
            }
            try {
              const started = await ctx.subagents.startActivation({
                provider: providerName,
                label: task.slice(0, 60),
                request: {
                  prompt: [{ type: 'text', text: task }],
                  parent: invocation.agent,
                },
                signal: invocation.signal,
                delivery: 'parent',
              })
              return { kind: 'success', text: `已委派给「${target.name}」（子代理 ${started.childId}），完成后结果会回到本会话。` }
            } catch (error) {
              return { kind: 'error', text: `委派失败：${error instanceof Error ? error.message : String(error)}` }
            }
          },
        })
        if (typeof unregister === 'function') commandDisposers.push(unregister)
      } catch (error) {
        ctx.logger?.warn?.(`subagent-acp-ui: /acp-${instance} registration failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  /**
   * Replace every registration with the current target list.
   * @param targets - the targets to mount.
   */
  const rebuild = (targets) => {
    const next = JSON.stringify(targets)
    if (next === signature) return
    signature = next
    disposeAll()
    for (const target of targets) {
      if (target.enabled === false) continue
      try {
        fibers.push(...mountTarget(ctx, target))
      } catch (error) {
        ctx.logger?.warn?.(`subagent-acp-ui "${target.name}": mount failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    if (fibers.length === 0) {
      ctx.logger?.warn?.('subagent-acp-ui: no targets configured; add one in Plugins → ACP subagents')
    } else {
      const active = targets.filter(target => target.enabled !== false).map(target => target.name)
      ctx.logger?.warn?.(`subagent-acp-ui: active targets: ${active.join(', ')}`)
    }
    syncCommands(targets)
  }

  /** Persist a new target list through the settings service (shared with the form). */
  const writeTargets = async (next) => {
    const settings = ctx.get('settings')
    if (settings === undefined) throw new Error('dsh-subagent-acp-ui: settings service unavailable')
    let lastError
    for (const namespace of ['subagent-acp-ui', 'include:subagent-acp-ui']) {
      try {
        await settings.update(namespace, { targets: next })
        return
      } catch (error) {
        lastError = error
      }
    }
    throw lastError
  }

  rebuild(readTargets())

  ctx.effect(() => () => { disposeAll() })

  // The command service may activate after this plugin; register once it does.
  ctx.inject(['commands'], () => {
    syncCommands(readTargets())
  })

  // A settings save (from the Plugins form or the `acp_targets` tool) updates
  // the volatile document; rebuild after the publish settles.
  ctx.on('settings/document-updated', () => {
    setTimeout(() => {
      try {
        rebuild(readTargets())
      } catch (error) {
        ctx.logger?.warn?.(`subagent-acp-ui: rebuild failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }, 500)
  })

  // Model-facing management, on the same save path as the form.
  const unregisterTargets = ctx.tools.register(createTargetsTool({ ctx, readTargets, writeTargets }))
  ctx.effect(() => () => { if (typeof unregisterTargets === 'function') unregisterTargets() })

  // Progressive disclosure: only name/description/whenToUse enter the catalog.
  ctx.inject(['skills'], injected => {
    injected.effect(() => injected.skills.register({
      name: SKILL_NAME,
      description: SKILL_DESCRIPTION,
      whenToUse: SKILL_WHEN_TO_USE,
      content: SKILL_CONTENT,
    }))
  })

  // Health-check endpoints for the Plugins-page form.
  // - `/acp-ui-test`: handshake only (costs no model tokens). With
  //   `mode: "verify"` it also sends one short prompt, which does cost tokens
  //   and is the only real end-to-end check.
  // - `/acp-ui-browse`: host-side native file picker; the browser cannot read
  //   a local executable path.
  ctx.inject(['webServer'], injected => {
    // Verified-agent presets come from the built-in file plus a cached online
    // list, so adding an agent is a data update — no plugin release needed.
    injected.effect(() => injected.webServer.register({
      kind: 'exact',
      path: '/acp-ui-presets',
      handler: (request, response) => {
        if (request.method !== 'GET') {
          response.writeHead(405)
          response.end()
          return
        }
        writeJson(response, readPresets())
      },
    }))

    // Manual refresh: re-fetch the online list and report the outcome.
    injected.effect(() => injected.webServer.register({
      kind: 'exact',
      path: '/acp-ui-refresh',
      handler: async (request, response) => {
        if (request.method !== 'POST') {
          response.writeHead(405)
          response.end()
          return
        }
        const result = await refreshPresets(config.adaptersUrl)
        writeJson(response, result)
      },
    }))

    injected.effect(() => injected.webServer.register({
      kind: 'exact',
      path: '/acp-ui-test',
      handler: async (request, response) => {
        if (request.method !== 'POST') {
          response.writeHead(405)
          response.end()
          return
        }
        const body = await readJsonBody(request)
        const wanted = String(body.name ?? '')
        // The editor tests an unsaved draft by sending it as `target`; the
        // availability dot probes the saved configuration by name.
        const raw = body.target !== undefined && body.target !== null && typeof body.target === 'object'
          ? { ...body.target, name: String(body.target.name ?? wanted) }
          : readTargets().find(item => item.name === wanted)
        if (raw === undefined) {
          writeJson(response, { ok: false, message: `未找到目标：${wanted === '' ? '(空)' : wanted}` })
          return
        }
        const model = typeof raw.model === 'string' ? raw.model.trim() : ''
        const resolved = {
          ...raw,
          args: expandModelArgs(Array.isArray(raw.args) ? raw.args : ['acp'], model),
          env: expandModelEnv(raw.env ?? {}, model),
          cwd: process.cwd(),
        }
        const result = body.mode === 'verify'
          ? await probeTarget(ctx, resolved, 120_000, VERIFY_PROMPT)
          : await probeTarget(ctx, resolved)
        writeJson(response, result)
      },
    }))

    injected.effect(() => injected.webServer.register({
      kind: 'exact',
      path: '/acp-ui-browse',
      handler: async (request, response) => {
        if (request.method !== 'POST') {
          response.writeHead(405)
          response.end()
          return
        }
        writeJson(response, await browseForExecutable())
      },
    }))
  })
}
