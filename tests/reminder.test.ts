import { describe, expect, it } from 'vitest'
import {
  type Dismissal,
  type ReminderItem,
  dueAt,
  dueOccurrences,
  isDue,
  monthMatrix,
  msUntilNextMidnight,
  occurrenceOf,
  occurrencesOfYear,
  statusOf,
  weekdayCN,
  yearsOf,
} from '../src/lib/reminder'

const item = (p: Partial<ReminderItem> = {}): ReminderItem => ({
  id: p.id ?? 'it_1',
  title: p.title ?? '妈妈生日',
  note: p.note ?? '',
  date: p.date ?? '2026-03-08',
  repeatYearly: p.repeatYearly ?? true,
  createdAt: p.createdAt ?? '2026-01-01T00:00:00.000Z',
  updatedAt: p.updatedAt ?? '2026-01-01T00:00:00.000Z',
})

const dismissal = (itemId: string, occurrence: string): Dismissal => ({
  key: `${itemId}::${occurrence}`,
  itemId,
  occurrence,
  dismissedAt: '2026-03-08T01:00:00.000Z',
})

describe('年度展开', () => {
  it('每年重复的事项在每一年都出现，且日期为同月同日', () => {
    const it1 = item({ date: '2026-03-08', repeatYearly: true })
    expect(occurrenceOf(it1, 2026)?.date).toBe('2026-03-08')
    expect(occurrenceOf(it1, 2027)?.date).toBe('2027-03-08')
    expect(occurrenceOf(it1, 2030)?.date).toBe('2030-03-08')
  })

  it('不重复的事项只在锚定那一年出现', () => {
    const once = item({ date: '2026-05-01', repeatYearly: false })
    expect(occurrenceOf(once, 2026)?.date).toBe('2026-05-01')
    expect(occurrenceOf(once, 2027)).toBeNull()
  })

  it('2 月 29 日的每年重复事项在平年落到 2 月 28 日并标记', () => {
    const feb29 = item({ date: '2024-02-29', repeatYearly: true })
    expect(occurrenceOf(feb29, 2024)).toEqual({ date: '2024-02-29', leapAdjusted: false })
    expect(occurrenceOf(feb29, 2025)).toEqual({ date: '2025-02-28', leapAdjusted: true })
    expect(occurrenceOf(feb29, 2028)).toEqual({ date: '2028-02-29', leapAdjusted: false })
  })

  it('同一年内按日期升序汇总', () => {
    const items = [
      item({ id: 'a', date: '2026-09-01' }),
      item({ id: 'b', date: '2026-01-15' }),
      item({ id: 'c', date: '2026-05-20', repeatYearly: false }),
    ]
    const list = occurrencesOfYear(items, [], 2026)
    expect(list.map(o => o.occurrence)).toEqual(['2026-01-15', '2026-05-20', '2026-09-01'])
  })

  it('覆盖年份包含所有锚定年份', () => {
    const items = [item({ date: '2025-02-01' }), item({ date: '2028-07-07' })]
    expect(yearsOf(items, [2026])).toEqual([2025, 2026, 2028])
  })
})

describe('状态：待提醒 / 已关闭', () => {
  it('默认是待提醒，写入关闭记录后变已关闭', () => {
    expect(statusOf('it_1', '2026-03-08', [])).toBe('pending')
    expect(statusOf('it_1', '2026-03-08', [dismissal('it_1', '2026-03-08')])).toBe('dismissed')
  })

  it('关闭某一次不影响同一条事项的后续年度', () => {
    const ds = [dismissal('it_1', '2026-03-08')]
    expect(statusOf('it_1', '2026-03-08', ds)).toBe('dismissed')
    expect(statusOf('it_1', '2027-03-08', ds)).toBe('pending')
  })

  it('关闭某一次不影响同一天的其他事项', () => {
    const ds = [dismissal('it_1', '2026-03-08')]
    expect(statusOf('it_2', '2026-03-08', ds)).toBe('pending')
  })

  it('年度汇总里两种状态同时存在', () => {
    const items = [item({ id: 'a', date: '2026-03-08' }), item({ id: 'b', date: '2026-03-08' })]
    const list = occurrencesOfYear(items, [dismissal('a', '2026-03-08')], 2026)
    expect(list.map(o => [o.itemId, o.status])).toEqual([
      ['a', 'dismissed'],
      ['b', 'pending'],
    ])
  })
})

