/**
 * ACP health checks for one configured target.
 *
 * Two levels:
 * - `probe`: spawn the target, run `initialize` + `session/new`, dispose. Costs
 *   no model tokens; used for the availability dot and the model list.
 * - `verify`: the same handshake, then one short `session/prompt`, so the agent
 *   actually answers. This costs model tokens and is the only real "does it
 *   work end to end" check.
 *
 * Both report **facts only** — which step failed, the raw error, and the tail of
 * the child's stderr. Failures are not classified into advice: the main agent
 * analyses them in conversation, so a new CLI failure mode needs no plugin
 * update.
 *
 * This is a client-side health check, not a second ACP driver: real
 * delegations always go through the official `@deepseek-ai/dsh-subagent-acp`
 * provider.
 *
 * @module dsh-subagent-acp-ui/probe
 */
import { existsSync, readFileSync } from 'node:fs'
import { delimiter, dirname, join, resolve } from 'node:path'
import { Readable, Writable } from 'node:stream'
import {
  client as createAcpClientApp,
  methods,
  ndJsonStream,
  PROTOCOL_VERSION,
} from '@agentclientprotocol/sdk'

/** How many trailing stderr characters are kept for diagnosis. */
const STDERR_TAIL_LIMIT = 1_500

/** Prompt sent by the token-costing verify pass. */
export const VERIFY_PROMPT = '只回复两个字：收到'

/**
 * Resolve a bare command name to an executable that can actually be spawned.
 *
 * npm installs `.cmd` shims on Windows and those shims cannot be spawned
 * without a shell, so a bare `opencode` dies within a few hundred milliseconds.
 * A real `.exe` on PATH wins; otherwise the shim is read and the executable it
 * launches is returned.
 *
 * @param command - configured command, bare name or path.
 * @returns the resolved executable, or the input when nothing better is found.
 */
export function resolveExecutable(command) {
  const trimmed = String(command ?? '').trim()
  if (trimmed === '' || /[\\/:]/.test(trimmed)) return trimmed
  const dirs = String(process.env.PATH ?? '').split(delimiter).filter(dir => dir !== '')
  for (const ext of ['.exe', '.cmd', '.bat']) {
    for (const dir of dirs) {
      const candidate = join(dir, trimmed + ext)
      if (!existsSync(candidate)) continue
      if (ext === '.exe') return candidate
      return executableBehindShim(candidate) ?? candidate
    }
  }
  return trimmed
}

/**
 * Read an npm `.cmd` shim and return the executable it launches.
 *
 * @param shimPath - absolute path of the `.cmd` wrapper.
 * @returns the launched executable when it exists, otherwise undefined.
 */
function executableBehindShim(shimPath) {
  try {
    const text = readFileSync(shimPath, 'utf8')
    const match = text.match(/"([^"]+\.exe)"/i)
    if (match === null) return undefined
    const expanded = match[1].replace(/%dp0%/gi, dirname(shimPath))
    const absolute = resolve(expanded)
    return existsSync(absolute) ? absolute : undefined
  } catch {
    return undefined
  }
}

/**
 * Run a probe (handshake only) or a verify (handshake plus one prompt).
 *
 * @param ctx - host context carrying `subprocess`.
 * @param target - resolved target ({ command, args, env, cwd }).
 * @param timeoutMs - total budget in milliseconds.
 * @param prompt - when set, send this prompt after the handshake and collect
 *   the agent's answer; that round costs model tokens.
 * @returns success with elapsed time and either the model list or the answer,
 *   or failure facts (`message`, `stage`, `stderr` tail) plus elapsed time.
 */
