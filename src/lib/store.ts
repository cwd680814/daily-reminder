/**
 * 每日事项提示器 · 状态与持久化
 *
 * 存储：localStorage（单机、离线、无后端依赖）。
 * 定时：先 setTimeout 精确跳到下一个本地 00:00，再补一个 20s 心跳，
 *      用于兜住「系统休眠 / 改系统时间 / 定时器被浏览器降频」导致的漏触发。
 */
import { computed, reactive, ref } from 'vue'
import {
  type Dismissal,
  type Occurrence,
  type ReminderItem,
  dateKey,
  dismissalKey,
  dueOccurrences,
  msUntilNextMidnight,
  occurrencesOfYear,
  todayKey,
  yearsOf,
} from './reminder'

const STORAGE_KEY = 'daily-reminder.v1'

interface Persisted {
  version: 1
  items: ReminderItem[]
  dismissals: Dismissal[]
}

function uid(): string {
  const rnd = Math.random().toString(36).slice(2, 8)
  return `it_${Date.now().toString(36)}_${rnd}`
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { version: 1, items: [], dismissals: [] }
    const data = JSON.parse(raw) as Persisted
    if (!data || data.version !== 1 || !Array.isArray(data.items)) {
      return { version: 1, items: [], dismissals: [] }
    }
    return { version: 1, items: data.items, dismissals: data.dismissals || [] }
  } catch {
    return { version: 1, items: [], dismissals: [] }
  }
}

const state = reactive<Persisted>(load())

/** 当前待弹出的提醒（按到期顺序），由调度器与手动测试共同写入 */
const dueQueue = ref<Occurrence[]>([])
/** 弹窗是否打开 */
const modalOpen = ref(false)
/** 最近一次检查时间，用于界面显示"最后检查" */
const lastCheckedAt = ref<string>(new Date().toLocaleTimeString('zh-CN', { hour12: false }))

let midnightTimer: number | undefined
let heartbeat: number | undefined
let started = false

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, items: state.items, dismissals: state.dismissals }))
  } catch (e) {
    console.warn('[daily-reminder] 本地存储写入失败', e)
  }
}

function refreshDue() {
  const now = new Date()
  lastCheckedAt.value = now.toLocaleTimeString('zh-CN', { hour12: false })
  const due = dueOccurrences(state.items, state.dismissals, now)
  if (due.length === 0) return
  // 已经在队列里的不重复加，避免心跳刷新导致弹两次
  const exists = new Set(dueQueue.value.map(o => dismissalKey(o.itemId, o.occurrence)))
  const add = due.filter(o => !exists.has(dismissalKey(o.itemId, o.occurrence)))
  if (add.length === 0) return
  dueQueue.value = [...dueQueue.value, ...add]
  modalOpen.value = true
}

function scheduleMidnight() {
  window.clearTimeout(midnightTimer)
  const wait = msUntilNextMidnight(new Date())
  midnightTimer = window.setTimeout(() => {
    refreshDue()
    scheduleMidnight()
  }, wait)
}

