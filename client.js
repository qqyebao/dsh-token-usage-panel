/**
 * Client half: the sidebar "Usage" panel.
 *
 * The page renders one projection — `tokenLedger`, published by this bundle's
 * own Host half. It carries whole-session token/cost totals and the per-Turn
 * ledger, so the panel depends on no other plugin for usage or pricing.
 *
 * The ledger arrives as a wire view on the session catalog
 * (`ctx.sessions.list`): live sessions carry it from the projection feed, cold
 * sessions from the persisted projection cache. A session whose cache row
 * predates the unit is filled in with `ctx.sessions.refreshProjections()` — a
 * cold-safe exact read the Host caches again — so the panel converges on
 * complete data without a custom Host route.
 */
window.__ModuleLoader__.load({
  id: '@qqyebao/dsh-token-usage-panel',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'token-usage-panel'
    const PANEL_ID = 'token-usage'
    /** Parallel exact-projection reads; each is a cold Session log read. */
    const FILL_CONCURRENCY = 2
    /** Upper bound of sessions one pass fills, so opening the page stays bounded. */
    const FILL_LIMIT = 80
    /** Default turns per page, and the page sizes the reader can pick. */
    const DEFAULT_TURN_PAGE_SIZE = 20
    const TURN_PAGE_SIZES = [10, 20, 50, 100]
    /** Reported to the account Remote as this client's build identity. */
    const CLIENT_VERSION = '2.1.0'
    /** Global time-range presets, in chip order; `all` is the default. */
    const RANGE_IDS = ['all', 'today', 'yesterday', 'beforeYesterday', 'last3', 'last7', 'last30']

    const ZH = {
      'panel': '用量统计',
      'title': '用量统计',
      'subtitle': '所有会话的 Token 消耗与花费',
      'refresh': '重新汇总',
      'loading': '正在读取会话…',
      'metric.cost': '总花费',
      'chip.peak': '高峰 {value}',
      'chip.idle': '空闲 {value}',
      'metric.tokens': '总 Token',
      'metric.tokens.hint': '缓存命中 {percent}%',
      'metric.tokens.hintUnknown': '未缓存输入 + 缓存读取 + 输出',
      'metric.sessions': '对话数',
      'metric.sessions.hint': '其中子会话 {count} 个',
      'metric.sessions.hintNone': '跨全部工作区',
      'metric.projects': '项目数',
      'metric.projects.hint': '平均每次 {amount}',
      'section.projects': '按项目统计 · 消耗占比',
      'section.projects.note': '{count} 个项目',
      'chart.other': '其他',
      'chart.note': '占比 ≤5% 的项目合并为「其他」',
      'chart.empty': '暂无可统计的花费',
      'chart.label': '项目花费占比',
      'pager.summary': '第 {page} / {pages} 页 · 第 {from}–{to} 轮，共 {count} 轮',
      'pager.prev': '上一页',
      'pager.next': '下一页',
      'pager.size': '每页',
      'pager.unit': '轮',
      'pager.sizeAria': '每页显示的轮数',
      'section.sessions': '按会话统计 · 消耗 Top 5',
      'section.sessions.note': '{count} 次对话',
      'section.sessions.noteRange': '{count} 次对话 · {range}',
      'section.sessions.pending': '{count} 次对话 · 还有 {pending} 个会话汇总中',
      'section.records': '对话记录',
      'section.records.note': '共 {count} 轮 · 按时间倒序',
      'table.time': '时间',
      'table.session': '会话',
      'table.tokens': 'Token',
      'table.cost': '花费',
      'empty.title': '还没有可统计的对话',
      'empty.body': '发起一次对话后，这里会按项目与会话汇总 Token 和花费。',
      'notice.pending': '正在汇总 {count} 个会话…',
      'notice.noCost': '没有找到用量数据：本插件 Host 半边的 tokenLedger 投影没有注册（插件未启用，或当前组合没有会话投影服务）。',
      'notice.missing': '{count} 个会话暂无花费数据，点「重新汇总」可继续补齐。',
      'notice.noRefresh': '当前组合没有会话投影服务，只能显示已缓存的数据。',
      'notice.crashed': '用量面板渲染失败，请刷新页面后重试。',
      'record.turn': '第 {turn} 轮',
      'loading.turns': '正在按轮次汇总会话…',
      'empty.turns': '还没有可统计的轮次。',
      'empty.range': '该时间范围内没有对话',
      'empty.rangeBody': '换个更长的区间，或切回「全部」。',
      'notice.turnless': '{count} 个会话缺少逐轮数据，无法按时间筛选',
      'range.label': '时间范围',
      'range.all': '全部',
      'range.today': '今天',
      'range.yesterday': '昨天',
      'range.beforeYesterday': '前天',
      'range.last3': '近三天',
      'range.last7': '近一周',
      'range.last30': '近一个月',
      'range.from': '开始',
      'range.to': '结束',
      'range.clear': '清除',
      'range.invalid': '开始时间需早于结束时间',
      'range.custom': '自定义',
      'balance.label': '余额',
      'balance.loading': '…',
      'balance.signedOut': '未登录',
      'balance.failed': '获取失败',
      'balance.bonus': '赠送 {amount}',
      'balance.updated': '更新于 {time}',
      'balance.refresh': '点击刷新',
      'balance.refreshing': '刷新中',
      'balance.aria': '账户余额，点击刷新',
      'range.pickDate': '选择日期',
      'cal.date': '{year}年{month}月{day}日',
      'cal.monthTitle': '{year}年{month}月',
      'cal.weekdays': '一,二,三,四,五,六,日',
      'cal.prevMonth': '上一月',
      'cal.nextMonth': '下一月',
      'cal.prevYear': '上一年',
      'cal.nextYear': '下一年',
      'notice.stalled': '会话列表加载较慢或失败，可刷新页面后重试。',
      'footnote': '价格为 DeepSeek 官方峰谷价，按每次调用的实际时刻与模型计价；每轮花费是该轮所有调用之和，Token 取自各会话日志的 usage 样本。',
      'badge.subagent': '子会话',
      'ungrouped': '未分组',
      'defaultWorkspace': '默认工作区',
      'openSession': '打开会话：{title}',
      'groupSeparator': ',',
      'thousand': '{value}k',
      'million': '{value}M',
      'tokens': '{count} tok',
    }

    const EN = {
      'panel': 'Usage',
      'title': 'Usage',
      'subtitle': 'Token consumption and cost across every conversation',
      'refresh': 'Recalculate',
      'loading': 'Reading sessions…',
      'metric.cost': 'Total cost',
      'chip.peak': 'Peak {value}',
      'chip.idle': 'Idle {value}',
      'metric.tokens': 'Total tokens',
      'metric.tokens.hint': 'Cache hit {percent}%',
      'metric.tokens.hintUnknown': 'Uncached input + cache read + output',
      'metric.sessions': 'Conversations',
      'metric.sessions.hint': '{count} subagent sessions',
      'metric.sessions.hintNone': 'Across every workspace',
      'metric.projects': 'Projects',
      'metric.projects.hint': 'Average {amount} per conversation',
      'section.projects': 'Cost by project · share',
      'section.projects.note': '{count} projects',
      'chart.other': 'Other',
      'chart.note': 'Projects at or under 5% of cost are grouped as Other',
      'chart.empty': 'No cost to chart yet',
      'chart.label': 'Cost share by project',
      'pager.summary': 'Page {page} of {pages} · turns {from}–{to} of {count}',
      'pager.prev': 'Previous',
      'pager.next': 'Next',
      'pager.size': 'Per page',
      'pager.unit': 'turns',
      'pager.sizeAria': 'Turns per page',
      'section.sessions': 'Cost by conversation · Top 5',
      'section.sessions.note': '{count} conversations',
      'section.sessions.noteRange': '{count} conversations · {range}',
      'section.sessions.pending': '{count} conversations · {pending} still loading',
      'section.records': 'Conversation records',
      'section.records.note': '{count} turns · newest first',
      'table.time': 'Time',
      'table.session': 'Conversation',
      'table.tokens': 'Tokens',
      'table.cost': 'Cost',
      'empty.title': 'Nothing measured yet',
      'empty.body': 'Start a conversation and its tokens and cost will be summarized here by project and by conversation.',
      'notice.pending': 'Calculating {count} conversations…',
      'notice.noCost': 'No usage data found: the tokenLedger projection from this plugin’s Host half is not registered (plugin disabled, or this composition has no session projection service).',
      'notice.missing': '{count} conversations have no cost data yet; press “Recalculate” to fill more.',
      'notice.noRefresh': 'This composition has no session projection service; only cached values are shown.',
      'notice.crashed': 'The usage panel failed to render. Reload the page and try again.',
      'record.turn': 'Turn {turn}',
      'loading.turns': 'Splitting conversations into turns…',
      'empty.turns': 'No turns measured yet.',
      'empty.range': 'No conversations in this range',
      'empty.rangeBody': 'Pick a longer range, or switch back to All.',
      'notice.turnless': '{count} conversations lack per-turn data and cannot be time-filtered',
      'range.label': 'Time range',
      'range.all': 'All',
      'range.today': 'Today',
      'range.yesterday': 'Yesterday',
      'range.beforeYesterday': 'Day before',
      'range.last3': 'Last 3 days',
      'range.last7': 'Last 7 days',
      'range.last30': 'Last 30 days',
      'range.from': 'From',
      'range.to': 'To',
      'range.clear': 'Clear',
      'range.invalid': 'Start must be before end',
      'range.custom': 'Custom',
      'balance.label': 'Balance',
      'balance.loading': '…',
      'balance.signedOut': 'Signed out',
      'balance.failed': 'Unavailable',
      'balance.bonus': 'Bonus {amount}',
      'balance.updated': 'Updated {time}',
      'balance.refresh': 'Click to refresh',
      'balance.refreshing': 'Refreshing',
      'balance.aria': 'Account balance; click to refresh',
      'range.pickDate': 'Pick a date',
      'cal.date': '{year}-{month}-{day}',
      'cal.monthTitle': '{year}-{month}',
      'cal.weekdays': 'Mo,Tu,We,Th,Fr,Sa,Su',
      'cal.prevMonth': 'Previous month',
      'cal.nextMonth': 'Next month',
      'cal.prevYear': 'Previous year',
      'cal.nextYear': 'Next year',
      'notice.stalled': 'Loading the session list is slow or failed; reload the page and try again.',
      'footnote': 'Costs use DeepSeek’s official peak/idle rates, applied per call at its own time and model; a turn’s cost is the sum of its calls. Tokens come from each session log’s usage samples.',
      'badge.subagent': 'Subagent',
      'ungrouped': 'Ungrouped',
      'defaultWorkspace': 'Default workspace',
      'openSession': 'Open conversation: {title}',
      'groupSeparator': ',',
      'thousand': '{value}k',
      'million': '{value}M',
      'tokens': '{count} tok',
    }

    // Page chrome copied from the host's management pages (TaskManagerPage),
    // renamed under this plugin's prefix and reduced to alias tokens.
    const CSS = [
      // Accents come from the theme's real state colors: `brand-primary` is the
      // near-black label color, so bars and chips use the business/success/warn
      // aliases instead, each mixed with label-primary for text contrast.
      '.tup-page{--tup-accent-cost:var(--dsw-alias-state-warn-primary,#f59e0b);--tup-accent-tokens:var(--dsw-alias-state-business-primary,#4176e6);--tup-accent-talks:var(--dsw-alias-state-success-primary,#22c55e);--tup-accent-projects:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4176e6) 52%,var(--dsw-alias-state-error-primary,#ec1313));--tup-ink-cost:color-mix(in srgb,var(--tup-accent-cost) 62%,var(--dsw-alias-label-primary));width:100%;min-width:0;height:100%;min-height:0;display:flex;overflow:hidden;color:var(--dsw-alias-label-primary);background:radial-gradient(900px 260px at 10% -60px,color-mix(in srgb,var(--tup-accent-tokens) 10%,transparent),transparent 70%),radial-gradient(700px 220px at 92% -80px,color-mix(in srgb,var(--tup-accent-projects) 10%,transparent),transparent 70%),var(--dsw-alias-bg-base);font-size:14px;line-height:1.6}',
      '.tup-pane{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0}',
      '.tup-scroll{flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable;--dsh-scrollbar-width:9px;--dsh-scrollbar-thumb-border:2px}',
      '.tup-content{max-width:960px;margin:0 auto;padding:0 clamp(24px,4vw,48px) 48px}',
      '.tup-heading{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px 16px;padding-top:28px;margin-bottom:20px}',
      '[data-platform=darwin] .tup-heading{padding-top:calc(28px + var(--dsh-frame-top-clearance,0px))}',
      '.tup-headingText{display:flex;align-items:center;gap:12px;min-width:0}',
      '.tup-headingCopy{min-width:0}',
      '.tup-logo{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;flex:none;border-radius:11px;color:#fff;background:linear-gradient(145deg,var(--tup-accent-tokens),var(--tup-accent-projects));box-shadow:0 3px 12px color-mix(in srgb,var(--tup-accent-tokens) 34%,transparent)}',
      '.tup-logo svg{width:18px;height:18px}',
      '.tup-heading h1{margin:0;font-size:20px;font-weight:500;line-height:28px}',
      '.tup-subtitle{margin:4px 0 0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}',
      '.tup-toolbar{display:flex;align-items:center;gap:10px;flex:none}',
      '.tup-status{display:inline-flex;align-items:center;gap:6px;color:color-mix(in srgb,var(--tup-accent-tokens) 62%,var(--dsw-alias-label-primary));font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}',
      '.tup-status:before{content:"";width:6px;height:6px;border-radius:50%;flex:none;background:var(--tup-accent-tokens)}',
      '.tup-button{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:15px;border:.5px solid color-mix(in srgb,var(--tup-accent-tokens) 34%,var(--dsw-alias-border-l2));background:color-mix(in srgb,var(--tup-accent-tokens) 8%,transparent);color:color-mix(in srgb,var(--tup-accent-tokens) 82%,var(--dsw-alias-label-primary));font:inherit;font-size:13px;line-height:20px;cursor:pointer;transition:background .15s,border-color .15s}',
      '.tup-button:hover{background:color-mix(in srgb,var(--tup-accent-tokens) 15%,transparent);border-color:color-mix(in srgb,var(--tup-accent-tokens) 55%,var(--dsw-alias-border-l2))}',
      '.tup-button:disabled{color:var(--dsw-alias-label-secondary);background:0 0;border-color:var(--dsw-alias-border-l1);opacity:.6;cursor:default}',
      '.tup-button:focus-visible{outline:2px solid var(--tup-accent-tokens);outline-offset:2px}',
      '.tup-button svg{width:14px;height:14px;flex:none}',
      '.tup-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}',
      '.tup-card{position:relative;overflow:hidden;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,16px);background:linear-gradient(168deg,color-mix(in srgb,var(--tup-tone-accent,var(--tup-accent-tokens)) 10%,var(--dsw-alias-bg-layer-1)) 0%,var(--dsw-alias-bg-layer-1) 64%);padding:15px 16px 14px;min-width:0}',
      '.tup-card:before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--tup-tone-accent,var(--tup-accent-tokens)),color-mix(in srgb,var(--tup-tone-accent,var(--tup-accent-tokens)) 8%,transparent))}',
      '.tup-toneCost{--tup-tone-accent:var(--tup-accent-cost)}',
      '.tup-toneTokens{--tup-tone-accent:var(--tup-accent-tokens)}',
      '.tup-toneTalks{--tup-tone-accent:var(--tup-accent-talks)}',
      '.tup-toneProjects{--tup-tone-accent:var(--tup-accent-projects)}',
      '.tup-cardLabel{margin:0;display:flex;align-items:center;gap:7px;color:color-mix(in srgb,var(--tup-tone-accent,var(--tup-accent-tokens)) 58%,var(--dsw-alias-label-primary));font-size:12px;line-height:18px;font-weight:500}',
      '.tup-cardIcon{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;flex:none;border-radius:8px;background:color-mix(in srgb,var(--tup-tone-accent,var(--tup-accent-tokens)) 16%,transparent);color:var(--tup-tone-accent,var(--tup-accent-tokens))}',
      '.tup-cardIcon svg{width:14px;height:14px}',
      '.tup-cardValue{margin:8px 0 0;font-size:24px;line-height:32px;font-weight:600;letter-spacing:-.01em;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}',
      '.tup-toneCost .tup-cardValue{color:color-mix(in srgb,var(--tup-accent-cost) 76%,var(--dsw-alias-label-primary))}',
      '.tup-cardHint{margin:4px 0 0;display:flex;flex-wrap:wrap;gap:4px;align-items:center;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}',
      '.tup-chips{display:inline-flex;flex-wrap:wrap;gap:4px;align-items:center}',
      '.tup-chip{display:inline-flex;align-items:center;border-radius:8px;padding:0 6px;font-size:11px;line-height:18px;font-weight:500;white-space:nowrap;font-variant-numeric:tabular-nums}',
      '.tup-chipWarn{background:color-mix(in srgb,var(--tup-accent-cost) 16%,transparent);color:color-mix(in srgb,var(--tup-accent-cost) 58%,var(--dsw-alias-label-primary))}',
      '.tup-chipOk{background:color-mix(in srgb,var(--tup-accent-talks) 16%,transparent);color:color-mix(in srgb,var(--tup-accent-talks) 52%,var(--dsw-alias-label-primary))}',
      '.tup-chipInfo{background:color-mix(in srgb,var(--tup-accent-tokens) 14%,transparent);color:color-mix(in srgb,var(--tup-accent-tokens) 62%,var(--dsw-alias-label-primary))}',
      '.tup-section{margin-top:28px}',
      '.tup-sectionHead{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:10px}',
      '.tup-sectionHead h2{margin:0;display:flex;align-items:center;gap:8px;font-size:14px;font-weight:500;line-height:22px}',
      '.tup-sectionBar{width:3px;height:14px;border-radius:2px;flex:none;background:var(--tup-tone-accent,var(--tup-accent-tokens))}',
      '.tup-sectionNote{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums;text-align:right}',
      '.tup-rows{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,16px);overflow:hidden}',
      '.tup-row[data-rank="1"]{--tup-rank-accent:var(--tup-accent-cost)}',
      '.tup-row[data-rank="2"]{--tup-rank-accent:var(--tup-accent-tokens)}',
      '.tup-row[data-rank="3"]{--tup-rank-accent:var(--tup-accent-talks)}',
      '.tup-row[data-rank="4"],.tup-row[data-rank="5"]{--tup-rank-accent:var(--tup-accent-projects)}',
      '.tup-row{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 14px;border-top:.5px solid var(--dsw-alias-border-l1);transition:background .15s}',
      '.tup-row:first-child{border-top:0}',
      '.tup-row:hover{background:color-mix(in srgb,var(--tup-rank-accent,var(--tup-accent-tokens)) 6%,transparent)}',
      '.tup-rank{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:color-mix(in srgb,var(--tup-rank-accent,var(--dsw-alias-label-secondary)) 16%,transparent);color:color-mix(in srgb,var(--tup-rank-accent,var(--dsw-alias-label-secondary)) 58%,var(--dsw-alias-label-primary));font-size:11px;font-weight:600;line-height:20px;font-variant-numeric:tabular-nums}',
      '.tup-rowMain{min-width:0}',
      '.tup-rowTitle{display:block;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.tup-rowMeta{display:block;margin-top:1px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;overflow-wrap:anywhere}',
      '.tup-bar{display:block;height:3px;margin-top:7px;border-radius:2px;background:var(--dsw-alias-border-l1);overflow:hidden}',
      '.tup-barFill{display:block;height:100%;border-radius:2px;background:linear-gradient(90deg,color-mix(in srgb,var(--tup-rank-accent,var(--tup-accent-tokens)) 55%,transparent),var(--tup-rank-accent,var(--tup-accent-tokens)))}',
      '.tup-rowValue{text-align:right;font-size:13px;line-height:20px;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--tup-ink-cost)}',
      '.tup-rowValue small{display:block;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}',
      '.tup-tableWrap{border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,16px);overflow:hidden}',
      '.tup-table{width:100%;border-collapse:collapse;font-size:13px;line-height:20px}',
      '.tup-table th{padding:8px 14px;background:color-mix(in srgb,var(--tup-accent-talks) 6%,transparent);color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:400;line-height:18px;text-align:left;border-bottom:.5px solid var(--dsw-alias-border-l1);white-space:nowrap}',
      '.tup-table td{padding:10px 14px;border-top:.5px solid var(--dsw-alias-border-l1);vertical-align:top}',
      '.tup-table tbody tr:first-child td{border-top:0}',
      '.tup-table tbody tr:hover{background:color-mix(in srgb,var(--tup-accent-talks) 5%,transparent)}',
      '.tup-table .tup-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.tup-table .tup-cost{color:var(--tup-ink-cost);font-weight:600}',
      '.tup-time{color:var(--dsw-alias-label-secondary);white-space:nowrap;font-variant-numeric:tabular-nums;font-size:12px;line-height:20px}',
      '.tup-session{min-width:0}',
      '.tup-sessionLine{display:flex;align-items:center;gap:6px;min-width:0}',
      '.tup-link{display:block;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:0 0;border:0;padding:0;margin:0;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer}',
      '.tup-link:hover{color:color-mix(in srgb,var(--tup-accent-tokens) 78%,var(--dsw-alias-label-primary));text-decoration:underline;text-underline-offset:2px}',
      '.tup-link:focus-visible{outline:2px solid var(--tup-accent-tokens);outline-offset:2px;border-radius:4px}',
      '.tup-linkStatic{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.tup-recordMeta{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:2px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}',
      '.tup-sep{color:var(--dsw-alias-label-secondary);opacity:.6}',
      '.tup-badge{flex:none;border:.5px solid color-mix(in srgb,var(--tup-accent-tokens) 24%,transparent);border-radius:9px;padding:0 6px;background:color-mix(in srgb,var(--tup-accent-tokens) 11%,transparent);color:color-mix(in srgb,var(--tup-accent-tokens) 62%,var(--dsw-alias-label-primary));font-size:11px;line-height:16px;white-space:nowrap}',
      '.tup-badgeSub{border-color:color-mix(in srgb,var(--tup-accent-projects) 28%,transparent);background:color-mix(in srgb,var(--tup-accent-projects) 13%,transparent);color:color-mix(in srgb,var(--tup-accent-projects) 60%,var(--dsw-alias-label-primary))}',
      '.tup-empty{display:flex;flex-direction:column;align-items:center;padding:48px 20px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:14px;line-height:1.6}',
      '.tup-emptyIcon{color:color-mix(in srgb,var(--tup-accent-tokens) 55%,var(--dsw-alias-label-secondary));margin-bottom:12px}',
      '.tup-emptyTitle{margin:0 0 8px;font-size:14px;font-weight:400;color:var(--dsw-alias-label-secondary)}',
      '.tup-emptyBody{margin:0;font-size:13px;line-height:20px;max-width:420px}',
      '.tup-notice{display:flex;align-items:flex-start;gap:9px;margin:0 0 16px;padding:12px 14px;border-radius:12px;background:color-mix(in srgb,var(--tup-accent-cost) 9%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-secondary);font-size:12px;line-height:20px}',
      '.tup-notice svg{width:14px;height:14px;flex:none;margin-top:3px;color:var(--tup-accent-cost)}',
      '.tup-notice p{margin:0;flex:1}',
      '.tup-footnote{margin:20px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:20px}',
      '.tup-split{margin-top:28px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px;align-items:stretch}',
      '.tup-split .tup-section{margin-top:0;display:flex;flex-direction:column;min-width:0}',
      '.tup-chartCard{flex:1;display:flex;flex-direction:column;justify-content:center;gap:4px;min-height:0;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,16px);padding:10px 12px 8px;background:linear-gradient(168deg,color-mix(in srgb,var(--tup-accent-projects) 7%,var(--dsw-alias-bg-layer-1)) 0%,var(--dsw-alias-bg-layer-1) 62%)}',
      '.tup-pie{display:block;width:100%;max-width:440px;height:auto;margin:0 auto}',
      '.tup-pieWedge{stroke:var(--dsw-alias-bg-base);stroke-width:2;stroke-linejoin:round}',
      '.tup-pieLeader{fill:none;stroke-width:1;opacity:.6}',
      '.tup-pieLabelName{fill:var(--dsw-alias-label-primary);font-size:11px;font-weight:500}',
      '.tup-pieLabelMeta{fill:var(--dsw-alias-label-secondary);font-size:10px}',
      '.tup-chartNote{margin:0;text-align:center;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px}',
      '.tup-chartEmpty{display:flex;align-items:center;justify-content:center;min-height:160px;color:var(--dsw-alias-label-secondary);font-size:13px}',
      '.tup-slice0{color:var(--tup-accent-tokens)}',
      '.tup-slice1{color:var(--tup-accent-cost)}',
      '.tup-slice2{color:var(--tup-accent-talks)}',
      '.tup-slice3{color:var(--tup-accent-projects)}',
      '.tup-slice4{color:color-mix(in srgb,var(--tup-accent-tokens) 52%,var(--tup-accent-talks))}',
      '.tup-slice5{color:color-mix(in srgb,var(--tup-accent-cost) 58%,var(--tup-accent-projects))}',
      '.tup-sliceOther{color:color-mix(in srgb,var(--dsw-alias-label-secondary) 55%,transparent)}',
      '@media (width<=860px){.tup-split{grid-template-columns:minmax(0,1fr)}}',
      '.tup-pager{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-top:10px}',
      '.tup-pagerInfo{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}',
      '.tup-pagerActions{display:flex;align-items:center;gap:6px;flex:none}',
      '.tup-pagerButton{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 10px;border-radius:13px;border:.5px solid var(--dsw-alias-border-l2);background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;cursor:pointer;transition:background .15s,color .15s,border-color .15s}',
      '.tup-pagerButton:hover:not(:disabled){background:color-mix(in srgb,var(--tup-accent-talks) 10%,transparent);color:color-mix(in srgb,var(--tup-accent-talks) 66%,var(--dsw-alias-label-primary));border-color:color-mix(in srgb,var(--tup-accent-talks) 30%,var(--dsw-alias-border-l2))}',
      '.tup-pagerButton:disabled{opacity:.45;cursor:default}',
      '.tup-pagerButton:focus-visible{outline:2px solid var(--tup-accent-talks);outline-offset:2px}',
      '.tup-pagerButton svg{width:12px;height:12px;flex:none}',
      '.tup-pieSlice{transform-box:view-box;transform-origin:220px 130px;transition:transform .45s cubic-bezier(.34,1.56,.64,1)}',
      '.tup-pieSliceActive{transform:scale(1.09)}',
      '@keyframes tup-label-in{from{opacity:0}to{opacity:1}}',
      '.tup-pieHoverLabel{animation:tup-label-in .18s ease-out;pointer-events:none}',
      '.tup-pagerSize{display:inline-flex;align-items:center;gap:4px;margin-right:4px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}',
      '.tup-pagerSelect{height:24px;border-radius:12px;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:18px;padding:0 4px;cursor:pointer}',
      '.tup-pagerSelect:focus-visible{outline:2px solid var(--tup-accent-talks);outline-offset:2px}',
      '.tup-rangeBar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px;margin:0 0 18px}',
      '.tup-ranges{display:flex;flex-wrap:wrap;gap:6px;margin:0}',
      '.tup-rangeInputs{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px}',
      '.tup-rangeField{display:inline-flex;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}',
      '.tup-dateField{position:relative;display:inline-flex}',
      '.tup-dateButton{display:inline-flex;align-items:center;justify-content:space-between;gap:6px;height:28px;min-width:132px;padding:0 8px;border-radius:8px;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:18px;cursor:pointer;transition:border-color .15s,background .15s}',
      '.tup-dateButton:hover{border-color:color-mix(in srgb,var(--tup-accent-tokens) 34%,var(--dsw-alias-border-l2))}',
      '.tup-dateButton:focus-visible,.tup-dateButtonOpen{outline:2px solid var(--tup-accent-tokens);outline-offset:2px}',
      '.tup-dateButton svg{width:13px;height:13px;flex:none;color:var(--dsw-alias-label-secondary)}',
      '.tup-datePlaceholder{color:var(--dsw-alias-label-secondary)}',
      '.tup-dateValue{font-variant-numeric:tabular-nums}',
      '.tup-calendar{position:absolute;top:calc(100% + 6px);left:0;z-index:40;width:238px;padding:10px;border-radius:12px;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);box-shadow:var(--dsw-elevation-prominent,0 8px 24px #00000026)}',
      '.tup-calendarRight{left:auto;right:0}',
      '.tup-calHead{display:flex;align-items:center;gap:2px;margin-bottom:6px}',
      '.tup-calTitle{flex:1;text-align:center;font-size:12px;font-weight:500;line-height:20px;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}',
      '.tup-calNav{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border:0;border-radius:6px;background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:1;cursor:pointer}',
      '.tup-calNav:hover{background:color-mix(in srgb,var(--tup-accent-tokens) 10%,transparent);color:var(--dsw-alias-label-primary)}',
      '.tup-calNav:focus-visible{outline:2px solid var(--tup-accent-tokens);outline-offset:1px}',
      '.tup-calWeek{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:2px}',
      '.tup-calWeek span{text-align:center;font-size:10px;line-height:16px;color:var(--dsw-alias-label-secondary)}',
      '.tup-calGrid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}',
      '.tup-calDay{height:26px;border:0;border-radius:7px;background:0 0;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:1;cursor:pointer;font-variant-numeric:tabular-nums}',
      '.tup-calDay:hover{background:color-mix(in srgb,var(--tup-accent-tokens) 12%,transparent)}',
      '.tup-calDay:focus-visible{outline:2px solid var(--tup-accent-tokens);outline-offset:0}',
      '.tup-calDayToday{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--tup-accent-tokens) 45%,transparent)}',
      '.tup-calDaySelected{background:color-mix(in srgb,var(--tup-accent-tokens) 18%,transparent);color:color-mix(in srgb,var(--tup-accent-tokens) 82%,var(--dsw-alias-label-primary));font-weight:600}',
      '.tup-calBlank{height:26px}',
      '.tup-calFoot{display:flex;justify-content:space-between;gap:6px;margin-top:8px;padding-top:8px;border-top:.5px solid var(--dsw-alias-border-l1)}',
      '.tup-calAction{height:24px;padding:0 8px;border-radius:12px;border:.5px solid var(--dsw-alias-border-l2);background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;line-height:16px;cursor:pointer}',
      '.tup-calAction:hover{background:color-mix(in srgb,var(--tup-accent-tokens) 8%,transparent);color:var(--dsw-alias-label-primary)}',
      '.tup-calAction:focus-visible{outline:2px solid var(--tup-accent-tokens);outline-offset:2px}',
      '.tup-rangeClear{height:26px;padding:0 10px;border-radius:13px;border:.5px solid var(--dsw-alias-border-l2);background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;cursor:pointer;transition:background .15s,color .15s}',
      '.tup-rangeClear:hover:not(:disabled){background:color-mix(in srgb,var(--tup-accent-tokens) 8%,transparent);color:color-mix(in srgb,var(--tup-accent-tokens) 72%,var(--dsw-alias-label-primary))}',
      '.tup-rangeClear:disabled{opacity:.45;cursor:default}',
      '.tup-rangeClear:focus-visible{outline:2px solid var(--tup-accent-tokens);outline-offset:2px}',
      '.tup-rangeWarning{color:var(--tup-ink-cost);font-size:12px;line-height:18px}',

      '.tup-rangeChip{height:26px;padding:0 12px;border-radius:13px;border:.5px solid var(--dsw-alias-border-l2);background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;cursor:pointer;transition:background .15s,color .15s,border-color .15s}',
      '.tup-rangeChip:hover{background:color-mix(in srgb,var(--tup-accent-tokens) 8%,transparent);color:color-mix(in srgb,var(--tup-accent-tokens) 72%,var(--dsw-alias-label-primary));border-color:color-mix(in srgb,var(--tup-accent-tokens) 30%,var(--dsw-alias-border-l2))}',
      '.tup-rangeChipActive{background:color-mix(in srgb,var(--tup-accent-tokens) 15%,transparent);border-color:color-mix(in srgb,var(--tup-accent-tokens) 46%,transparent);color:color-mix(in srgb,var(--tup-accent-tokens) 82%,var(--dsw-alias-label-primary));font-weight:500}',
      '.tup-rangeChip:focus-visible{outline:2px solid var(--tup-accent-tokens);outline-offset:2px}',
      '.tup-balance{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:15px;border:.5px solid color-mix(in srgb,var(--tup-accent-cost) 30%,var(--dsw-alias-border-l2));background:color-mix(in srgb,var(--tup-accent-cost) 8%,transparent);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;cursor:pointer;transition:background .15s,border-color .15s}',
      '.tup-balance:hover{background:color-mix(in srgb,var(--tup-accent-cost) 14%,transparent);border-color:color-mix(in srgb,var(--tup-accent-cost) 48%,var(--dsw-alias-border-l2))}',
      '.tup-balance:focus-visible{outline:2px solid var(--tup-accent-cost);outline-offset:2px}',
      '.tup-balance svg{width:14px;height:14px;flex:none;color:var(--tup-accent-cost)}',
      '.tup-balanceLabel{color:var(--dsw-alias-label-secondary)}',
      '.tup-balanceValue{color:color-mix(in srgb,var(--tup-accent-cost) 64%,var(--dsw-alias-label-primary));font-weight:600;font-variant-numeric:tabular-nums}',
      '.tup-balanceMuted{color:var(--dsw-alias-label-secondary);font-weight:400}',
      '@media (width<=760px){.tup-content{padding:0 20px 40px}.tup-table th,.tup-table td{padding:8px 10px}.tup-table .tup-time{display:none}}',
    ].join('')

    const styles = {
      page: 'tup-page',
      pane: 'tup-pane',
      scroll: 'tup-scroll',
      content: 'tup-content',
      heading: 'tup-heading',
      headingText: 'tup-headingText',
      headingCopy: 'tup-headingCopy',
      logo: 'tup-logo',
      subtitle: 'tup-subtitle',
      toolbar: 'tup-toolbar',
      balance: 'tup-balance',
      balanceLabel: 'tup-balanceLabel',
      balanceValue: 'tup-balanceValue',
      balanceMuted: 'tup-balanceMuted',
      rangeBar: 'tup-rangeBar',
      ranges: 'tup-ranges',
      rangeInputs: 'tup-rangeInputs',
      rangeField: 'tup-rangeField',
      dateField: 'tup-dateField',
      dateButton: 'tup-dateButton',
      dateButtonOpen: 'tup-dateButtonOpen',
      datePlaceholder: 'tup-datePlaceholder',
      dateValue: 'tup-dateValue',
      calendar: 'tup-calendar',
      calendarRight: 'tup-calendarRight',
      calHead: 'tup-calHead',
      calTitle: 'tup-calTitle',
      calNav: 'tup-calNav',
      calWeek: 'tup-calWeek',
      calGrid: 'tup-calGrid',
      calDay: 'tup-calDay',
      calDayToday: 'tup-calDayToday',
      calDaySelected: 'tup-calDaySelected',
      calBlank: 'tup-calBlank',
      calFoot: 'tup-calFoot',
      calAction: 'tup-calAction',
      rangeClear: 'tup-rangeClear',
      rangeWarning: 'tup-rangeWarning',
      rangeChip: 'tup-rangeChip',
      rangeChipActive: 'tup-rangeChipActive',
      status: 'tup-status',
      button: 'tup-button',
      metrics: 'tup-metrics',
      card: 'tup-card',
      cardIcon: 'tup-cardIcon',
      cardLabel: 'tup-cardLabel',
      cardValue: 'tup-cardValue',
      cardHint: 'tup-cardHint',
      chips: 'tup-chips',
      chip: 'tup-chip',
      chipWarn: 'tup-chipWarn',
      chipOk: 'tup-chipOk',
      chipInfo: 'tup-chipInfo',
      toneCost: 'tup-toneCost',
      toneTokens: 'tup-toneTokens',
      toneTalks: 'tup-toneTalks',
      toneProjects: 'tup-toneProjects',
      section: 'tup-section',
      sectionHead: 'tup-sectionHead',
      sectionBar: 'tup-sectionBar',
      sectionNote: 'tup-sectionNote',
      split: 'tup-split',
      chartCard: 'tup-chartCard',
      chartNote: 'tup-chartNote',
      pager: 'tup-pager',
      pagerInfo: 'tup-pagerInfo',
      pagerActions: 'tup-pagerActions',
      pagerButton: 'tup-pagerButton',
      pagerSize: 'tup-pagerSize',
      pagerSelect: 'tup-pagerSelect',
      chartEmpty: 'tup-chartEmpty',
      pie: 'tup-pie',
      pieSlice: 'tup-pieSlice',
      pieSliceActive: 'tup-pieSliceActive',
      pieHoverLabel: 'tup-pieHoverLabel',
      pieWedge: 'tup-pieWedge',
      pieLeader: 'tup-pieLeader',
      pieLabelName: 'tup-pieLabelName',
      pieLabelMeta: 'tup-pieLabelMeta',
      slice0: 'tup-slice0',
      slice1: 'tup-slice1',
      slice2: 'tup-slice2',
      slice3: 'tup-slice3',
      slice4: 'tup-slice4',
      slice5: 'tup-slice5',
      sliceOther: 'tup-sliceOther',
      rows: 'tup-rows',
      row: 'tup-row',
      rank: 'tup-rank',
      rowMain: 'tup-rowMain',
      rowTitle: 'tup-rowTitle',
      rowMeta: 'tup-rowMeta',
      bar: 'tup-bar',
      barFill: 'tup-barFill',
      rowValue: 'tup-rowValue',
      tableWrap: 'tup-tableWrap',
      table: 'tup-table',
      num: 'tup-num',
      cost: 'tup-cost',
      time: 'tup-time',
      session: 'tup-session',
      sessionLine: 'tup-sessionLine',
      link: 'tup-link',
      linkStatic: 'tup-linkStatic',
      recordMeta: 'tup-recordMeta',
      sep: 'tup-sep',
      badge: 'tup-badge',
      badgeSub: 'tup-badgeSub',
      empty: 'tup-empty',
      emptyIcon: 'tup-emptyIcon',
      emptyTitle: 'tup-emptyTitle',
      emptyBody: 'tup-emptyBody',
      notice: 'tup-notice',
      footnote: 'tup-footnote',
    }

    // ---------------------------------------------------------------- sizes

    function asNumber(value, fallback) {
      return typeof value === 'number' && Number.isFinite(value) ? value : fallback === undefined ? 0 : fallback
    }

    function objectOf(value) {
      return value !== null && typeof value === 'object' ? value : undefined
    }

    /** The four billing buckets plus the prompt-side and grand totals. */
    function usageTotals(usage) {
      const source = objectOf(usage)
      if (source === undefined) return null
      const uncached = asNumber(source.uncachedInputTokens)
      const cacheRead = asNumber(source.cacheReadTokens)
      const cacheWrite = asNumber(source.cacheWriteTokens)
      const output = asNumber(source.outputTokens)
      const prompt = uncached + cacheRead + cacheWrite
      return { uncached, cacheRead, cacheWrite, output, prompt, total: prompt + output }
    }

    /** Trailing separators removed so two spellings of one directory agree. */
    function normalizedPath(path) {
      if (typeof path !== 'string' || path === '') return ''
      return path.replace(/[\\/]+$/, '')
    }

    function basename(path) {
      if (typeof path !== 'string' || path === '') return ''
      const trimmed = path.replace(/[\\/]+$/, '')
      const index = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
      return index === -1 ? trimmed : trimmed.slice(index + 1)
    }

    /** Workspace display name, matching the sidebar's own fallback chain. */
    function projectTitle(workspace, t) {
      const title = typeof workspace.title === 'string' ? workspace.title : ''
      if (title === 'default-workspace') return t('defaultWorkspace')
      if (title !== '') return title
      const base = basename(workspace.path)
      return base !== '' ? base : title
    }

    function projectOf(workspace, cwd, t) {
      if (workspace !== undefined) {
        const path = typeof workspace.path === 'string' ? workspace.path : ''
        return {
          id: typeof workspace.workspaceId === 'string' && workspace.workspaceId !== ''
            ? workspace.workspaceId
            : 'path:' + path,
          title: projectTitle(workspace, t),
          path,
        }
      }
      if (typeof cwd === 'string' && cwd !== '') {
        const base = basename(cwd)
        return { id: 'cwd:' + cwd, title: base !== '' ? base : cwd, path: cwd }
      }
      return { id: 'ungrouped', title: t('ungrouped'), path: '' }
    }

    /**
     * Fold the session catalog and the workspace catalog into the page model.
     * Pure: every number is derived from published projection values only.
     */
    /** Local midnight `daysAgo` days back; presets are calendar-day windows. */
    function dayStart(daysAgo) {
      const date = new Date()
      date.setHours(0, 0, 0, 0)
      date.setDate(date.getDate() - daysAgo)
      return date.getTime()
    }

    function withinRange(time, bounds) {
      if (bounds.from !== undefined && time < bounds.from) return false
      if (bounds.to !== undefined && time >= bounds.to) return false
      return true
    }

    /** `date` input value (YYYY-MM-DD) for a local instant. */
    function dateInputOf(ms) {
      const date = new Date(ms)
      const pad = (value) => String(value).padStart(2, '0')
      return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
    }

    /** Local midnight of a `date` input value; empty or malformed = unbounded. */
    function msOfDateInput(value) {
      if (typeof value !== 'string') return undefined
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
      if (match === null) return undefined
      const year = Number(match[1])
      const month = Number(match[2]) - 1
      const day = Number(match[3])
      const date = new Date(year, month, day, 0, 0, 0, 0)
      if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return undefined
      return date.getTime()
    }

    /** The instant just past the chosen end day, so 23:59:59 stays included. */
    function endOfDay(ms) {
      const date = new Date(ms)
      date.setDate(date.getDate() + 1)
      return date.getTime()
    }

    /**
     * Filter bounds from the two date pickers: the start day begins at
     * 00:00:00 and the end day runs through 23:59:59 (next midnight is
     * exclusive).
     */
    function boundsOfInputs(inputs) {
      const from = msOfDateInput(inputs.start)
      const endDay = msOfDateInput(inputs.end)
      return {
        id: from === undefined && endDay === undefined ? 'all' : 'custom',
        from,
        to: endDay === undefined ? undefined : endOfDay(endDay),
      }
    }

    function pad2(value) {
      return String(value).padStart(2, '0')
    }

    /** YYYY-MM-DD for a local calendar day. */
    function isoOf(year, month, day) {
      return year + '-' + pad2(month + 1) + '-' + pad2(day)
    }

    function todayIso() {
      return dateInputOf(dayStart(0))
    }

    /**
     * Monday-first month grid, padded with nulls so every month is six rows
     * tall (no popover height jump when paging).
     */
    function calendarCells(year, month) {
      const first = (new Date(year, month, 1).getDay() + 6) % 7
      const days = new Date(year, month + 1, 0).getDate()
      const cells = []
      for (let index = 0; index < first; index += 1) cells.push(null)
      for (let day = 1; day <= days; day += 1) cells.push(day)
      while (cells.length < 42) cells.push(null)
      return cells
    }

    /** The date values that describe one preset's calendar window. */
    function presetInputsOf(id) {
      const today = dayStart(0)
      switch (id) {
        case 'today':
          return { start: dateInputOf(today), end: dateInputOf(today) }
        case 'yesterday':
          return { start: dateInputOf(dayStart(1)), end: dateInputOf(dayStart(1)) }
        case 'beforeYesterday':
          return { start: dateInputOf(dayStart(2)), end: dateInputOf(dayStart(2)) }
        case 'last3':
          return { start: dateInputOf(dayStart(2)), end: dateInputOf(today) }
        case 'last7':
          return { start: dateInputOf(dayStart(6)), end: dateInputOf(today) }
        case 'last30':
          return { start: dateInputOf(dayStart(29)), end: dateInputOf(today) }
        default:
          return { start: '', end: '' }
      }
    }

    function cacheHitOf(prompt, cacheRead) {
      if (prompt <= 0) return null
      return cacheRead >= prompt ? 100 : Math.floor((cacheRead / prompt) * 1000) / 10
    }

    /**
     * Aggregate a window of turns: totals, per-project shares, and one row per
     * Session that produced turns inside the window.
     */
    function aggregateTurns(turns) {
      let cost = 0
      let peakCost = 0
      let idleCost = 0
      let tokens = 0
      let prompt = 0
      let cacheRead = 0
      let currency = '¥'
      const sessions = new Map()
      const projects = new Map()

      for (const turn of turns) {
        cost += turn.cost
        peakCost += turn.peakCost
        idleCost += turn.idleCost
        tokens += turn.tokens
        prompt += turn.tokensDetail.prompt
        cacheRead += turn.tokensDetail.cacheRead
        if (turn.currency !== '') currency = turn.currency

        let session = sessions.get(turn.sessionId)
        if (session === undefined) {
          session = {
            id: turn.sessionId,
            title: turn.title,
            project: turn.project,
            updatedAt: turn.time,
            tokens: 0,
            cost: 0,
            currency: turn.currency,
            subagent: turn.subagent,
            models: new Set(),
          }
          sessions.set(turn.sessionId, session)
        }
        session.cost += turn.cost
        session.tokens += turn.tokens
        session.updatedAt = Math.max(session.updatedAt, turn.time)
        for (const model of turn.models) session.models.add(model)

        let project = projects.get(turn.project.id)
        if (project === undefined) {
          project = {
            id: turn.project.id,
            title: turn.project.title,
            path: turn.project.path,
            cost: 0,
            tokens: 0,
            sessions: new Set(),
            models: new Map(),
          }
          projects.set(turn.project.id, project)
        }
        project.cost += turn.cost
        project.tokens += turn.tokens
        project.sessions.add(turn.sessionId)
        for (const model of turn.models) {
          project.models.set(model, (project.models.get(model) ?? 0) + 1)
        }
      }

      const topSessions = [...sessions.values()]
        .map((session) => ({ ...session, models: [...session.models], priced: true }))
        .sort(
          (left, right) =>
            right.cost - left.cost || right.tokens - left.tokens || right.updatedAt - left.updatedAt,
        )
        .slice(0, 5)

      const projectsList = [...projects.values()]
        .map((project) => ({
          ...project,
          sessions: project.sessions.size,
          modelList: [...project.models.entries()]
            .sort((left, right) => right[1] - left[1])
            .map(([model]) => model),
        }))
        .sort((left, right) => right.cost - left.cost || right.tokens - left.tokens)

      return {
        projects: projectsList,
        topSessions,
        totals: {
          cost,
          peakCost,
          idleCost,
          tokens,
          prompt,
          cacheRead,
          cacheHit: cacheHitOf(prompt, cacheRead),
          conversations: sessions.size,
          projects: projectsList.length,
          subagents: [...sessions.values()].filter((session) => session.subagent === true).length,
          pricedCount: sessions.size,
          unpricedCount: 0,
          pricedSessions: sessions.size,
          currency,
        },
      }
    }

    function buildModel(sessions, workspaces, t, bounds) {
      const workspaceSnapshot = objectOf(workspaces) ?? {}
      const items = Array.isArray(workspaceSnapshot.items) ? workspaceSnapshot.items : []
      const workspaceBySession = new Map()
      const workspaceByPath = new Map()
      for (const workspace of items) {
        const entry = objectOf(workspace)
        if (entry === undefined) continue
        const owners = Array.isArray(entry.sessionIds) ? entry.sessionIds : []
        for (const id of owners) if (!workspaceBySession.has(id)) workspaceBySession.set(id, entry)
        const path = normalizedPath(entry.path)
        if (path !== '' && !workspaceByPath.has(path)) workspaceByPath.set(path, entry)
      }

      const sessionSnapshot = objectOf(sessions) ?? {}
      const byId = objectOf(sessionSnapshot.byId) ?? {}
      const ids = Array.isArray(sessionSnapshot.ids) ? sessionSnapshot.ids : []
      const records = []
      const turnRecords = []
      for (const id of ids) {
        const row = objectOf(byId[id])
        if (row === undefined) continue
        const values = objectOf(row.projectionValues) ?? {}
        // The panel's own Host half publishes one ledger per Session: totals and
        // the per-turn records. No other plugin's projection is consulted.
        const ledger = objectOf(values.tokenLedger)
        const usage = usageTotals(ledger === undefined ? undefined : ledger.tokens)
        const priced = ledger !== undefined
        const cost = priced ? Math.max(0, asNumber(ledger.cost)) : 0
        const tokens = usage === null ? 0 : usage.total

        // A Session can run in a Workspace directory without being attached to
        // that Workspace (delegated child Sessions are the common case). The
        // directory is the same project, so resolve it by exact canonical path
        // before falling back to a directory-only group.
        const workspace = workspaceBySession.get(id) ?? workspaceByPath.get(normalizedPath(row.cwd))
        const project = projectOf(workspace, row.cwd, t)
        const models = priced && Array.isArray(ledger.models)
          ? ledger.models
              .filter((entry) => objectOf(entry) !== undefined && typeof entry.model === 'string')
              .slice(0, 4)
          : []
        const title = typeof row.displayTitle === 'string' && row.displayTitle !== ''
          ? row.displayTitle
          : typeof row.title === 'string' && row.title !== ''
            ? row.title
            : id
        const currency = priced && typeof ledger.currency === 'string' && ledger.currency !== ''
          ? ledger.currency
          : '¥'

        // The per-turn ledger drives every time-ranged view; a session the
        // catalog has not projected yet contributes session-level numbers only
        // until the fill pass lands.
        const turns = priced && Array.isArray(ledger.turns) ? ledger.turns : []
        for (const entry of turns) {
          const turnUsage = usageTotals(objectOf(entry) === undefined ? undefined : entry.tokens)
          if (turnUsage === null || turnUsage.total <= 0) continue
          turnRecords.push({
            key: id + '#' + String(entry.turn),
            sessionId: id,
            title,
            project,
            turn: asNumber(entry.turn),
            time: asNumber(entry.time),
            tokens: turnUsage.total,
            tokensDetail: turnUsage,
            cost: Math.max(0, asNumber(entry.cost)),
            peakCost: Math.max(0, asNumber(entry.peakCost)),
            idleCost: Math.max(0, asNumber(entry.idleCost)),
            currency,
            models: Array.isArray(entry.models)
              ? entry.models.filter((model) => typeof model === 'string')
              : [],
            subagent: row.origin === 'subagent',
          })
        }

        if (tokens === 0 && cost === 0 && turns.length === 0) continue
        records.push({
          id,
          title,
          updatedAt: asNumber(row.updatedAt),
          tokens,
          usage,
          cost,
          priced,
          peakCost: priced ? asNumber(ledger.peakCost) : 0,
          idleCost: priced ? asNumber(ledger.idleCost) : 0,
          currency,
          unpriced: priced && ledger.unpriced === true,
          models,
          subagent: row.origin === 'subagent',
          project,
          hasTurns: turns.length > 0,
        })
      }

      let cost = 0
      let peakCost = 0
      let idleCost = 0
      let tokens = 0
      let prompt = 0
      let cacheRead = 0
      let pricedCount = 0
      let unpricedCount = 0
      let subagents = 0
      for (const record of records) {
        tokens += record.tokens
        if (record.usage !== null) {
          prompt += record.usage.prompt
          cacheRead += record.usage.cacheRead
        }
        if (record.priced) {
          cost += record.cost
          peakCost += record.peakCost
          idleCost += record.idleCost
          pricedCount += 1
        } else {
          unpricedCount += 1
        }
        if (record.subagent) subagents += 1
      }

      const projectMap = new Map()
      for (const record of records) {
        const key = record.project.id
        let entry = projectMap.get(key)
        if (entry === undefined) {
          entry = {
            id: key,
            title: record.project.title,
            path: record.project.path,
            cost: 0,
            tokens: 0,
            sessions: 0,
            models: new Map(),
          }
          projectMap.set(key, entry)
        }
        entry.cost += record.priced ? record.cost : 0
        entry.tokens += record.tokens
        entry.sessions += 1
        for (const model of record.models) {
          entry.models.set(model.model, (entry.models.get(model.model) ?? 0) + asNumber(model.cost))
        }
      }
      const projects = [...projectMap.values()]
        .map((entry) => ({
          ...entry,
          modelList: [...entry.models.entries()]
            .sort((left, right) => right[1] - left[1])
            .map(([model]) => model),
        }))
        .sort((left, right) => right.cost - left.cost || right.tokens - left.tokens)

      const allTurns = turnRecords
        .slice()
        .sort((left, right) => right.time - left.time || right.turn - left.turn)
      const ranged = bounds.id !== 'all'
      const scopedTurns = ranged ? allTurns.filter((turn) => withinRange(turn.time, bounds)) : allTurns
      const aggregates = ranged ? aggregateTurns(scopedTurns) : null

      const totals = ranged
        ? aggregates.totals
        : {
            cost,
            peakCost,
            idleCost,
            tokens,
            prompt,
            cacheRead,
            cacheHit: cacheHitOf(prompt, cacheRead),
            conversations: records.length,
            projects: projects.length,
            subagents,
            pricedCount,
            unpricedCount,
            pricedSessions: records.filter((record) => record.priced).length,
            currency: records.find((record) => record.priced)?.currency ?? '¥',
          }
      totals.turnCount = scopedTurns.length
      totals.turnlessCount = records.filter((record) => record.hasTurns === false).length

      return {
        ranged,
        turns: scopedTurns,
        projects: ranged ? aggregates.projects : projects,
        topSessions: ranged
          ? aggregates.topSessions
          : records
              .slice()
              .sort(
                (left, right) =>
                  right.cost - left.cost || right.tokens - left.tokens || right.updatedAt - left.updatedAt,
              )
              .slice(0, 5),
        totals,
      }
    }

    // ------------------------------------------------------------- formatting

    function grouped(value, separator) {
      const digits = String(Math.max(0, Math.round(value)))
      const groups = []
      for (let end = digits.length; end > 0; end -= 3) {
        groups.unshift(digits.slice(Math.max(0, end - 3), end))
      }
      return groups.join(separator)
    }

    function exactTokens(value, t) {
      return h(
        'span',
        { title: t('tokens', { count: grouped(value, t('groupSeparator')) }) },
        grouped(value, t('groupSeparator')),
      )
    }

    function compactTokens(value, t) {
      const scaled = (candidate) =>
        candidate >= 100 ? String(Math.round(candidate)) : String(Math.round(candidate * 10) / 10)
      if (value < 1e3) return String(Math.round(value))
      if (value < 1e6) return t('thousand', { value: scaled(value / 1e3) })
      return t('million', { value: scaled(value / 1e6) })
    }

    function money(currency, value) {
      const abs = Math.abs(value)
      const digits = abs > 0 && abs < 0.01 ? 4 : abs < 1 ? 3 : 2
      return currency + value.toFixed(digits)
    }

    function formatTime(ms) {
      if (!Number.isFinite(ms) || ms <= 0) return '—'
      const date = new Date(ms)
      const pad = (value) => String(value).padStart(2, '0')
      const now = new Date()
      const sameYear = date.getFullYear() === now.getFullYear()
      const day = pad(date.getMonth() + 1) + '-' + pad(date.getDate())
      const time = pad(date.getHours()) + ':' + pad(date.getMinutes())
      return sameYear ? day + ' ' + time : date.getFullYear() + '-' + day + ' ' + time
    }

    // ---------------------------------------------------------------- icons

    function ChartGlyph({ size }) {
      const edge = typeof size === 'number' && size > 0 ? size : 16
      return h(
        'svg',
        {
          width: edge,
          height: edge,
          viewBox: '0 0 16 16',
          fill: 'none',
          'aria-hidden': 'true',
          focusable: 'false',
          style: { display: 'block' },
        },
        h('path', {
          d: 'M2.4 13.2h11.2',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
          opacity: 0.55,
        }),
        h('path', { d: 'M4.3 10.9V7.3', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }),
        h('path', { d: 'M8 10.9V4.4', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }),
        h('path', { d: 'M11.7 10.9V8.4', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }),
      )
    }

    function CoinIcon() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true', focusable: 'false' },
        h('circle', { cx: 8, cy: 8, r: 5.9, stroke: 'currentColor', strokeWidth: 1.3 }),
        h('path', { d: 'M6.1 5.4 8 8.2l1.9-2.8M8 8.2V11', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      )
    }

    function ChevronIcon({ direction }) {
      return h(
        'svg',
        { viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true', focusable: 'false' },
        h('path', {
          d: direction === 'left' ? 'M9.8 3.6 5.4 8l4.4 4.4' : 'M6.2 3.6 10.6 8l-4.4 4.4',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )
    }

    function RefreshIcon() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true', focusable: 'false' },
        h('path', {
          d: 'M13 8a5 5 0 1 1-1.6-3.67',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
        }),
        h('path', {
          d: 'M13.1 2.6v3.1H10',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )
    }

    function SpendingIcon() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true', focusable: 'false' },
        h('rect', {
          x: 1.9,
          y: 3.4,
          width: 12.2,
          height: 9.2,
          rx: 2,
          stroke: 'currentColor',
          strokeWidth: 1.2,
        }),
        h('path', { d: 'M1.9 6.6h12.2', stroke: 'currentColor', strokeWidth: 1.2 }),
        h('path', { d: 'M4.6 9.9h2.3', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }),
      )
    }

    function TokenIcon() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true', focusable: 'false' },
        h('ellipse', { cx: 8, cy: 4.2, rx: 4.9, ry: 1.9, stroke: 'currentColor', strokeWidth: 1.2 }),
        h('path', {
          d: 'M3.1 4.2v7.5c0 1.05 2.2 1.9 4.9 1.9s4.9-.85 4.9-1.9V4.2',
          stroke: 'currentColor',
          strokeWidth: 1.2,
        }),
        h('path', { d: 'M3.1 8c0 1.05 2.2 1.9 4.9 1.9S12.9 9.05 12.9 8', stroke: 'currentColor', strokeWidth: 1.2 }),
      )
    }

    function ChatIcon() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true', focusable: 'false' },
        h('path', {
          d: 'M2.6 4.9a2 2 0 0 1 2-2h6.8a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H7.1L3.9 13.2V10.9a2 2 0 0 1-1.3-1.9Z',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinejoin: 'round',
        }),
        h('path', { d: 'M5.4 6.4h5.2M5.4 8.5h3.2', stroke: 'currentColor', strokeWidth: 1.1, strokeLinecap: 'round' }),
      )
    }

    function FolderIcon() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true', focusable: 'false' },
        h('path', {
          d: 'M2.4 5.2a1.6 1.6 0 0 1 1.6-1.6h2l1.5 1.6h4.5a1.6 1.6 0 0 1 1.6 1.6v4.4a1.6 1.6 0 0 1-1.6 1.6H4a1.6 1.6 0 0 1-1.6-1.6Z',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinejoin: 'round',
        }),
      )
    }

    function EmptyGlyph() {
      return h(
        'svg',
        {
          width: 40,
          height: 40,
          viewBox: '0 0 40 40',
          fill: 'none',
          className: styles.emptyIcon,
          'aria-hidden': 'true',
          focusable: 'false',
        },
        h('rect', {
          x: 6.5,
          y: 8.5,
          width: 27,
          height: 24,
          rx: 5,
          stroke: 'currentColor',
          strokeWidth: 1.6,
        }),
        h('path', { d: 'M12.5 26.5V20', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
        h('path', { d: 'M20 26.5V15.5', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
        h('path', { d: 'M27.5 26.5V22', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
      )
    }

    function NoticeIcon() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true', focusable: 'false' },
        h('circle', { cx: 8, cy: 8, r: 6.2, stroke: 'currentColor', strokeWidth: 1.3 }),
        h('path', { d: 'M8 4.9v3.6', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }),
        h('path', { d: 'M8 11.2v.1', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }),
      )
    }

    // ----------------------------------------------------------- components

    function MetricCard({ tone, icon, label, value, hint, hintTitle }) {
      return h(
        'div',
        { className: styles.card + (tone === undefined ? '' : ' ' + tone) },
        h('p', { className: styles.cardLabel }, h('span', { className: styles.cardIcon }, icon), label),
        h('p', { className: styles.cardValue }, value),
        h('p', { className: styles.cardHint, title: hintTitle === undefined ? undefined : hintTitle }, hint),
      )
    }

    function RankRow({ index, title, meta, value, subvalue, ratio }) {
      const width = Math.max(2, Math.min(100, Math.round(ratio * 100)))
      return h(
        'li',
        { className: styles.row, 'data-rank': index + 1 },
        h('span', { className: styles.rank, 'aria-hidden': 'true' }, '#' + String(index + 1)),
        h(
          'div',
          { className: styles.rowMain },
          h('span', { className: styles.rowTitle, title }, title),
          ratio > 0
            ? h(
                'span',
                { className: styles.bar, 'aria-hidden': 'true' },
                h('span', { className: styles.barFill, style: { width: width + '%' } }),
              )
            : null,
          h('span', { className: styles.rowMeta }, meta),
        ),
        h('span', { className: styles.rowValue }, value, subvalue === null ? null : h('small', null, subvalue)),
      )
    }

    /**
     * One Turn of one conversation: the session title plus that Turn's tokens
     * and cost. Rows repeat the session so the list can stay time-ordered.
     */
    function TurnRow({ record, t, openSession }) {
      const canOpen = typeof openSession === 'function'
      const title = record.title
      const modelNames = record.models.join(' + ')
      return h(
        'tr',
        null,
        h('td', { className: styles.time }, formatTime(record.time)),
        h(
          'td',
          { className: styles.session },
          h(
            'div',
            { className: styles.sessionLine },
            canOpen
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: styles.link,
                    title: t('openSession', { title }),
                    onClick: () => openSession(record.sessionId),
                  },
                  title,
                )
              : h('span', { className: styles.linkStatic, title }, title),
            h('span', { className: styles.badge }, t('record.turn', { turn: record.turn })),
            record.subagent
              ? h('span', { className: styles.badge + ' ' + styles.badgeSub }, t('badge.subagent'))
              : null,
          ),
          h(
            'div',
            { className: styles.recordMeta },
            h('span', null, record.project.title),
            modelNames === ''
              ? null
              : [
                  h('span', { key: 'sep', className: styles.sep, 'aria-hidden': 'true' }, '·'),
                  h('span', { key: 'models' }, modelNames),
                ],
          ),
        ),
        h('td', { className: styles.num }, exactTokens(record.tokens, t)),
        h('td', { className: styles.num + ' ' + styles.cost }, money(record.currency, record.cost)),
      )
    }

    const PIE_SLICE_CLASSES = [
      styles.slice0,
      styles.slice1,
      styles.slice2,
      styles.slice3,
      styles.slice4,
      styles.slice5,
    ]

    /** Rough display width of one character in the 11px label: CJK ~1 unit. */
    function labelUnits(character) {
      return /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]/.test(character) ? 1 : 0.52
    }

    /**
     * Truncate a project name to the label column's width instead of a fixed
     * code-point count, so a Latin name like "video-platform" survives while a
     * long CJK name still fits without clipping at the chart edge.
     */
    function truncateLabel(text, maxUnits) {
      let used = 0
      let result = ''
      for (const character of Array.from(text)) {
        const cost = labelUnits(character)
        if (used + cost > maxUnits) return result + '…'
        used += cost
        result += character
      }
      return result
    }

    /**
     * Project shares for the pie: a project above 5% of the priced cost keeps
     * its own named slice, everything at or below 5% merges into Other.
     * @param projects - priced project groups, cost-descending.
     * @returns the slice list for the chart.
     */
    function buildProjectSlices(projects, t) {
      const priced = projects.filter((project) => project.cost > 0)
      const total = priced.reduce((sum, project) => sum + project.cost, 0)
      if (total <= 0) return { slices: [], total: 0 }
      const named = []
      const rest = []
      for (const project of priced) {
        const share = project.cost / total
        if (share > 0.05) named.push({ key: project.id, title: project.title, cost: project.cost, share })
        else rest.push(project)
      }
      // A lone 100% Other disc says nothing, so the largest project keeps its
      // name when no project clears the threshold on its own.
      if (named.length === 0) {
        const first = priced[0]
        named.push({ key: first.id, title: first.title, cost: first.cost, share: first.cost / total })
        rest.splice(0, rest.length, ...priced.slice(1))
      }
      const restCost = rest.reduce((sum, project) => sum + project.cost, 0)
      if (restCost > 0) {
        named.push({
          key: 'other',
          title: t('chart.other'),
          cost: restCost,
          share: restCost / total,
          other: true,
          members: rest.map((project) => project.title),
        })
      }
      return { slices: named, total }
    }

    /**
     * Pie of project cost shares. Slices are unlabeled at rest; hovering one
     * pops it outward on a springy curve and reveals its name and share in a
     * leader-line label. Only one label exists at a time, so labels never
     * collide no matter how many projects the pie divides.
     */
    function CostPie({ slices, currency, t }) {
      const width = 440
      const height = 260
      const cx = width / 2
      const cy = height / 2
      const radius = 84
      const [hovered, setHovered] = React.useState(null)

      let angle = -Math.PI / 2
      const wedges = slices.map((slice, index) => {
        const sweep = slice.share * Math.PI * 2
        const wedge = {
          ...slice,
          start: angle,
          end: angle + sweep,
          mid: angle + sweep / 2,
          className:
            slice.other === true
              ? styles.sliceOther
              : PIE_SLICE_CLASSES[index % PIE_SLICE_CLASSES.length],
        }
        angle += sweep
        return wedge
      })

      const point = (radians, distance) => [
        cx + Math.cos(radians) * distance,
        cy + Math.sin(radians) * distance,
      ]

      const wedgePath = (wedge) => {
        const [x1, y1] = point(wedge.start, radius)
        const [x2, y2] = point(wedge.end, radius)
        const large = wedge.end - wedge.start > Math.PI ? 1 : 0
        return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`
      }

      const detailOf = (wedge) =>
        `${Math.round(wedge.share * 1000) / 10}% · ${money(currency, wedge.cost)}`
      const titleOf = (wedge) =>
        wedge.other === true && Array.isArray(wedge.members)
          ? `${wedge.members.join(' · ')} · ${detailOf(wedge)}`
          : `${wedge.title} · ${detailOf(wedge)}`

      const sliceClassOf = (wedge) =>
        [styles.pieSlice, wedge.className, hovered === wedge.key ? styles.pieSliceActive : null]
          .filter((name) => name !== null)
          .join(' ')

      const sliceEvents = (wedge) => ({
        onMouseEnter: () => setHovered(wedge.key),
        onMouseLeave: () => setHovered((current) => (current === wedge.key ? null : current)),
      })

      const active = wedges.find((wedge) => wedge.key === hovered) ?? null
      let hoverLabel = null
      if (active !== null) {
        const side = Math.cos(active.mid) >= 0 ? 1 : -1
        const x = side > 0 ? cx + radius + 16 : cx - radius - 16
        const y = Math.max(18, Math.min(height - 18, cy + Math.sin(active.mid) * radius * 0.92))
        const [px, py] = point(active.mid, radius + 10)
        const ex = side > 0 ? x - 4 : x + 4
        hoverLabel = h(
          'g',
          { key: 'hover-label', className: styles.pieHoverLabel + ' ' + active.className },
          h('polyline', {
            points: `${px},${py} ${ex},${y}`,
            className: styles.pieLeader,
            stroke: 'currentColor',
          }),
          h(
            'text',
            { x, y, textAnchor: side > 0 ? 'start' : 'end' },
            h(
              'tspan',
              { x, dy: '-0.35em', className: styles.pieLabelName },
              truncateLabel(active.title, 10.6),
            ),
            h(
              'tspan',
              { x, dy: '1.15em', className: styles.pieLabelMeta },
              detailOf(active),
            ),
          ),
        )
      }

      return h(
        'svg',
        {
          viewBox: `0 0 ${width} ${height}`,
          className: styles.pie,
          role: 'img',
          'aria-label': t('chart.label'),
        },
        h('title', null, t('chart.label')),
        wedges.length === 1
          ? h(
              'g',
              {
                className: sliceClassOf(wedges[0]),
                onMouseEnter: () => setHovered(wedges[0].key),
                onMouseLeave: () => setHovered(null),
              },
              h('title', null, titleOf(wedges[0])),
              h('circle', { cx, cy, r: radius, fill: 'currentColor' }),
            )
          : wedges.map((wedge) =>
              h(
                'g',
                {
                  key: 'wedge-' + wedge.key,
                  className: sliceClassOf(wedge),
                  ...sliceEvents(wedge),
                },
                h('title', null, titleOf(wedge)),
                h('path', { d: wedgePath(wedge), fill: 'currentColor', className: styles.pieWedge }),
              ),
            ),
        hoverLabel,
      )
    }

    /**
     * Chinese calendar field: a trigger showing the chosen day in `YYYY年M月D日`
     * form plus a month grid. The native `input[type=date]` follows the app's
     * form-control locale, which is English here, so the panel owns the widget.
     */
    function DateField({ label, value, align, t, onChange }) {
      const [open, setOpen] = React.useState(false)
      const [viewYear, setViewYear] = React.useState(() => {
        const parsed = msOfDateInput(value)
        return parsed === undefined ? new Date().getFullYear() : new Date(parsed).getFullYear()
      })
      const [viewMonth, setViewMonth] = React.useState(() => {
        const parsed = msOfDateInput(value)
        return parsed === undefined ? new Date().getMonth() : new Date(parsed).getMonth()
      })
      const rootRef = React.useRef(null)

      React.useEffect(() => {
        if (!open) return undefined
        const onPointerDown = (event) => {
          const target = event.target
          if (target instanceof Node && rootRef.current !== null && rootRef.current.contains(target)) return
          setOpen(false)
        }
        const onKeyDown = (event) => {
          if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('pointerdown', onPointerDown)
        document.addEventListener('keydown', onKeyDown)
        return () => {
          document.removeEventListener('pointerdown', onPointerDown)
          document.removeEventListener('keydown', onKeyDown)
        }
      }, [open])

      const parsed = msOfDateInput(value)
      const chosen = parsed === undefined ? null : new Date(parsed)
      const shown =
        chosen === null
          ? t('range.pickDate')
          : t('cal.date', {
              year: chosen.getFullYear(),
              month: pad2(chosen.getMonth() + 1),
              day: pad2(chosen.getDate()),
            })

      const openPicker = () => {
        const base = parsed === undefined ? new Date() : new Date(parsed)
        setViewYear(base.getFullYear())
        setViewMonth(base.getMonth())
        setOpen(true)
      }
      const stepMonth = (delta) => {
        const next = new Date(viewYear, viewMonth + delta, 1)
        setViewYear(next.getFullYear())
        setViewMonth(next.getMonth())
      }
      const choose = (day) => {
        onChange(isoOf(viewYear, viewMonth, day))
        setOpen(false)
      }
      const selectedIso = value
      const today = todayIso()

      return h(
        'div',
        { className: styles.dateField, ref: rootRef },
        h(
          'button',
          {
            type: 'button',
            className: styles.dateButton + (open ? ' ' + styles.dateButtonOpen : ''),
            'aria-haspopup': 'dialog',
            'aria-expanded': open,
            'aria-label': label,
            onClick: () => {
              if (open) setOpen(false)
              else openPicker()
            },
          },
          h('span', { className: chosen === null ? styles.datePlaceholder : styles.dateValue }, shown),
          h(
            'svg',
            { viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true', focusable: 'false' },
            h('rect', { x: 2.4, y: 3.4, width: 11.2, height: 10.2, rx: 2, stroke: 'currentColor', strokeWidth: 1.2 }),
            h('path', { d: 'M2.4 6.6h11.2M5.6 2.4v2M10.4 2.4v2', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }),
          ),
        ),
        open
          ? h(
              'div',
              {
                className: styles.calendar + (align === 'right' ? ' ' + styles.calendarRight : ''),
                role: 'dialog',
                'aria-label': label,
              },
              h(
                'div',
                { className: styles.calHead },
                h('button', { type: 'button', className: styles.calNav, 'aria-label': t('cal.prevYear'), onClick: () => setViewYear(viewYear - 1) }, '«'),
                h('button', { type: 'button', className: styles.calNav, 'aria-label': t('cal.prevMonth'), onClick: () => stepMonth(-1) }, '‹'),
                h('span', { className: styles.calTitle }, t('cal.monthTitle', { year: viewYear, month: viewMonth + 1 })),
                h('button', { type: 'button', className: styles.calNav, 'aria-label': t('cal.nextMonth'), onClick: () => stepMonth(1) }, '›'),
                h('button', { type: 'button', className: styles.calNav, 'aria-label': t('cal.nextYear'), onClick: () => setViewYear(viewYear + 1) }, '»'),
              ),
              h(
                'div',
                { className: styles.calWeek },
                t('cal.weekdays').split(',').map((name, index) => h('span', { key: index }, name)),
              ),
              h(
                'div',
                { className: styles.calGrid },
                calendarCells(viewYear, viewMonth).map((day, index) => {
                  if (day === null) return h('span', { key: 'blank-' + index, className: styles.calBlank })
                  const iso = isoOf(viewYear, viewMonth, day)
                  return h(
                    'button',
                    {
                      key: iso,
                      type: 'button',
                      className:
                        styles.calDay +
                        (iso === selectedIso ? ' ' + styles.calDaySelected : '') +
                        (iso === today ? ' ' + styles.calDayToday : ''),
                      onClick: () => choose(day),
                    },
                    String(day),
                  )
                }),
              ),
              h(
                'div',
                { className: styles.calFoot },
                h(
                  'button',
                  {
                    type: 'button',
                    className: styles.calAction,
                    onClick: () => {
                      onChange(today)
                      setOpen(false)
                    },
                  },
                  t('range.today'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: styles.calAction,
                    onClick: () => {
                      onChange('')
                      setOpen(false)
                    },
                  },
                  t('range.clear'),
                ),
              ),
            )
          : null,
      )
    }

    /** Account balance pill; clicking it re-reads the balance Remote. */
    function BalancePill({ balance, refreshing, t, onRefresh }) {
      const ready = balance.status === 'ready'
      const text = ready && balance.wallets.length > 0
        ? balance.wallets
            .map((wallet) => (wallet.currency === 'CNY' ? '¥' : '$') + String(wallet.balance))
            .join(' · ')
        : balance.status === 'loading'
          ? t('balance.loading')
          : balance.status === 'signedOut'
            ? t('balance.signedOut')
            : t('balance.failed')
      const bonus = ready
        ? balance.bonusWallets
            .filter((wallet) => Number(wallet.balance) > 0)
            .map((wallet) => (wallet.currency === 'CNY' ? '¥' : '$') + String(wallet.balance))
        : []
      const hint = [
        bonus.length > 0 ? t('balance.bonus', { amount: bonus.join(' · ') }) : null,
        balance.detail !== '' && balance.status !== 'ready' && balance.status !== 'signedOut'
          ? balance.detail
          : null,
        balance.updatedAt > 0 ? t('balance.updated', { time: formatTime(balance.updatedAt) }) : null,
        refreshing ? t('balance.refreshing') : t('balance.refresh'),
      ]
        .filter((part) => part !== null)
        .join(' · ')
      return h(
        'button',
        {
          type: 'button',
          className: styles.balance,
          onClick: onRefresh,
          title: hint,
          'aria-label': t('balance.aria'),
        },
        h(CoinIcon),
        h('span', { className: styles.balanceLabel }, t('balance.label')),
        h(
          'span',
          { className: styles.balanceValue + (ready && balance.wallets.length > 0 ? '' : ' ' + styles.balanceMuted) },
          text,
        ),
      )
    }

    /** Previous/next paging for the turn table, plus its page-size choice. */
    function Pager({ page, pageCount, from, to, count, pageSize, pageSizes, t, onChange, onSizeChange }) {
      return h(
        'div',
        { className: styles.pager },
        h('span', { className: styles.pagerInfo }, t('pager.summary', { page, pages: pageCount, from, to, count })),
        h(
          'div',
          { className: styles.pagerActions },
          h(
            'label',
            { className: styles.pagerSize },
            h('span', null, t('pager.size')),
            h(
              'select',
              {
                className: styles.pagerSelect,
                value: String(pageSize),
                'aria-label': t('pager.sizeAria'),
                onChange: (event) => onSizeChange(Number(event.target.value)),
              },
              pageSizes.map((size) => h('option', { key: size, value: String(size) }, String(size))),
            ),
            h('span', null, t('pager.unit')),
          ),
          h(
            'button',
            {
              type: 'button',
              className: styles.pagerButton,
              onClick: () => onChange(page - 1),
              disabled: page <= 1,
              'aria-label': t('pager.prev'),
            },
            h(ChevronIcon, { direction: 'left' }),
            t('pager.prev'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: styles.pagerButton,
              onClick: () => onChange(page + 1),
              disabled: page >= pageCount,
              'aria-label': t('pager.next'),
            },
            t('pager.next'),
            h(ChevronIcon, { direction: 'right' }),
          ),
        ),
      )
    }

    function SectionHeading({ title, note }) {
      return h(
        'div',
        { className: styles.sectionHead },
        h('h2', null, h('span', { className: styles.sectionBar, 'aria-hidden': 'true' }), title),
        note === null ? null : h('span', { className: styles.sectionNote }, note),
      )
    }

    const EMPTY_SESSIONS = { ids: [], byId: {}, phase: 'ready', projectionsBySession: {} }
    const EMPTY_WORKSPACES = { items: [], phase: 'ready', state: 'ready', archivedSessionIds: [] }
    const SELECT_ALL = (snapshot) => snapshot
    const USE_EMPTY_SESSIONS = () => EMPTY_SESSIONS
    const USE_EMPTY_WORKSPACES = () => EMPTY_WORKSPACES

    function fallbackTranslate(dictionary) {
      return (key, params) => {
        const template = typeof dictionary[key] === 'string' ? dictionary[key] : key
        if (params === undefined || params === null) return template
        return template.replace(/\{(\w+)\}/g, (match, name) =>
          Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
        )
      }
    }

    /**
     * The panel: totals, project Top 3, conversation Top 5, and the record list.
     *
     * Data arrives through the `useSessions` / `useWorkspaces` slot props, so
     * this component subscribes to exactly the catalogs it needs; the fill pass
     * only asks the session service for projections the catalogs lack.
     */
    function UsagePanel(props) {
      const t = typeof props.t === 'function' ? props.t : fallbackTranslate(ZH)
      const useSessions = typeof props.useSessions === 'function' ? props.useSessions : USE_EMPTY_SESSIONS
      const useWorkspaces = typeof props.useWorkspaces === 'function' ? props.useWorkspaces : USE_EMPTY_WORKSPACES
      const refreshProjections = typeof props.refreshProjections === 'function' ? props.refreshProjections : undefined
      const fetchBalance = typeof props.fetchBalance === 'function' ? props.fetchBalance : undefined
      const openSession = typeof props.openSession === 'function' ? props.openSession : undefined

      const sessions = useSessions(SELECT_ALL) ?? EMPTY_SESSIONS
      const workspaces = useWorkspaces(SELECT_ALL) ?? EMPTY_WORKSPACES
      const [range, setRange] = React.useState('all')
      const [rangeInputs, setRangeInputs] = React.useState({ start: '', end: '' })
      const rangeBounds = boundsOfInputs(rangeInputs)
      const rangeInvalid =
        rangeBounds.from !== undefined && rangeBounds.to !== undefined && rangeBounds.from >= rangeBounds.to
      const model = buildModel(sessions, workspaces, t, rangeBounds)
      const totals = model.totals

      const mountedRef = React.useRef(true)
      const attemptedRef = React.useRef(new Set())
      const pendingRef = React.useRef(0)
      const [pending, setPending] = React.useState(0)
      const [pass, setPass] = React.useState(0)
      const [page, setPage] = React.useState(1)
      const [pageSize, setPageSize] = React.useState(DEFAULT_TURN_PAGE_SIZE)
      const [stalled, setStalled] = React.useState(false)
      const [balance, setBalance] = React.useState({
        status: fetchBalance === undefined ? 'unavailable' : 'loading',
        wallets: [],
        bonusWallets: [],
        updatedAt: 0,
        detail: '',
      })
      const [balanceNonce, setBalanceNonce] = React.useState(0)
      const [balanceRefreshing, setBalanceRefreshing] = React.useState(false)

      React.useEffect(
        () => () => {
          mountedRef.current = false
        },
        [],
      )

      // Fill the projections the session catalog does not carry yet. Each id is
      // attempted once per mount (or per manual refresh); the service is
      // single-flight and caches the exact read on the Host once it lands.
      // The balance is account-level, not session-scoped, so it is read once on
      // mount and again on demand; a ready value survives a failed refresh.
      React.useEffect(() => {
        if (fetchBalance === undefined) return undefined
        let alive = true
        setBalanceRefreshing(true)
        let request
        try {
          request = Promise.resolve(fetchBalance())
        } catch (error) {
          request = Promise.reject(error)
        }
        request
          .then((result) => {
            if (!alive) return
            const value = result !== undefined && result.ok === true ? result.value : undefined
            if (value === undefined || value === null) {
              const detail =
                value === null
                  ? ''
                  : result !== undefined && result.ok === false
                    ? String(result.error?.code ?? result.error?.message ?? 'remote error')
                    : ''
              setBalance({
                status: value === null ? 'signedOut' : 'failed',
                wallets: [],
                bonusWallets: [],
                updatedAt: Date.now(),
                detail,
              })
              if (value !== null) console.warn('[token-usage-panel] balance read failed', detail)
              return
            }
            if (value.status === 'ready') {
              setBalance({
                status: 'ready',
                wallets: Array.isArray(value.value) ? value.value : [],
                bonusWallets: Array.isArray(value.bonusWallets) ? value.bonusWallets : [],
                updatedAt: Date.now(),
              })
            } else {
              setBalance({ status: 'failed', wallets: [], bonusWallets: [], updatedAt: Date.now(), detail: 'platform' })
              console.warn('[token-usage-panel] balance unavailable on the platform')
            }
          })
          .catch((error) => {
            if (!alive) return
            const unavailable = error !== null && error !== undefined && error.code === 'unavailable'
            setBalance({
              status: unavailable ? 'unavailable' : 'failed',
              wallets: [],
              bonusWallets: [],
              updatedAt: Date.now(),
              detail: String(error?.message ?? error ?? 'remote error'),
            })
            if (!unavailable) console.warn('[token-usage-panel] balance read failed', error)
          })
          .finally(() => {
            if (alive) setBalanceRefreshing(false)
          })
        return () => {
          alive = false
        }
      }, [fetchBalance, balanceNonce])

      React.useEffect(() => {
        if (refreshProjections === undefined) return
        const catalog = objectOf(sessions) ?? {}
        const byId = objectOf(catalog.byId) ?? {}
        const ids = Array.isArray(catalog.ids) ? catalog.ids : []
        if (catalog.phase === 'pending' && ids.length === 0) return
        const missing = []
        for (const id of ids) {
          const row = objectOf(byId[id])
          if (row === undefined) continue
          if (row.blank === true) continue
          if (attemptedRef.current.has(id)) continue
          const values = objectOf(row.projectionValues)
          if (values !== undefined && values.tokenLedger !== undefined) continue
          // A session the catalog already reports as blank has nothing to price,
          // so a cold read would only burn Host work.
          if (row.blank === true) continue
          missing.push({ id, updatedAt: asNumber(row.updatedAt) })
        }
        // Newest first: the conversations a user looks for are the recent ones.
        const batch = missing
          .sort((left, right) => right.updatedAt - left.updatedAt)
          .slice(0, FILL_LIMIT)
          .map((entry) => entry.id)
        if (batch.length === 0) return
        for (const id of batch) attemptedRef.current.add(id)
        pendingRef.current += batch.length
        setPending(pendingRef.current)
        let cursor = 0
        const settle = () => {
          pendingRef.current = Math.max(0, pendingRef.current - 1)
          if (mountedRef.current) setPending(pendingRef.current)
        }
        const worker = async () => {
          while (cursor < batch.length) {
            const id = batch[cursor]
            cursor += 1
            try {
              await refreshProjections(id)
            } catch (error) {
              // A single unreadable session must not stop the pass; it stays
              // marked "pending" in the record list instead.
            }
            settle()
          }
        }
        const workers = Math.min(FILL_CONCURRENCY, batch.length)
        for (let index = 0; index < workers; index += 1) void worker()
      }, [sessions, pass, refreshProjections])

      const onRefresh = React.useCallback(() => {
        attemptedRef.current = new Set()
        pendingRef.current = 0
        setPending(0)
        setPage(1)
        setPass((value) => value + 1)
      }, [])

      const onPageSizeChange = React.useCallback((value) => {
        setPageSize(value)
        setPage(1)
      }, [])

      const selectRange = React.useCallback((id) => {
        setRange(id)
        setRangeInputs(presetInputsOf(id))
        setPage(1)
      }, [])

      const updateRangeInput = React.useCallback(
        (part, value) => {
          const next = { ...rangeInputs, [part]: value }
          setRangeInputs(next)
          setRange(next.start === '' && next.end === '' ? 'all' : 'custom')
          setPage(1)
        },
        [rangeInputs],
      )

      const clearRange = React.useCallback(() => {
        setRange('all')
        setRangeInputs({ start: '', end: '' })
        setPage(1)
      }, [])

      // The turn table pages; a shrinking dataset clamps the visible page
      // without rewriting the stored one, so a fill arriving later returns the
      // reader to the page they chose.
      const pageCount = Math.max(1, Math.ceil(model.turns.length / pageSize))
      const currentPage = Math.min(Math.max(1, page), pageCount)
      const pageFrom = (currentPage - 1) * pageSize
      const pageTo = Math.min(pageFrom + pageSize, model.turns.length)
      const pageTurns = model.turns.slice(pageFrom, pageTo)

      const ready = sessions.phase === 'ready' || (Array.isArray(sessions.ids) && sessions.ids.length > 0)
      React.useEffect(() => {
        if (ready) {
          setStalled(false)
          return undefined
        }
        const timer = window.setTimeout(() => {
          if (mountedRef.current) setStalled(true)
        }, 10000)
        return () => {
          window.clearTimeout(timer)
        }
      }, [ready])
      const hasCost = totals.pricedCount > 0
      const notices = []
      if (ready && totals.conversations > 0 && !hasCost) {
        notices.push({ key: 'noCost', text: t('notice.noCost') })
      }
      if (ready && !model.ranged && totals.unpricedCount > 0 && pending === 0) {
        notices.push({ key: 'missing', text: t('notice.missing', { count: totals.unpricedCount }) })
      }
      if (ready && model.ranged && totals.turnlessCount > 0 && pending === 0) {
        notices.push({ key: 'turnless', text: t('notice.turnless', { count: totals.turnlessCount }) })
      }
      if (ready && refreshProjections === undefined) {
        notices.push({ key: 'noRefresh', text: t('notice.noRefresh') })
      }

      const sessionMax = model.topSessions.reduce((max, entry) => Math.max(max, entry.cost), 0)
      const rangeLabel = range === 'custom' ? t('range.custom') : t('range.' + range)
      const sessionsNote =
        pending > 0
          ? t('section.sessions.pending', { count: totals.conversations, pending })
          : model.ranged
            ? t('section.sessions.noteRange', { count: totals.conversations, range: rangeLabel })
            : t('section.sessions.note', { count: totals.conversations })

      const ranges = h(
        'div',
        { className: styles.rangeBar },
        h(
          'div',
          { className: styles.ranges, role: 'group', 'aria-label': t('range.label') },
          RANGE_IDS.map((id) =>
            h(
              'button',
              {
                key: id,
                type: 'button',
                className: styles.rangeChip + (range === id ? ' ' + styles.rangeChipActive : ''),
                'aria-pressed': range === id,
                onClick: () => selectRange(id),
              },
              t('range.' + id),
            ),
          ),
          range === 'custom'
            ? h('span', { className: styles.rangeChip + ' ' + styles.rangeChipActive }, t('range.custom'))
            : null,
        ),
        h(
          'div',
          { className: styles.rangeInputs },
          h(
            'div',
            { className: styles.rangeField },
            h('span', null, t('range.from')),
            h(DateField, {
              label: t('range.from'),
              value: rangeInputs.start,
              align: 'left',
              t,
              onChange: (next) => updateRangeInput('start', next),
            }),
          ),
          h(
            'div',
            { className: styles.rangeField },
            h('span', null, t('range.to')),
            h(DateField, {
              label: t('range.to'),
              value: rangeInputs.end,
              align: 'right',
              t,
              onChange: (next) => updateRangeInput('end', next),
            }),
          ),
          h(
            'button',
            {
              type: 'button',
              className: styles.rangeClear,
              onClick: clearRange,
              disabled: rangeBounds.id === 'all',
            },
            t('range.clear'),
          ),
          rangeInvalid
            ? h('span', { className: styles.rangeWarning, role: 'status' }, t('range.invalid'))
            : null,
        ),
      )

      const header = h(
        'header',
        { className: styles.heading },
        h(
          'div',
          { className: styles.headingText },
          h('span', { className: styles.logo, 'aria-hidden': 'true' }, h(ChartGlyph, { size: 18 })),
          h(
            'div',
            { className: styles.headingCopy },
            h('h1', null, t('title')),
            h('p', { className: styles.subtitle }, t('subtitle')),
          ),
        ),
        h(
          'div',
          { className: styles.toolbar },
          balance.status !== 'unavailable'
            ? h(BalancePill, {
                balance,
                refreshing: balanceRefreshing,
                t,
                onRefresh: () => setBalanceNonce((value) => value + 1),
              })
            : null,
          pending > 0 ? h('span', { className: styles.status, role: 'status' }, t('notice.pending', { count: pending })) : null,
          h(
            'button',
            {
              type: 'button',
              className: styles.button,
              onClick: onRefresh,
              disabled: refreshProjections === undefined || pending > 0,
            },
            h(RefreshIcon),
            t('refresh'),
          ),
        ),
      )

      const body = []
      if (!ready) {
        body.push(
          h(
            'div',
            { key: 'loading', className: styles.empty, role: 'status' },
            h('p', { className: styles.emptyTitle }, t('loading')),
            stalled ? h('p', { className: styles.emptyBody }, t('notice.stalled')) : null,
          ),
        )
      } else if (totals.conversations === 0) {
        body.push(
          h(
            'div',
            { key: 'empty', className: styles.empty },
            h(EmptyGlyph),
            h(
              'p',
              { className: styles.emptyTitle },
              pending > 0 ? t('loading.turns') : model.ranged ? t('empty.range') : t('empty.title'),
            ),
            pending > 0
              ? h('p', { className: styles.emptyBody }, t('notice.pending', { count: pending }))
              : h('p', { className: styles.emptyBody }, model.ranged ? t('empty.rangeBody') : t('empty.body')),
          ),
        )
      } else {
        for (const notice of notices) {
          body.push(
            h(
              'div',
              { key: 'notice-' + notice.key, className: styles.notice, role: 'status' },
              h(NoticeIcon),
              h('p', null, notice.text),
            ),
          )
        }

        body.push(
          h(
            'div',
            { key: 'metrics', className: styles.metrics },
            h(MetricCard, {
              tone: styles.toneCost,
              icon: h(SpendingIcon),
              label: t('metric.cost'),
              value: hasCost ? money(totals.currency, totals.cost) : '—',
              hint: hasCost
                ? h(
                    'span',
                    { className: styles.chips },
                    h(
                      'span',
                      { className: styles.chip + ' ' + styles.chipWarn },
                      t('chip.peak', { value: money(totals.currency, totals.peakCost) }),
                    ),
                    h(
                      'span',
                      { className: styles.chip + ' ' + styles.chipOk },
                      t('chip.idle', { value: money(totals.currency, totals.idleCost) }),
                    ),
                  )
                : t('notice.noCost'),
            }),
            h(MetricCard, {
              tone: styles.toneTokens,
              icon: h(TokenIcon),
              label: t('metric.tokens'),
              value: totals.tokens > 0 ? compactTokens(totals.tokens, t) : '0',
              hint:
                totals.cacheHit === null
                  ? t('metric.tokens.hintUnknown')
                  : h(
                      'span',
                      { className: styles.chips },
                      h(
                        'span',
                        { className: styles.chip + ' ' + styles.chipInfo },
                        t('metric.tokens.hint', { percent: String(totals.cacheHit) }),
                      ),
                    ),
              hintTitle: t('tokens', { count: grouped(totals.tokens, t('groupSeparator')) }),
            }),
            h(MetricCard, {
              tone: styles.toneTalks,
              icon: h(ChatIcon),
              label: t('metric.sessions'),
              value: String(totals.conversations),
              hint:
                totals.subagents > 0
                  ? t('metric.sessions.hint', { count: totals.subagents })
                  : t('metric.sessions.hintNone'),
            }),
            h(MetricCard, {
              tone: styles.toneProjects,
              icon: h(FolderIcon),
              label: t('metric.projects'),
              value: String(totals.projects),
              hint:
                hasCost && totals.conversations > 0
                  ? t('metric.projects.hint', {
                      amount: money(totals.currency, totals.cost / totals.conversations),
                    })
                  : t('metric.projects.hint', { amount: '—' }),
            }),
          ),
        )

        const chart = buildProjectSlices(model.projects, t)
        body.push(
          h(
            'div',
            { key: 'split', className: styles.split },
            h(
              'section',
              { className: styles.section + ' ' + styles.toneProjects },
              h(SectionHeading, {
                title: t('section.projects'),
                note: t('section.projects.note', { count: totals.projects }),
              }),
              h(
                'div',
                { className: styles.chartCard },
                chart.slices.length > 0
                  ? h(CostPie, { slices: chart.slices, currency: totals.currency, t })
                  : h('div', { className: styles.chartEmpty }, t('chart.empty')),
                chart.slices.length > 0 ? h('p', { className: styles.chartNote }, t('chart.note')) : null,
              ),
            ),
            h(
              'section',
              { className: styles.section + ' ' + styles.toneTokens },
              h(SectionHeading, {
                title: t('section.sessions'),
                note: sessionsNote,
              }),
              h(
                'ul',
                { className: styles.rows },
                model.topSessions.map((record, index) =>
                  h(RankRow, {
                    key: record.id,
                    index,
                    title: record.title,
                    meta: [record.project.title, formatTime(record.updatedAt)].join(' · '),
                    value: record.priced ? money(record.currency, record.cost) : '—',
                    subvalue: t('tokens', { count: compactTokens(record.tokens, t) }),
                    ratio: sessionMax > 0 ? record.cost / sessionMax : 0,
                  }),
                ),
              ),
            ),
          ),
        )

        body.push(
          h(
            'section',
            { key: 'records', className: styles.section + ' ' + styles.toneTalks },
            h(SectionHeading, {
              title: t('section.records'),
              note: t('section.records.note', { count: totals.turnCount }),
            }),
            model.turns.length === 0
              ? h(
                  'div',
                  { className: styles.empty, role: 'status' },
                  h('p', { className: styles.emptyTitle }, pending > 0 ? t('loading.turns') : t('empty.turns')),
                  pending > 0 ? h('p', { className: styles.emptyBody }, t('notice.pending', { count: pending })) : null,
                )
              : h(
                  'div',
                  { className: styles.tableWrap },
                  h(
                    'table',
                    { className: styles.table },
                    h(
                      'thead',
                      null,
                      h(
                        'tr',
                        null,
                        h('th', { className: styles.time, scope: 'col' }, t('table.time')),
                        h('th', { scope: 'col' }, t('table.session')),
                        h('th', { className: styles.num, scope: 'col' }, t('table.tokens')),
                        h('th', { className: styles.num, scope: 'col' }, t('table.cost')),
                      ),
                    ),
                    h(
                      'tbody',
                      null,
                      pageTurns.map((record) => h(TurnRow, { key: record.key, record, t, openSession })),
                    ),
                  ),
                ),
            model.turns.length > 0
              ? h(Pager, {
                  page: currentPage,
                  pageCount,
                  from: pageFrom + 1,
                  to: pageTo,
                  count: model.turns.length,
                  pageSize,
                  pageSizes: TURN_PAGE_SIZES,
                  t,
                  onChange: setPage,
                  onSizeChange: onPageSizeChange,
                })
              : null,
          ),
        )

        body.push(h('p', { key: 'footnote', className: styles.footnote }, t('footnote')))
      }

      return h(
        'div',
        { className: styles.page, 'data-panel': PANEL_ID },
        h(
          'div',
          { className: styles.pane },
          h('div', { className: styles.scroll }, h('div', { className: styles.content }, header, ranges, body)),
        ),
      )
    }

    /**
     * Keeps a render failure inside the panel: an unhandled throw would make the
     * slot abdicate this entry and leave the main column empty.
     */
    class PanelBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false }
      }

      static getDerivedStateFromError() {
        return { failed: true }
      }

      componentDidCatch(error) {
        try {
          console.error('[token-usage-panel] panel render failed', error)
        } catch (ignored) {
          // The fallback below is what the user sees; logging is best effort.
        }
      }

      render() {
        if (this.state.failed) {
          return h(
            'div',
            { className: styles.page, 'data-panel': PANEL_ID },
            h(
              'div',
              { className: styles.pane },
              h(
                'div',
                { className: styles.scroll },
                h('div', { className: styles.content }, h('div', { className: styles.empty, role: 'alert' }, this.props.message)),
              ),
            ),
          )
        }
        return this.props.children
      }
    }

    function PanelEntry(props) {
      let message = 'The usage panel failed to render. Reload the page and try again.'
      try {
        if (typeof props.t === 'function') message = props.t('notice.crashed')
      } catch (ignored) {
        // Fall back to the English message when the dictionary is unavailable.
      }
      return h(PanelBoundary, { message }, h(UsagePanel, props))
    }

    return {
      // Only the slot registry and the locale service are hard requirements.
      // The session catalog and workspace navigation are read through
      // `ctx.get`, so a composition without them still renders the page with
      // whatever projections are already cached.
      inject: ['slots', 'locale'],
      apply(ctx) {
        const locale = ctx.get('locale')
        ctx.effect(() => locale.register(NS, { zh: ZH, en: EN }), 'token-usage-panel: dictionaries')
        ctx.effect(() => {
          const tag = document.createElement('style')
          tag.dataset.plugin = 'dsh-token-usage-panel'
          tag.dataset.pluginCss = 'dsh-token-usage-panel/panel.css'
          tag.textContent = CSS
          document.head.appendChild(tag)
          return () => {
            tag.remove()
          }
        }, 'token-usage-panel: styles')

        const t = locale.bind(NS)
        const sessions = ctx.get('sessions')
        const uiWorkspace = ctx.get('uiWorkspace')
        const clientMetadata = () => ({
          version: CLIENT_VERSION,
          locale: locale.getLocale().active,
          timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
        })
        // The account namespace is mounted as its own `remote.account` Cordis
        // service (a nested service under `remote`), so it is resolved through
        // ctx.get rather than assumed to be a property of ctx.remote. Namespaces
        // mount asynchronously after boot, so the lookup happens at call time.
        const fetchBalance = () => {
          try {
            const account = ctx.get('remote.account') ?? ctx.get('remote')?.account
            if (account === undefined || typeof account.getBalance !== 'function') {
              const error = new Error('token-usage-panel: account remote unavailable')
              error.code = 'unavailable'
              return Promise.reject(error)
            }
            return Promise.resolve(account.getBalance(clientMetadata()))
          } catch (error) {
            return Promise.reject(error)
          }
        }
        // These wrappers are created once: the slot may rebuild its props on
        // every render, and a fresh function identity would re-run effects that
        // depend on them (the balance read would loop).
        const refreshProjections =
          sessions !== undefined && typeof sessions.refreshProjections === 'function'
            ? (id) => sessions.refreshProjections(id)
            : undefined
        const openSession =
          uiWorkspace !== undefined && typeof uiWorkspace.openSession === 'function'
            ? (id) => uiWorkspace.openSession(id)
            : undefined
        const extraProps = () => ({ fetchBalance, refreshProjections, openSession })

        // One panel id addresses both seats: the sidebar row selects it and the
        // main column dispatches the same key to this page.
        ctx.slots.inject('main', () =>
          ctx.slots.register(
            { name: 'main', key: PANEL_ID, locale: NS, inject: extraProps },
            PanelEntry,
          ),
        )
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              // Between the shipped Plugins row (0) and Automation tasks (10).
              order: 5,
              locale: NS,
              label: () => t('panel'),
            },
            ChartGlyph,
          ),
        )
      },
    }
  },
})
