/**
 * Model-placeholder expansion shared by the plugin's mount path and the
 * `acp_targets` tool.
 *
 * A target keeps its model delivery method in its launch contract: `args` or
 * `env` values may carry a `{model}` placeholder, which is expanded with the
 * target's configured model. That keeps per-CLI model flags out of this
 * package — a new CLI only needs a different template, not new code.
 *
 * @module dsh-subagent-acp-ui/model-args
 */

/**
 * Expand `{model}` in one argument list.
 *
 * A standalone `{model}` element expands to the model, or disappears together
 * with the flag before it when no model is configured — so
 * `['--model', '{model}']` never leaves a dangling flag.
 *
 * @param args - configured launch arguments.
 * @param model - the fixed model, or an empty string.
 * @returns the effective launch arguments.
 */
export function expandModelArgs(args, model) {
  const result = []
  for (const arg of args ?? []) {
    if (arg === '{model}') {
      if (model === '') {
        if (result.length > 0 && String(result[result.length - 1]).startsWith('-')) result.pop()
        continue
      }
      result.push(model)
      continue
    }
    result.push(arg.includes('{model}') ? arg.replaceAll('{model}', model) : arg)
  }
  return result
}

/**
 * Expand `{model}` in environment values; a templated value is dropped when no
 * model is configured.
 *
 * @param env - configured environment overrides.
 * @param model - the fixed model, or an empty string.
 * @returns the effective environment overrides.
 */
export function expandModelEnv(env, model) {
  const result = {}
  for (const [key, value] of Object.entries(env ?? {})) {
    const text = String(value)
    if (!text.includes('{model}')) { result[key] = text; continue }
    if (model === '') continue
    result[key] = text.replaceAll('{model}', model)
  }
  return result
}