export function useReminderStore() {
  const items = computed(() => [...state.items].sort((a, b) => a.date.localeCompare(b.date)))
  const dismissals = computed(() => state.dismissals)
  const pendingQueue = computed(() => dueQueue.value)

  function start() {
    if (started) return
    started = true
    refreshDue()
    scheduleMidnight()
    heartbeat = window.setInterval(refreshDue, 20000)
    // 从后台切回前台时立即补检一次
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshDue()
    })
  }

  function stop() {
    window.clearTimeout(midnightTimer)
    window.clearInterval(heartbeat)
    started = false
  }

  function addItem(input: Pick<ReminderItem, 'title' | 'note' | 'date' | 'repeatYearly'>): ReminderItem {
    const now = new Date().toISOString()
    const item: ReminderItem = { id: uid(), createdAt: now, updatedAt: now, ...input }
    state.items.push(item)
    persist()
    refreshDue()
    return item
  }

  function updateItem(id: string, patch: Partial<Pick<ReminderItem, 'title' | 'note' | 'date' | 'repeatYearly'>>) {
    const item = state.items.find(i => i.id === id)
    if (!item) return
    Object.assign(item, patch, { updatedAt: new Date().toISOString() })
    persist()
  }

  function removeItem(id: string) {
    const i = state.items.findIndex(x => x.id === id)
    if (i >= 0) state.items.splice(i, 1)
    // 连带清掉这条事项的关闭记录，避免残留脏数据
    for (let j = state.dismissals.length - 1; j >= 0; j--) {
      if (state.dismissals[j].itemId === id) state.dismissals.splice(j, 1)
    }
    dueQueue.value = dueQueue.value.filter(o => o.itemId !== id)
    if (dueQueue.value.length === 0) modalOpen.value = false
    persist()
  }

  /** 关闭「这一次」提醒：只写一条 (itemId, occurrence) 记录 */
  function dismiss(itemId: string, occurrence: string) {
    const key = dismissalKey(itemId, occurrence)
    if (!state.dismissals.some(d => d.key === key)) {
      state.dismissals.push({ key, itemId, occurrence, dismissedAt: new Date().toISOString() })
      persist()
    }
    dueQueue.value = dueQueue.value.filter(o => dismissalKey(o.itemId, o.occurrence) !== key)
    if (dueQueue.value.length === 0) modalOpen.value = false
  }

  function dismissAll() {
    for (const o of [...dueQueue.value]) dismiss(o.itemId, o.occurrence)
  }

  /** 撤销关闭（列表里可以对某一次恢复为「待提醒」） */
  function restore(itemId: string, occurrence: string) {
    const key = dismissalKey(itemId, occurrence)
    state.dismissals = state.dismissals.filter(d => d.key !== key)
    persist()
  }

  /** 手动测试：不看当前时间，直接把「今天」的待提醒塞进弹窗 */
  function openTestReminder() {
    const now = new Date()
    const today = todayKey(now)
    const todays = occurrencesOfYear(state.items, state.dismissals, now.getFullYear())
      .filter(o => o.occurrence === today && o.status === 'pending')
    dueQueue.value = todays
    modalOpen.value = true
  }

  function closeModal() {
    modalOpen.value = false
  }

  /** 清空全部数据（演示/重置用） */
  function resetAll() {
    state.items.splice(0, state.items.length)
    state.dismissals.splice(0, state.dismissals.length)
    dueQueue.value = []
    modalOpen.value = false
    persist()
  }

  /** 一键载入示例（含一次性事项与每年重复事项，便于立刻看到效果） */
  function loadDemo() {
    const y = new Date().getFullYear()
    const now = new Date().toISOString()
    const demo: ReminderItem[] = [
      { id: uid(), title: '妈妈生日', note: '提前订蛋糕，晚上回家吃饭', date: `${y}-03-08`, repeatYearly: true, createdAt: now, updatedAt: now },
      { id: uid(), title: '结婚纪念日', note: '准备一份小礼物', date: `${y}-05-20`, repeatYearly: true, createdAt: now, updatedAt: now },
      { id: uid(), title: '交物业费', note: '本年度一次性事项', date: `${y}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`, repeatYearly: false, createdAt: now, updatedAt: now },
    ]
    state.items.push(...demo)
    persist()
    refreshDue()
  }

  const years = computed(() => yearsOf(state.items, [new Date().getFullYear()]))

  return {
    items,
    dismissals,
    years,
    pendingQueue,
    modalOpen,
    lastCheckedAt,
    start,
    stop,
    addItem,
    updateItem,
    removeItem,
    dismiss,
    dismissAll,
    restore,
    openTestReminder,
    closeModal,
    resetAll,
    loadDemo,
    refreshDue,
    todayKey: () => dateKey(new Date()),
  }
}