describe('00:00 到期判定', () => {
  it('触发时刻是该日期的本地零点', () => {
    const at = dueAt('2026-03-08')!
    expect(at.getFullYear()).toBe(2026)
    expect(at.getMonth()).toBe(2)
    expect(at.getDate()).toBe(8)
    expect(at.getHours()).toBe(0)
    expect(at.getMinutes()).toBe(0)
    expect(at.getSeconds()).toBe(0)
  })

  it('零点前一毫秒不到期，零点整到期', () => {
    expect(isDue('2026-03-08', new Date(2026, 2, 7, 23, 59, 59, 999))).toBe(false)
    expect(isDue('2026-03-08', new Date(2026, 2, 8, 0, 0, 0, 0))).toBe(true)
    expect(isDue('2026-03-08', new Date(2026, 2, 8, 13, 30, 0, 0))).toBe(true)
  })

  it('零点弹出：当天到点且未关闭才进入提醒队列', () => {
    const items = [item({ id: 'a', date: '2026-03-08' })]
    const atMidnight = new Date(2026, 2, 8, 0, 0, 1)
    expect(dueOccurrences(items, [], atMidnight).map(o => o.itemId)).toEqual(['a'])
    expect(dueOccurrences(items, [dismissal('a', '2026-03-08')], atMidnight)).toEqual([])
  })

  it('零点前不弹，第二天不补弹（避免开页面时刷出一堆历史）', () => {
    const items = [item({ id: 'a', date: '2026-03-08' })]
    expect(dueOccurrences(items, [], new Date(2026, 2, 7, 23, 59, 30))).toEqual([])
    expect(dueOccurrences(items, [], new Date(2026, 2, 9, 0, 5, 0))).toEqual([])
  })

  it('当天晚些时候打开页面仍会补弹（同一天 catch-up）', () => {
    const items = [item({ id: 'a', date: '2026-03-08' })]
    expect(dueOccurrences(items, [], new Date(2026, 2, 8, 21, 10, 0)).map(o => o.itemId)).toEqual(['a'])
  })

  it('跨年重复事项在次年零点照常弹出', () => {
    const items = [item({ id: 'a', date: '2026-03-08', repeatYearly: true })]
    const ds = [dismissal('a', '2026-03-08')]
    expect(dueOccurrences(items, ds, new Date(2027, 2, 8, 0, 0, 2)).map(o => o.occurrence)).toEqual(['2027-03-08'])
  })
})

describe('时间与日历辅助', () => {
  it('距下一个零点的毫秒数在 1 秒到 24 小时之间', () => {
    const ms = msUntilNextMidnight(new Date(2026, 2, 8, 23, 59, 0))
    expect(ms).toBeGreaterThan(1000)
    expect(ms).toBeLessThanOrEqual(24 * 3600 * 1000)
    const full = msUntilNextMidnight(new Date(2026, 2, 8, 0, 0, 0))
    expect(full).toBeGreaterThan(23 * 3600 * 1000)
  })

  it('月历矩阵按整周对齐，天数正确', () => {
    const mar2026 = monthMatrix(2026, 3)
    expect(mar2026.length % 7).toBe(0)
    expect(mar2026.filter(Boolean)).toHaveLength(31)
    expect(monthMatrix(2026, 2).filter(Boolean)).toHaveLength(28)
    expect(monthMatrix(2024, 2).filter(Boolean)).toHaveLength(29)
  })

  it('星期计算与真实日期一致', () => {
    expect(weekdayCN('2026-03-08')).toBe('周日')
    expect(weekdayCN('2027-03-08')).toBe('周一')
  })
})
