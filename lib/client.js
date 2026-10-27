/**
 * Browser half of dsh-subagent-acp-ui: the Plugins-page configuration page.
 *
 * Loaded through the Web client module loader (`window.__ModuleLoader__.load`)
 * and registered into the Plugins page's `plugins.bundle.config` slot. Text
 * comes from the client `locale` service, so the page follows the UI language.
 *
 * Shape of the page:
 * - the list is read-only; each row shows the live availability dot (one
 *   handshake per target when the page opens, which costs no model tokens) and
 *   two buttons: edit and remove;
 * - adding or editing opens a modal with one field per row, a preset picker for
 *   the verified agents, and the test / save / cancel actions;
 * - nothing persists until save, and the modal's test runs against the draft.
 */
window.__ModuleLoader__.load({
  id: 'dsh-subagent-acp-ui',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    const React = require('react')
    const { Button, Input, Modal, StateDot, Tooltip } = require('@deepseek-ai/dsh-client-ui-primitives')
    const h = React.createElement

    /** The bundle package name: the key `plugins.bundle.config` is addressed by. */
    const PACKAGE = 'dsh-subagent-acp-ui'
    /** Settings namespaces to try: the expanded entry id first, then the raw row id. */
    const NAMESPACES = ['include:subagent-acp-ui', 'subagent-acp-ui']
    /** Locale namespace for this plugin's copy. */
    const NS = 'dsh-subagent-acp-ui'

    /**
     * Verified agents ship as data in `adapters/agents.json` and are fetched
     * from `/acp-ui-presets`, so adding one is a data edit rather than a code
     * change. Each entry carries the whole launch contract — command, arguments,
     * and model delivery — because getting only the command right leaves the
     * model setting silently ineffective.
     */
    const CUSTOM_PRESET = { id: 'custom', label: '', name: '', command: '', args: ['acp'], env: {} }

    /** Normalize the fetched preset document into a preset list. */
    function presetsOf(document) {
      const agents = Array.isArray(document?.agents) ? document.agents : []
      return [...agents, CUSTOM_PRESET]
    }

    /** Simplified Chinese and English copy (Chinese first, English second). */
    const LOCALE = {
      zh: {
        summary: '配置多个 ACP 子智能体目标',
        title: 'ACP 子智能体',
        settingsTab: 'ACP 子智能体',
        intro: '每个目标基于官方 ACP provider 注册一个子代理、一个 subagent_acp_<名称> 工具。子智能体在自己的进程与模型里执行，只返回最终答案。',
        add: '+ 添加',
        edit: '修改',
        remove: '删除',
        save: '保存', saving: '保存中…', cancel: '取消',
        saved: '已保存。',
        saveRejected: '保存被拒绝：配置可能已被其他页面修改，请重试。',
        saveFailed: '保存失败：',
        editorAddTitle: '添加 ACP 子智能体',
        editorEditTitle: '修改 ACP 子智能体',
        agentKindLabel: 'ACP 服务目标',
        agentKindHint: '选择已验证的 agent 会自动填好启动命令与模型传法，之后仍可修改。',
        agentKindLocked: '修改时不能更换服务目标。',
        agentKindCustom: '其他',
        installMethod: '安装方式',
        adaptSummary: '适配概要',
        browse: '浏览…', browsing: '选择中…', browseFailed: '选择文件失败：',
        nameLabel: '实例名称', commandLabel: '启动命令', argsLabel: '启动参数',
        modelLabel: '模型', permissionLabel: '权限请求应答', enabledLabel: '启用',
        fetchModels: '获取模型', fetchingModels: '获取中…',
        modelPlaceholder: '留空使用该 CLI 默认模型',
        modelFetchFailed: '获取模型失败：',
        modelCurrent: '当前生效：',
        modelDefault: 'CLI 默认',
        detailName: '实例名称用于 provider 名与委派工具 subagent_acp_<名称>；必须唯一。',
        detailCommand: '启动该 ACP agent 的命令。可用「浏览…」选择可执行文件。',
        detailArgs: '启动参数，空格分隔。可写 {model} 占位符。',
        detailModel: '全局固定模型：保存后每次委派都用它。打开弹窗时会自动握手一次列出可用模型。',
        detailPermission: '自动应答子 agent 的 session/request_permission：allow 自动允许，reject 拒绝（官方默认）。该请求由目标策略当场应答，不会上浮到主会话。',
        detailEnabled: '关闭后该目标不注册 provider 与工具，但配置保留。',
        phName: 'my-agent', phCommand: 'agent-cli', phArgs: 'acp',
        test: '测试', testing: '测试中…',
        testHint: '测试会真实调用一次模型（消耗少量 tokens）',
        testPassedTitle: '测试通过', testFailedTitle: '测试失败',
        testEmptyName: '请先填写实例名称再测试',
        testRequestFailed: '测试请求失败：',
        testDiag: '诊断',
        testStderr: 'CLI stderr（尾部）',
        testAskAgent: '把这段错误发到对话里，让主智能体基于原始错误与 stderr 分析原因。',
        noticeTitle: '提示',
        invalidEmpty: '请填写实例名称',
        invalidDup: '实例名称重复：{name}',
        invalidCommand: '请填写启动命令',
        empty: '还没有配置任何目标。点击「添加」开始。',
        loading: '正在读取配置…',
        unavailable: '配置不可用：命名空间未暴露。',
        missingService: '配置不可用：当前部署未暴露此插件的配置命名空间。',
        unnamed: '未命名目标', badgeOn: '已启用', badgeOff: '已禁用',
        toggleEnable: '点击启用', toggleDisable: '点击禁用',
        optionOn: '启用', optionOff: '禁用',
        reachYes: '连接可达', reachNo: '连接不可用', reachChecking: '正在连接', reachUnknown: '正在连接', reachDisabled: '—',
        introLimit: '这是官方 ACP provider 的体验层：不支持调用时选模型、不支持续跑多轮、每次委派都会重新启动进程。',
        compatTitle: '兼容性', compatDsh: '当前 DSH 版本', compatPlugin: '插件验证版本',
        compatAcp: 'ACP 底座', compatAcpValue: '@deepseek-ai/dsh-subagent-acp（官方 provider）',
        compatLinks: '已验证 agent 的官方入口',
      },
      en: {
        summary: 'Configure multiple ACP subagent targets',
        title: 'ACP subagents',
        settingsTab: 'ACP subagents',
        intro: 'Each target registers one subagent and one subagent_acp_<name> tool on top of the official ACP provider. The child runs in its own process and model and returns only its final answer.',
        add: '+ Add',
        edit: 'Edit',
        remove: 'Remove',
        save: 'Save', saving: 'Saving…', cancel: 'Cancel',
        saved: 'Saved.',
        saveRejected: 'Save rejected: the configuration may have been changed from another page. Try again.',
        saveFailed: 'Save failed: ',
        editorAddTitle: 'Add ACP subagent',
        editorEditTitle: 'Edit ACP subagent',
        agentKindLabel: 'ACP target',
        agentKindHint: 'A verified agent preset fills in the launch command and model delivery; you can still edit them.',
        agentKindLocked: 'The target type cannot be changed while editing.',
        agentKindCustom: 'Custom',
        installMethod: 'Install method',
        adaptSummary: 'Adapter summary',
        browse: 'Browse…', browsing: 'Choosing…', browseFailed: 'File picker failed: ',
        nameLabel: 'Instance name', commandLabel: 'Launch command', argsLabel: 'Launch arguments',
        modelLabel: 'Model', permissionLabel: 'Permission requests', enabledLabel: 'Enabled',
        fetchModels: 'Fetch models', fetchingModels: 'Fetching…',
        modelPlaceholder: 'Leave empty to use the CLI default',
        modelFetchFailed: 'Fetching models failed: ',
        modelCurrent: 'In effect: ',
        modelDefault: 'CLI default',
        detailName: 'Used for the provider name and the subagent_acp_<name> tool; must be unique.',
        detailCommand: 'The command that starts this ACP agent. Use Browse… to pick the executable.',
        detailArgs: 'Launch arguments, space separated. A {model} placeholder is expanded.',
        detailModel: 'Global fixed model: every delegation uses it after save. Opening the dialog runs one handshake to list models.',
        detailPermission: 'Auto-answer the child session/request_permission: allow permits, reject refuses (the official default). The request is answered in place and never bubbles up to the main session.',
        detailEnabled: 'When off, the target registers no provider or tool but keeps its configuration.',
        phName: 'my-agent', phCommand: 'agent-cli', phArgs: 'acp',
        test: 'Test', testing: 'Testing…',
        testHint: 'Test sends one real prompt (a few tokens)',
        testPassedTitle: 'Test passed', testFailedTitle: 'Test failed',
        testEmptyName: 'Fill in the instance name before testing',
        testRequestFailed: 'Test request failed: ',
        testDiag: 'Diagnostic',
        testStderr: 'CLI stderr (tail)',
        testAskAgent: 'Send this error to the conversation so the main agent can analyse the raw error and stderr.',
        noticeTitle: 'Notice',
        invalidEmpty: 'Fill in the instance name',
        invalidDup: 'Duplicate instance name: {name}',
        invalidCommand: 'Fill in the launch command',
        empty: 'No targets configured yet. Click "Add" to start.',
        loading: 'Reading configuration…',
        unavailable: 'Configuration unavailable: namespace not exposed.',
        missingService: 'Configuration unavailable: this deployment does not expose the plugin configuration namespace.',
        unnamed: 'Unnamed target', badgeOn: 'Enabled', badgeOff: 'Disabled',
        toggleEnable: 'Click to enable', toggleDisable: 'Click to disable',
        optionOn: 'Enable', optionOff: 'Disable',
        reachYes: 'reachable', reachNo: 'unreachable', reachChecking: 'connecting', reachUnknown: 'connecting', reachDisabled: '—',
        introLimit: 'This is an experience layer over the official ACP provider: no per-call model selection, no multi-turn continuation, and every delegation starts a fresh process.',
        compatTitle: 'Compatibility', compatDsh: 'Current DSH version', compatPlugin: 'Plugin verified against',
        compatAcp: 'ACP backend', compatAcpValue: '@deepseek-ai/dsh-subagent-acp (official provider)',
        compatLinks: 'Official entry points of the verified agents',
      },
    }

    const MUTED = 'var(--dsw-alias-text-tertiary, rgba(128,128,128,0.8))'
    const BORDER = '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.25))'
    const DANGER = 'var(--dsw-alias-state-danger, #c2413b)'
    const style = {
      root: { display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 },
      header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
      title: { fontWeight: 600, fontSize: 14 },
      intro: { fontSize: 12, color: MUTED, marginTop: 4, lineHeight: 1.5, maxWidth: 620 },
      limit: { fontSize: 12, color: MUTED, lineHeight: 1.5, maxWidth: 620 },
      card: {
        border: BORDER, borderRadius: 10, padding: 14,
        background: 'var(--dsw-alias-bg-l1, transparent)',
      },
      cardHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
      cardTitle: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
      name: { fontWeight: 600, fontSize: 13 },
      typeBadge: {
        fontSize: 11, padding: '1px 7px', borderRadius: 999, border: BORDER,
        color: MUTED, whiteSpace: 'nowrap',
      },
      toggleBadge: {
        fontSize: 11, padding: '1px 7px', borderRadius: 999, border: BORDER,
        whiteSpace: 'nowrap', font: 'inherit', cursor: 'pointer',
        background: 'transparent', lineHeight: 1.6,
      },
      summary: {
        display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10,
        marginTop: 12, fontSize: 12,
      },
      summaryItem: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
      summaryLabel: { color: MUTED, fontSize: 11 },
      summaryValue: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      editor: { display: 'flex', flexDirection: 'column', gap: 12, width: '100%', boxSizing: 'border-box' },
      field: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
      row: { display: 'flex', gap: 6, alignItems: 'center' },
      label: { fontSize: 12, color: MUTED },
      select: {
        width: '100%', boxSizing: 'border-box', height: 30, padding: '0 8px',
        border: BORDER, borderRadius: 6,
        background: 'var(--dsw-alias-bg-l2, transparent)', color: 'inherit', fontSize: 13,
      },
      empty: {
        border: '1px dashed var(--dsw-alias-border-l2, rgba(128,128,128,0.4))',
        borderRadius: 10, padding: '18px 14px', textAlign: 'center', color: MUTED, fontSize: 12,
      },
      footer: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
      testBox: {
        border: BORDER, borderRadius: 8, padding: 10, fontSize: 12,
        display: 'flex', flexDirection: 'column', gap: 6,
      },
      pre: {
        margin: 0, padding: 8, background: 'rgba(128,128,128,0.12)', borderRadius: 6,
        fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        maxHeight: 160, overflow: 'auto',
      },
      ok: { fontSize: 12, color: 'var(--dsw-alias-state-positive, #2f8f4e)' },
      error: { fontSize: 12, color: DANGER },
      muted: { fontSize: 12, color: MUTED },
      presetInfo: { display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, lineHeight: 1.6, color: MUTED },
      // Detail-page facts, mirroring the plugin manager's own source section.
      detailSection: { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 32 },
      sectionTitle: { margin: 0, fontSize: 14, lineHeight: '20px', fontWeight: 500 },
      facts: { margin: 0 },
      factRow: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        minHeight: 44, padding: '8px 2px',
        borderBottom: '0.5px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.25))',
      },
      factLabel: { flex: 'none', fontSize: 13, lineHeight: '20px', color: MUTED },
      factValue: { minWidth: 0, margin: 0, fontSize: 13, lineHeight: '20px', textAlign: 'end', overflowWrap: 'anywhere' },
      factCode: {
        padding: '2px 6px', borderRadius: 4,
        background: 'var(--dsw-alias-bg-module-platform, rgba(128,128,128,0.1))',
        fontFamily: 'var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
        fontSize: 12,
      },
    }

    /** A brand-new target with nothing filled in. */
    function emptyTarget() {
      return { name: '', command: '', args: ['acp'], model: '', permission: 'reject', env: {}, enabled: true }
    }

    /** Find one preset by id, falling back to the custom entry. */
    function presetOf(id, presets) {
      return presets.find(item => item.id === id) ?? CUSTOM_PRESET
    }

    /** Guess which preset a saved target came from, for the locked edit field. */
    function detectPreset(target, presets) {
      const command = String(target.command ?? '').toLowerCase()
      const found = presets.find(item => item.id !== 'custom' && item.command !== '' && command.includes(item.command.toLowerCase()))
      return found?.id ?? 'custom'
    }

    /** Field label; `detail` rides a hover tooltip. */
    function fieldLabel(label, detail) {
      if (detail === undefined) return h('span', { style: style.label }, label)
      return h('span', { style: { ...style.label, display: 'inline-flex', alignItems: 'center', gap: 4 } },
        label,
        h(Tooltip, { label: detail, delayMs: 200, side: 'top' },
          h('span', {
            style: {
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 14, height: 14, borderRadius: 999, border: BORDER,
              fontSize: 10, color: MUTED, lineHeight: 1,
            },
          }, '!')))
    }

    /** Labeled text field: the detail rides the label tooltip. */
    function textField(key, label, value, onChange, placeholder, detail) {
      return h('label', { key, style: style.field },
        fieldLabel(label, detail),
        h(Input, {
          value: value ?? '',
          placeholder: placeholder ?? '',
          onChange: event => onChange(event.target.value),
        }))
    }

    /** Labeled select field: the detail rides the label tooltip. */
    function selectField(key, label, value, choices, display, onChange, detail, disabled) {
      return h('label', { key, style: style.field },
        fieldLabel(label, detail),
        h('select', {
          value: value ?? choices[0], style: style.select, disabled: disabled === true,
          onChange: event => onChange(event.target.value),
        }, choices.map(choice => h('option', { key: choice, value: choice }, display(choice)))))
    }

    /** One label/value row in the detail-page facts list. */
    function factRow(key, label, value, asCode) {
      return h('div', { key, style: style.factRow },
        h('dt', { style: style.factLabel }, label),
        h('dd', { style: style.factValue },
          asCode === true ? h('code', { style: style.factCode }, String(value)) : value))
    }

    /** One read-only summary cell. */
    function summaryItem(label, value) {
      return h('div', { style: style.summaryItem },
        h('span', { style: style.summaryLabel }, label),
        h('span', { style: style.summaryValue, title: String(value ?? '') }, String(value ?? '')))
    }

    /** Availability state for the dot, from the last handshake and the manual switch. */
    function availabilityOf(target, status) {
      if (target.enabled === false) return 'warning'
      if (status === 'checking') return 'ongoing'
      if (status === 'error') return 'error'
      if (status === 'ok') return 'done'
      return 'idle'
    }

    /** Display label of the ACP service type this target points at. */
    function kindLabelOf(target, presets, t) {
      const preset = presets.find(item => item.id === detectPreset(target, presets))
      return preset === undefined || preset.id === 'custom' ? t('agentKindCustom') : preset.label
    }

    /** One read-only target row with edit and remove actions. */
    function TargetRow(props) {
      const { t, target, probe, presets, toggling, onEdit, onRemove, onToggle } = props
      const status = probe?.status
      const enabled = target.enabled !== false
      // Show "display name (id)". The label is stored on the target when a
      // model is chosen; the probe name is only a fallback for older targets.
      const model = (() => {
        const configured = typeof target.model === 'string' ? target.model.trim() : ''
        const id = typeof probe?.currentValue === 'string' && probe.currentValue !== '' ? probe.currentValue : configured
        if (id === '') return t('modelDefault')
        const stored = typeof target.modelLabel === 'string' ? target.modelLabel.trim() : ''
        const probed = Array.isArray(probe?.models)
          ? probe.models.find(item => item.id === id || item.name === id)?.name
          : undefined
        const label = stored !== '' ? stored : (probed ?? '')
        return label !== '' && label !== id ? `${label}（${id}）` : id
      })()
      const kind = kindLabelOf(target, presets, t)
      const reachability = target.enabled === false
        ? t('reachDisabled')
        : status === 'checking'
          ? t('reachChecking')
          : status === 'error'
            ? t('reachNo')
            : status === 'ok' ? t('reachYes') : t('reachUnknown')
      const tooltip = [kind, reachability, enabled ? t('badgeOn') : t('badgeOff')].join('\n')
      return h('section', { style: style.card },
        h('div', { style: style.cardHead },
          h(Tooltip, { label: tooltip, delayMs: 200, side: 'top' },
            h('div', { style: style.cardTitle },
              h(StateDot, { state: availabilityOf(target, status) }),
              h('span', { style: style.name }, kind),
              h('button', {
                type: 'button',
                title: toggling ? t('saving') : (enabled ? t('toggleDisable') : t('toggleEnable')),
                'aria-label': enabled ? t('toggleDisable') : t('toggleEnable'),
                'aria-pressed': enabled,
                disabled: toggling === true,
                onClick: event => { event.stopPropagation(); onToggle() },
                style: {
                  ...style.toggleBadge,
                  color: enabled ? 'var(--dsw-alias-state-success, #15803d)' : MUTED,
                },
              }, enabled ? t('badgeOn') : t('badgeOff')))),
          h('div', { style: { display: 'flex', gap: 6, alignItems: 'center' } },
            h(Button, { variant: 'outline', size: 'sm', onClick: () => onEdit() }, t('edit')),
            h(Button, {
              variant: 'outline', size: 'sm',
              style: { color: DANGER, borderColor: DANGER },
              onClick: () => onRemove(),
            }, t('remove')))),
        h('div', { style: style.summary },
          summaryItem(t('nameLabel'), target.name),
          summaryItem(t('modelLabel'), model),
          summaryItem(t('permissionLabel'), target.permission)))
    }

    /** One confirmation window for a test result or any failure. */
    function NoticeDialog(props) {
      const { t, notice, onClose } = props
      if (notice === null) return null
      const hasStderr = typeof notice.stderr === 'string' && notice.stderr !== ''
      return h(Modal, {
        open: true,
        onClose,
        title: notice.title,
        closeLabel: t('close'),
      },
        h('p', { style: { margin: 0, lineHeight: 1.6 } }, String(notice.body ?? '')),
        notice.stage === undefined
          ? null
          : h('p', { style: { margin: '8px 0 0', color: MUTED, fontSize: 12 } },
              `${t('testDiag')}: ${String(notice.stage)} · ${String(notice.ms ?? '')}ms`),
        hasStderr ? h('pre', { style: style.pre }, `${t('testStderr')}\n${notice.stderr}`) : null,
        notice.error && (notice.stage !== undefined || hasStderr)
          ? h('p', { style: { margin: '10px 0 0', color: MUTED } }, t('testAskAgent'))
          : null)
    }

    /** Modal editor: one field per row, preset picker, test / save / cancel. */
    function TargetEditor(props) {
      const { t, mode, initial, names, presets, onSave, onCancel } = props
      const [draft, setDraft] = React.useState(() => ({ ...emptyTarget(), ...initial }))
      const [kind, setKind] = React.useState(() => mode === 'edit' ? detectPreset(initial, presets) : 'custom')
      const [models, setModels] = React.useState(null)
      const [currentModel, setCurrentModel] = React.useState(null)
      const [fetching, setFetching] = React.useState(false)
      const [browsing, setBrowsing] = React.useState(false)
      const [testing, setTesting] = React.useState(false)
      const [saving, setSaving] = React.useState(false)
      const [notice, setNotice] = React.useState(null)

      const update = patch => setDraft(current => ({ ...current, ...patch }))
      const locked = mode === 'edit'

      /** Report one failure in a confirmation window; the form never grows. */
      const reportError = (title, body) => setNotice({ error: true, title, body: String(body ?? '') })

      /** Probe this draft; fills the model list and the effective model. */
      const fetchModels = async () => {
        setFetching(true)
        try {
          const response = await fetch('/acp-ui-test', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: draft.name, target: draft }),
          })
          const result = await response.json()
          if (result?.ok === true) {
            const list = Array.isArray(result.models) ? result.models : []
            setModels(list)
            setCurrentModel(typeof result.currentValue === 'string' ? result.currentValue : null)
            // Persist the display name beside the id so the list can show
            // "name (id)" without probing again.
            const current = typeof draft.model === 'string' && draft.model.trim() !== ''
              ? draft.model.trim()
              : (typeof result.currentValue === 'string' ? result.currentValue : '')
            const match = list.find(item => item.id === current || item.name === current)
            if (match !== undefined && match.name !== '') update({ modelLabel: match.name })
          } else {
            setModels(null)
            setCurrentModel(null)
            reportError(t('modelFetchFailed'), result?.message)
          }
        } catch (error) {
          setModels(null)
          setCurrentModel(null)
          reportError(t('modelFetchFailed'), error instanceof Error ? error.message : String(error))
        } finally {
          setFetching(false)
        }
      }

      // Only an existing target auto-probes on open. A draft being added has no
      // complete launch contract yet, so an automatic handshake would fail and
      // just interrupt the form; there the model list loads on demand.
      const lastProbed = React.useRef('')
      React.useEffect(() => {
        if (mode !== 'edit') return undefined
        const command = String(draft.command ?? '').trim()
        if (command === '' || command === lastProbed.current) return undefined
        lastProbed.current = command
        const timer = setTimeout(() => { void fetchModels() }, 200)
        return () => clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [draft.command, mode])

      /** The model dropdown: fetched models plus the saved value. */
      const modelOptions = (() => {
        const list = Array.isArray(models) ? models.map(model => ({ id: model.id, name: model.name })) : []
        const current = typeof draft.model === 'string' ? draft.model.trim() : ''
        if (current !== '' && !list.some(model => model.id === current)) list.unshift({ id: current, name: current })
        return list
      })()

      // The CLI reports the effective model as an id; show its display name.
      const currentModelName = currentModel === null
        ? null
        : (modelOptions.find(model => model.id === currentModel || model.name === currentModel)?.name ?? currentModel)

      /** Pick a preset: fill the launch contract for verified agents. */
      const chooseKind = id => {
        if (locked) return
        setKind(id)
        const preset = presetOf(id, presets)
        if (id === 'custom') return
        setDraft(current => ({
          ...current,
          name: current.name === '' ? preset.name : current.name,
          command: preset.command,
          args: [...preset.args],
          env: { ...preset.env },
        }))
      }

      /** Native file picker on the host; the browser cannot read local paths. */
      const browse = async () => {
        setBrowsing(true)
        try {
          const response = await fetch('/acp-ui-browse', { method: 'POST' })
          const result = await response.json()
          if (result?.cancelled === true) return
          if (result?.ok === true && typeof result.path === 'string') update({ command: result.path })
          else reportError(t('browseFailed'), result?.message)
        } catch (error) {
          reportError(t('browseFailed'), error instanceof Error ? error.message : String(error))
        } finally {
          setBrowsing(false)
        }
      }

      /** Real end-to-end test against the draft; costs model tokens. */
      const test = async () => {
        if (String(draft.command ?? '').trim() === '') {
          reportError(t('noticeTitle'), t('invalidCommand'))
          return
        }
        setTesting(true)
        try {
          const response = await fetch('/acp-ui-test', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ mode: 'verify', name: draft.name, target: draft }),
          })
          const result = await response.json()
          setNotice({
            error: result?.ok !== true,
            title: result?.ok === true ? t('testPassedTitle') : t('testFailedTitle'),
            body: String(result?.message ?? ''),
            stage: result?.stage,
            stderr: result?.stderr,
            ms: result?.ms,
          })
        } catch (error) {
          reportError(t('testFailedTitle'), `${t('testRequestFailed')}${error instanceof Error ? error.message : String(error)}`)
        } finally {
          setTesting(false)
        }
      }

      /** Validate and hand the draft to the page for persistence. */
      const save = async () => {
        const name = String(draft.name ?? '').trim()
        if (name === '') { reportError(t('noticeTitle'), t('invalidEmpty')); return }
        if (names.includes(name)) { reportError(t('noticeTitle'), t('invalidDup').replace('{name}', name)); return }
        if (String(draft.command ?? '').trim() === '') { reportError(t('noticeTitle'), t('invalidCommand')); return }
        setSaving(true)
        try {
          const accepted = await onSave({ ...draft, name })
          if (accepted !== true) reportError(t('noticeTitle'), t('saveRejected'))
        } catch (error) {
          reportError(t('saveFailed'), error instanceof Error ? error.message : String(error))
        } finally {
          setSaving(false)
        }
      }

      const kindChoices = presets.map(preset => preset.id)
      // The preset carries how it was verified: install method plus a short
      // adapter summary, shown under the picker so the choice is informed.
      const selectedPreset = presets.find(preset => preset.id === kind && preset.id !== 'custom')
      const presetInfo = selectedPreset === undefined
        ? null
        : h('div', { style: style.presetInfo },
            h('span', null, `${t('installMethod')}：${selectedPreset.installLabel ?? selectedPreset.install ?? ''}`),
            selectedPreset.installNote === undefined || selectedPreset.installNote === ''
              ? null
              : h('span', null, selectedPreset.installNote),
            selectedPreset.summary === undefined || selectedPreset.summary === ''
              ? null
              : h('span', null, `${t('adaptSummary')}：${selectedPreset.summary}`))

      return h(Modal, {
        open: true,
        onClose: onCancel,
        title: mode === 'edit' ? t('editorEditTitle') : t('editorAddTitle'),
        closeLabel: t('cancel'),
      },
        h('div', { style: style.editor },
          h('div', { key: 'kind', style: style.field },
            fieldLabel(t('agentKindLabel'), locked ? t('agentKindLocked') : t('agentKindHint')),
            h('select', {
              value: kind, style: style.select, disabled: locked,
              onChange: event => chooseKind(event.target.value),
            }, kindChoices.map(id => h('option', { key: id, value: id }, id === 'custom' ? t('agentKindCustom') : (presets.find(preset => preset.id === id)?.label ?? id)))),
            presetInfo),
          textField('name', t('nameLabel'), draft.name, v => update({ name: v }), t('phName'), t('detailName')),
          h('div', { key: 'command', style: style.field },
            h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 } },
              fieldLabel(t('commandLabel'), t('detailCommand')),
              h(Button, {
                variant: 'ghost', size: 'sm', disabled: browsing,
                style: { whiteSpace: 'nowrap', flexShrink: 0, padding: '0 4px', height: 18, fontSize: 11 },
                onClick: browse,
              }, browsing ? t('browsing') : t('browse'))),
            h(Input, {
              value: draft.command ?? '',
              placeholder: t('phCommand'),
              onChange: event => update({ command: event.target.value }),
            })),
          textField('args', t('argsLabel'),
            Array.isArray(draft.args) ? draft.args.join(' ') : '',
            v => update({ args: v.trim() === '' ? [] : v.trim().split(/\s+/) }),
            t('phArgs'), t('detailArgs')),
          h('div', { key: 'model', style: style.field },
            h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 } },
              fieldLabel(t('modelLabel'), currentModelName === null
                ? t('detailModel')
                : `${t('detailModel')}\n${t('modelCurrent')}${currentModelName}`),
              h(Button, {
                variant: 'ghost', size: 'sm', disabled: fetching,
                style: { whiteSpace: 'nowrap', flexShrink: 0, padding: '0 4px', height: 18, fontSize: 11 },
                onClick: fetchModels,
              }, fetching ? t('fetchingModels') : t('fetchModels'))),
            h('select', {
              value: typeof draft.model === 'string' ? draft.model : '',
              style: style.select,
              onChange: event => {
                const selected = event.target.value
                const match = modelOptions.find(item => item.id === selected)
                update({ model: selected, modelLabel: selected === '' ? '' : (match?.name ?? selected) })
              },
            },
              h('option', { value: '' }, t('modelPlaceholder')),
              modelOptions.map(model => h('option', { key: model.id, value: model.id }, model.name)))),
          selectField('permission', t('permissionLabel'), draft.permission, ['allow', 'reject'], v => v,
            v => update({ permission: v }), t('detailPermission')),
          selectField('enabled', t('enabledLabel'), draft.enabled === false ? 'off' : 'on', ['on', 'off'],
            v => v === 'on' ? t('optionOn') : t('optionOff'),
            v => update({ enabled: v === 'on' }), t('detailEnabled')),
          h('div', { style: style.footer },
            h(Tooltip, { label: t('testHint'), delayMs: 200, side: 'top' },
              h(Button, { variant: 'outline', size: 'sm', disabled: testing, onClick: test }, testing ? t('testing') : t('test'))),
            h('div', { style: { flex: 1 } }),
            h(Button, { variant: 'ghost', size: 'sm', disabled: saving, onClick: onCancel }, t('cancel')),
            h(Button, { variant: 'primary', size: 'sm', disabled: saving, onClick: save }, saving ? t('saving') : t('save')))),
        h(NoticeDialog, { t, notice, onClose: () => setNotice(null) }))
    }

    /** Pick the first settings form the Host actually serves. */
    function pickForm(forms) {
      if (!Array.isArray(forms)) return undefined
      return forms.find(form => form !== undefined && form.getSnapshot().status !== 'unavailable') ?? forms[0]
    }

    /** Replace a {name} placeholder. */
    function fill(template, values) {
      let text = template
      for (const [key, value] of Object.entries(values)) text = text.split(`{${key}}`).join(String(value))
      return text
    }

    /** The page: read-only list, modal editor, live availability dots. */
    function ConfigPage(props) {      const { view, forms, t } = props
      const form = pickForm(forms)
      const [snapshot, setSnapshot] = React.useState(() => form === undefined ? undefined : form.getSnapshot())
      React.useEffect(() => {
        if (form === undefined) return undefined
        const sync = () => setSnapshot(form.getSnapshot())
        sync()
        return form.subscribe(sync)
      }, [form])
      const [probes, setProbes] = React.useState({})
      const [editing, setEditing] = React.useState(null)
      const [notice, setNotice] = React.useState(null)
      const [presets, setPresets] = React.useState(() => presetsOf(null))
      const [toggling, setToggling] = React.useState(null)
      // Verified-agent presets live in adapters/agents.json; load them once so
      // adding a preset stays a data edit.
      React.useEffect(() => {
        let cancelled = false
        const load = async () => {
          try {
            const response = await fetch('/acp-ui-presets')
            const document = await response.json()
            if (!cancelled) setPresets(presetsOf(document))
          } catch {
            // The custom entry remains usable when the preset file is missing.
          }
        }
        void load()
        return () => { cancelled = true }
      }, [])

      const targets = Array.isArray(snapshot?.value?.targets) ? snapshot.value.targets : []
      const signature = JSON.stringify(targets)

      // One handshake per saved target when the page opens (or the list
      // changes): free, and it feeds both the availability dot and the model
      // display name, so the row never shows a raw model id. Probes run in
      // parallel so six targets finish in one slow handshake, not the sum.
      React.useEffect(() => {
        let cancelled = false
        // Every row starts grey ("checking") and flips as its handshake lands.
        setProbes(Object.fromEntries(targets.map(item => [item.name, { status: 'checking' }])))
        const probeOne = async (target) => {
          let entry = { status: 'error' }
          try {
            const response = await fetch('/acp-ui-test', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ name: target.name, target }),
            })
            const result = await response.json()
            entry = result?.ok === true
              ? {
                  status: 'ok',
                  models: Array.isArray(result.models) ? result.models : [],
                  currentValue: typeof result.currentValue === 'string' ? result.currentValue : undefined,
                }
              : { status: 'error' }
          } catch {
            entry = { status: 'error' }
          }
          if (cancelled) return
          setProbes(current => ({ ...current, [target.name]: entry }))
        }
        if (targets.length > 0) void Promise.all(targets.map(probeOne))
        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [signature])

      if (view === 'summary') return t('summary')
      if (view !== 'page') return null
      if (form === undefined) return h('p', { style: style.muted }, t('missingService'))
      if (snapshot === undefined) return h('p', { style: style.muted }, t('loading'))
      if (snapshot.status === 'unavailable') return h('p', { style: style.muted }, t('unavailable'))

      /** Write the whole list; the only persistence path on this page. */
      const persist = async next => {
        const accepted = await form.mutate([{ op: 'set', path: ['targets'], value: next }], snapshot.revision)
        if (!accepted) setNotice({ error: true, title: t('noticeTitle'), body: t('saveRejected') })
        return accepted
      }

      const saveDraft = async draft => {
        const index = editing?.index ?? -1
        const next = index < 0 ? [...targets, draft] : targets.map((item, i) => i === index ? draft : item)
        const accepted = await persist(next)
        if (accepted) setEditing(null)
        return accepted
      }

      const removeTarget = async index => {
        await persist(targets.filter((_, i) => i !== index))
      }

      /** Flip one target's enabled flag in place; the editor keeps its dropdown. */
      const toggleEnabled = async index => {
        const target = targets[index]
        if (target === undefined) return
        setToggling(target.name)
        try {
          const next = targets.map((item, i) => i === index ? { ...item, enabled: item.enabled === false } : item)
          await persist(next)
        } finally {
          setToggling(null)
        }
      }

      const editingTarget = editing === null ? null : (editing.index < 0 ? emptyTarget() : (targets[editing.index] ?? emptyTarget()))

      return h('div', { style: style.root },
        h('div', { style: style.header },
          h('div', null,
            h('div', { style: style.title }, t('title'))),
          h(Button, { variant: 'outline', size: 'sm', onClick: () => setEditing({ index: -1 }) }, t('add'))),
        targets.length === 0
          ? h('div', { style: style.empty }, t('empty'))
          : targets.map((target, index) => h(TargetRow, {
              key: `${target.name}-${index}`,
              t, target,
              probe: probes[target.name],
              presets,
              toggling: toggling === target.name,
              onEdit: () => setEditing({ index }),
              onRemove: () => removeTarget(index),
              onToggle: () => toggleEnabled(index),
            })),
        editingTarget === null ? null : h(TargetEditor, {
          t,
          mode: editing.index < 0 ? 'add' : 'edit',
          initial: editingTarget,
          names: targets.filter((_, i) => i !== editing.index).map(item => item.name),
          presets,
          onSave: saveDraft,
          onCancel: () => setEditing(null),
        }),
        h(NoticeDialog, { t, notice, onClose: () => setNotice(null) }))
    }

    /**
     * Detail-page section: versions the plugin runs against, plus the official
     * entry points of the verified agents. Mirrors the plugin manager's own
     * facts list so the two sections read as one page.
     */
    function CompatibilitySection(props) {
      const { subject, t } = props
      const [agents, setAgents] = React.useState([])
      // The official entry points ride the same data file as the presets, so a
      // new verified agent updates both the picker and this list.
      React.useEffect(() => {
        let cancelled = false
        const load = async () => {
          try {
            const response = await fetch('/acp-ui-presets')
            const document = await response.json()
            if (!cancelled) setAgents(Array.isArray(document?.agents) ? document.agents : [])
          } catch {
            // The list stays empty; the compatibility facts still render.
          }
        }
        void load()
        return () => { cancelled = true }
      }, [])
      if (subject === undefined || subject.kind !== 'bundle' || subject.pkg?.name !== PACKAGE) return null
      const boot = typeof window === 'undefined' ? undefined : window.__DSH_BOOT__
      const version = boot?.release?.version ?? 'unknown'
      const commit = boot?.release?.commit
      const links = agents.filter(agent => typeof agent.homepage === 'string' && agent.homepage !== '')
      return h('section', { style: style.detailSection },
        h('h4', { style: style.sectionTitle }, t('compatTitle')),
        h('dl', { style: style.facts },
          factRow('dsh', t('compatDsh'), commit === undefined ? version : `${version} (${commit})`, true),
          factRow('plugin', t('compatPlugin'), 'dsh 0.2.1-rc.3', true),
          factRow('acp', t('compatAcp'), t('compatAcpValue')),
          links.map(link => factRow(link.id ?? link.homepage, link.label,
            h('a', {
              href: link.homepage,
              target: '_blank',
              rel: 'noreferrer',
              style: { color: 'inherit' },
            }, link.homepage)))))
    }

    /** Settings → Plugins tab: the config page mounted in the settings surface. */
    function SettingsTab(props) {
      return h(ConfigPage, { ...props, view: 'page' })
    }

    /** Cordis service dependencies of the browser half. */
    const inject = ['slots', 'configForms', 'locale']

    /**
     * Register the plugin's configuration page and detail section.
     * @param ctx - the browser plugin context.
     */
    function apply(ctx) {
      let t = key => key
      if (ctx.locale !== undefined) {
        ctx.effect(() => ctx.locale.register(NS, LOCALE))
        t = ctx.locale.bind(NS)
      }
      const forms = NAMESPACES.map(namespace => ctx.configForms.get(namespace))
      ctx.effect(() => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
        name: 'plugins.bundle.config',
        key: PACKAGE,
        inject: () => ({ forms, t }),
      }, ConfigPage)))
      ctx.effect(() => ctx.slots.inject('plugins.detail.section', () => ctx.slots.register({
        name: 'plugins.detail.section',
        id: 'compatibility',
        order: 100,
        inject: () => ({ t }),
      }, CompatibilitySection)))
      // Settings → Plugins → tab: the same configuration page, in the surface
      // the shell reserves for host-plane plugin configuration pages.
      ctx.effect(() => ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
        name: 'settings.plugins.tab',
        id: PACKAGE,
        order: 20,
        label: () => t('settingsTab'),
        locale: NS,
        inject: () => ({ forms, t }),
      }, SettingsTab)))
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