export async function probeTarget(ctx, target, timeoutMs = 12_000, prompt = undefined) {
  const started = Date.now()
  const cwd = target.cwd ?? process.cwd()

  /** Trailing stderr text; most CLIs state the real reason there. */
  let stderr = ''

  /** Build one failure result from facts collected so far. */
  const failure = (error, stage) => ({
    ok: false,
    message: error instanceof Error ? error.message : String(error),
    stage,
    stderr: stderr.slice(-STDERR_TAIL_LIMIT),
    ms: Date.now() - started,
  })

  let child
  try {
    child = ctx.subprocess.spawn({
      argv: [resolveExecutable(target.command), ...(target.args ?? [])],
      cwd,
      env: target.env,
      stdio: { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' },
      graceMs: 5_000,
    })
  } catch (error) {
    return failure(error, 'process')
  }

  // Keep only the tail: a crashing CLI can be chatty.
  if (typeof child.stderr?.on === 'function') {
    child.stderr.on('data', chunk => {
      stderr = (stderr + chunk.toString('utf8')).slice(-STDERR_TAIL_LIMIT)
    })
  }

  /** Text the agent streamed back during a verify prompt. */
  const chunks = []

  const clientApp = createAcpClientApp({ name: 'dsh-subagent-acp-ui-probe' })
    .onNotification(methods.client.session.update, ({ params }) => {
      const update = params.update
      if (update.sessionUpdate === 'agent_message_chunk' && update.content?.type === 'text') {
        chunks.push(update.content.text)
      }
      return Promise.resolve()
    })
    .onRequest(methods.client.session.requestPermission, () => Promise.resolve({ outcome: { outcome: 'cancelled' } }))
  const connection = clientApp.connect(ndJsonStream(
    Writable.toWeb(child.stdin),
    Readable.toWeb(child.stdout),
  ))
  const agent = connection.agent

  let timer
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`等待超时（${timeoutMs}ms）`)), timeoutMs)
  })

  let phase = 'initialize'
  try {
    const outcome = await Promise.race([
      (async () => {
        await agent.request(methods.agent.initialize, {
          protocolVersion: PROTOCOL_VERSION,
          clientCapabilities: {},
        })
        phase = 'new-session'
        const session = await agent.request(methods.agent.session.new, {
          cwd,
          mcpServers: [],
        })
        phase = 'result'
        if (typeof session.sessionId !== 'string') throw new Error('会话未返回 session id')
        const modelOption = (session.configOptions ?? []).find(option => option.id === 'model')
        const models = (modelOption?.options ?? []).map(option => ({
          id: String(option.value ?? option.name ?? ''),
          name: String(option.name ?? option.value ?? ''),
        }))
        const currentValue = typeof modelOption?.currentValue === 'string' ? modelOption.currentValue : undefined

        if (prompt === undefined) return { models, currentValue }

        phase = 'prompt'
        const result = await agent.request(methods.agent.session.prompt, {
          sessionId: session.sessionId,
          prompt: [{ type: 'text', text: prompt }],
        })
        return { models, currentValue, stopReason: result.stopReason, text: chunks.join('') }
      })(),
      deadline,
    ])

    const elapsed = Date.now() - started
    if (prompt !== undefined) {
      const answer = String(outcome.text ?? '').trim()
      const preview = answer === '' ? '（没有返回文本）' : answer.slice(0, 200)
      return {
        ok: true,
        message: `测试通过（${elapsed}ms）：${preview}`,
        models: outcome.models,
        currentValue: outcome.currentValue,
        stopReason: outcome.stopReason,
        text: answer,
        ms: elapsed,
      }
    }
    return {
      ok: true,
      message: outcome.models.length === 0
        ? 'ACP 握手成功（该 agent 未公布模型列表）'
        : `ACP 握手成功，可用模型 ${outcome.models.length} 个：${outcome.models.slice(0, 5).map(model => model.name).join('、')}${outcome.models.length > 5 ? '…' : ''}`,
      models: outcome.models,
      currentValue: outcome.currentValue,
      ms: elapsed,
    }
  } catch (error) {
    return failure(error, phase)
  } finally {
    clearTimeout(timer)
    child.stdin?.end()
    setTimeout(() => {
      try { child.terminate() } catch { /* child already gone */ }
    }, 1_500)
  }
}
