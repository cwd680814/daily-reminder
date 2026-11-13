/**
 * 每日事项提示器 · 纯逻辑层
 *
 * 这里只放与 UI 无关的计算：事项 -> 某年发生的实例 -> 状态 -> 是否到期。
 * 独立成文件的目的：既方便单元测试（tests/reminder.test.ts），
 * 也保证「提醒的时刻与关闭的粒度」这两条核心规则只有一份实现。
 */

/** 一条事项。date 是「锚定日期」，每年重复时只取它的月日 */
export interface ReminderItem {
  id: string
  title: string
  note: string
  /** 锚定日期，格式 YYYY-MM-DD（本地日历，不带时区） */
  date: string
  /** true = 每年同月同日重复；false = 只在 date 这一年出现一次 */
  repeatYearly: boolean
  createdAt: string
  updatedAt: string
}

/**
 * 一次「关闭」。粒度是 itemId + 具体日期（occurrence），
 * 所以关掉 2026-03-08 这次，不会影响 2027-03-08，也不会影响同一条事项的其他日期。
 */
export interface Dismissal {
  /** `${itemId}::${occurrence}`，天然去重 */
  key: string
  itemId: string
  /** 被关闭的那一次实例，YYYY-MM-DD */
  occurrence: string
  dismissedAt: string
}

export type OccurrenceStatus = 'pending' | 'dismissed'

/** 某一条事项在某一年长出来的一个具体实例 */
export interface Occurrence {
  itemId: string
  item: ReminderItem
  /** YYYY-MM-DD */
  occurrence: string
  year: number
  /** 2 月 29 日在平年落到 2 月 28 日时为 true */
  leapAdjusted: boolean
  status: OccurrenceStatus
}

export const pad2 = (n: number): string => String(n).padStart(2, '0')

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate()
}

/** 本地日历的 YYYY-MM-DD，不用 toISOString（那是 UTC，会跨天） */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function todayKey(now: Date = new Date()): string {
  return dateKey(now)
}

export function parseKey(key: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null
  return { y, m: mo, d }
}

export function isValidDateKey(key: string): boolean {
  return parseKey(key) !== null
}

/** 某条事项在第 year 年是否出现；不出现返回 null */
export function occurrenceOf(item: ReminderItem, year: number): { date: string; leapAdjusted: boolean } | null {
  const parsed = parseKey(item.date)
  if (!parsed) return null
  if (!item.repeatYearly) {
    return parsed.y === year ? { date: item.date, leapAdjusted: false } : null
  }
  if (parsed.m === 2 && parsed.d === 29 && !isLeapYear(year)) {
    return { date: `${year}-02-28`, leapAdjusted: true }
  }
  return { date: `${year}-${pad2(parsed.m)}-${pad2(parsed.d)}`, leapAdjusted: false }
}

export function dismissalKey(itemId: string, occurrence: string): string {
  return `${itemId}::${occurrence}`
}

export function statusOf(itemId: string, occurrence: string, dismissals: Dismissal[]): OccurrenceStatus {
  const key = dismissalKey(itemId, occurrence)
  return dismissals.some(d => d.key === key) ? 'dismissed' : 'pending'
}

/** 汇总某一年全部实例，按日期升序 */
export function occurrencesOfYear(
  items: ReminderItem[],
  dismissals: Dismissal[],
  year: number,
): Occurrence[] {
  const out: Occurrence[] = []
  for (const item of items) {
    const hit = occurrenceOf(item, year)
    if (!hit) continue
    out.push({
      itemId: item.id,
      item,
      occurrence: hit.date,
      year,
      leapAdjusted: hit.leapAdjusted,
      status: statusOf(item.id, hit.date, dismissals),
    })
  }
  return out.sort((a, b) => a.occurrence.localeCompare(b.occurrence) || a.item.title.localeCompare(b.item.title))
}

/** 所有事项覆盖到的年份（含重复事项的「当年」），升序 */
export function yearsOf(items: ReminderItem[], extra: number[] = []): number[] {
  const set = new Set<number>(extra)
  for (const it of items) {
    const p = parseKey(it.date)
    if (p) set.add(p.y)
  }
  return [...set].sort((a, b) => a - b)
}

/** 某个具体实例的到期时刻 = 该日期本地时间 00:00:00 */
export function dueAt(occurrence: string): Date | null {
  const p = parseKey(occurrence)
  if (!p) return null
  return new Date(p.y, p.m - 1, p.d, 0, 0, 0, 0)
}

/** 是否已到提醒时刻（本地时间 00:00 之后即到期） */
export function isDue(occurrence: string, now: Date): boolean {
  const at = dueAt(occurrence)
  return at !== null && now.getTime() >= at.getTime()
}

/**
 * 当前应当弹出的提醒。
 *
 * 规则：到点（本地 00:00）且「今天正好是它的日期」才自动弹出。
 * - 页面在 00:00 时开着 -> 定时器到点触发，today === occurrence，弹出；
 * - 当天晚些时候才打开页面 -> 同一天仍算catch-up，弹出，不会漏；
 * - 前几天没关掉的 -> 列表里依旧显示「待提醒」，但不补弹，避免一开页面弹出一堆历史。
 */
export function dueOccurrences(
  items: ReminderItem[],
  dismissals: Dismissal[],
  now: Date,
): Occurrence[] {
  const today = todayKey(now)
  return occurrencesOfYear(items, dismissals, now.getFullYear())
    .filter(o => o.occurrence === today && o.status === 'pending' && isDue(o.occurrence, now))
}

/** 距下一个本地 00:00 的毫秒数（用于 setTimeout 精准跳到零点） */
export function msUntilNextMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 50)
  return Math.max(1000, next.getTime() - now.getTime())
}

const WEEKDAY_CN = ['日', '一', '二', '三', '四', '五', '六']

export function weekdayCN(key: string): string {
  const p = parseKey(key)
  if (!p) return ''
  return '周' + WEEKDAY_CN[new Date(p.y, p.m - 1, p.d).getDay()]
}

export function formatCN(key: string): string {
  const p = parseKey(key)
  if (!p) return key
  return `${p.y} 年 ${p.m} 月 ${p.d} 日`
}

/** 生成月历矩阵（前置空位用 null 占位，行数对齐到整周） */
export function monthMatrix(year: number, month: number): (number | null)[] {
  const first = new Date(year, month - 1, 1).getDay()
  const total = daysInMonth(year, month)
  const cells: (number | null)[] = []
  for (let i = 0; i < first; i++) cells.push(null)
  for (let d = 1; d <= total; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}
