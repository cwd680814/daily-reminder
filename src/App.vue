<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import DayView from './components/DayView.vue'
import ReminderModal from './components/ReminderModal.vue'
import YearView from './components/YearView.vue'
import { type ReminderItem, formatCN, occurrencesOfYear, todayKey } from './lib/reminder'
import { useReminderStore } from './lib/store'

const store = useReminderStore()

const currentYear = new Date().getFullYear()
const selectedYear = ref(currentYear)
const selectedDate = ref(todayKey())
const editing = ref<ReminderItem | null>(null)
const toast = ref('')
let toastTimer: number | undefined

function flash(msg: string) {
  toast.value = msg
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toast.value = ''), 2200)
}

const yearOptions = computed(() => {
  const set = new Set<number>(store.years.value)
  for (let y = currentYear - 2; y <= currentYear + 5; y++) set.add(y)
  set.add(selectedYear.value)
  return [...set].sort((a, b) => a - b)
})

/** 当前年度全部实例（含已关闭） */
const yearOccurrences = computed(() =>
  occurrencesOfYear(store.items.value, store.dismissals.value, selectedYear.value),
)

const stats = computed(() => {
  const all = yearOccurrences.value
  return {
    total: all.length,
    pending: all.filter(o => o.status === 'pending').length,
    dismissed: all.filter(o => o.status === 'dismissed').length,
    repeat: store.items.value.filter(i => i.repeatYearly).length,
  }
})

const dayOccurrences = computed(() =>
  yearOccurrences.value.filter(o => o.occurrence === selectedDate.value),
)

/** 同一月日上的「每年重复」事项，跨年连续性的提示 */
const relatedYears = computed(() => {
  const md = selectedDate.value.slice(5)
  const has = store.items.value.some(i => i.repeatYearly && i.date.slice(5) === md)
  return has
    ? [selectedYear.value - 1, selectedYear.value, selectedYear.value + 1]
    : [selectedYear.value]
})

function clampDate(year: number, date: string): string {
  const md = date.slice(5)
  if (md === '02-29') {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    return `${year}-02-${leap ? '29' : '28'}`
  }
  return `${year}-${md}`
}

function pickDate(date: string) {
  selectedDate.value = date
  selectedYear.value = Number(date.slice(0, 4))
  editing.value = null
}

function shiftYear(delta: number) {
  const y = selectedYear.value + delta
  selectedYear.value = y
  selectedDate.value = clampDate(y, selectedDate.value)
  editing.value = null
}

function goToday() {
  selectedDate.value = todayKey()
  selectedYear.value = currentYear
  editing.value = null
}

function onSubmit(payload: { title: string; note: string; date: string; repeatYearly: boolean }) {
  if (editing.value) {
    store.updateItem(editing.value.id, payload)
    editing.value = null
    flash('已保存修改')
  } else {
    store.addItem(payload)
    flash('已添加事项')
  }
  selectedDate.value = payload.date
  selectedYear.value = Number(payload.date.slice(0, 4))
}

function onEdit(item: ReminderItem) {
  editing.value = item
  selectedDate.value = item.repeatYearly ? clampDate(selectedYear.value, item.date) : item.date
}

function onRemove(itemId: string) {
  const item = store.items.value.find(i => i.id === itemId)
  if (!item) return
  if (!window.confirm(`确定删除「${item.title}」？该事项所有年份的提醒都会一并移除。`)) return
  store.removeItem(itemId)
  if (editing.value?.id === itemId) editing.value = null
  flash('已删除事项')
}

function onDismiss(itemId: string, occurrence: string) {
  store.dismiss(itemId, occurrence)
  flash('已关闭本次提醒')
}

function onRestore(itemId: string, occurrence: string) {
  store.restore(itemId, occurrence)
  flash('已恢复为待提醒')
}

function onReset() {
  if (!window.confirm('清空本机保存的全部事项与关闭记录？此操作不可恢复。')) return
  store.resetAll()
  flash('已清空')
}

onMounted(() => store.start())
onUnmounted(() => store.stop())

// 供模板使用的函数
const fmt = formatCN
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="brand">
        <span class="logo">🔔</span>
        <div>
          <h1>每日事项提示器</h1>
          <p class="muted">按年份浏览 · 任意日期录入 · 每年重复 · 本地 00:00 自动提醒</p>
        </div>
      </div>
      <div class="top-actions">
        <button type="button" class="btn" @click="store.openTestReminder()">测试提醒</button>
        <button v-if="!store.items.value.length" type="button" class="btn" @click="store.loadDemo(); flash('已载入示例')">载入示例</button>
        <button type="button" class="btn ghost" @click="onReset">清空数据</button>
      </div>
    </header>

    <section class="stat-row">
      <div class="stat">
        <div class="stat-label">本年事项</div>
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-sub">{{ selectedYear }} 年展开后的实例数</div>
      </div>
      <div class="stat stat-pending">
        <div class="stat-label">待提醒</div>
        <div class="stat-value">{{ stats.pending }}</div>
        <div class="stat-sub">到点会弹窗，点「知道了」才关闭</div>
      </div>
      <div class="stat stat-dismissed">
        <div class="stat-label">已关闭</div>
        <div class="stat-value">{{ stats.dismissed }}</div>
        <div class="stat-sub">仅关闭当次，不影响往后年份</div>
      </div>
      <div class="stat">
        <div class="stat-label">每年重复事项</div>
        <div class="stat-value">{{ stats.repeat }}</div>
        <div class="stat-sub">共 {{ store.items.value.length }} 条原始事项</div>
      </div>
    </section>

    <section class="yearbar card">
      <div class="year-nav">
        <button type="button" class="btn xs" @click="shiftYear(-1)">‹ 上一年</button>
        <select v-model.number="selectedYear" class="year-select" @change="selectedDate = clampDate(selectedYear, selectedDate); editing = null">
          <option v-for="y in yearOptions" :key="y" :value="y">{{ y }} 年</option>
        </select>
        <button type="button" class="btn xs" @click="shiftYear(1)">下一年 ›</button>
        <button type="button" class="btn xs" @click="goToday">回到今天</button>
      </div>
      <div class="today-line">
        今天 {{ fmt(todayKey()) }} · 当前选中 {{ fmt(selectedDate) }} · 上次检查 {{ store.lastCheckedAt.value }}
      </div>
    </section>

    <YearView
      :year="selectedYear"
      :items="store.items.value"
      :dismissals="store.dismissals.value"
      :selected-date="selectedDate"
      @select="pickDate"
    />

    <DayView
      :date="selectedDate"
      :occurrences="dayOccurrences"
      :editing="editing"
      :related-years="relatedYears"
      @submit="onSubmit"
      @cancel="editing = null"
      @edit="onEdit"
      @remove="onRemove"
      @dismiss="onDismiss"
      @restore="onRestore"
    />

    <ReminderModal
      :open="store.modalOpen.value"
      :queue="store.pendingQueue.value"
      @dismiss="onDismiss"
      @dismiss-all="store.dismissAll(); flash('已关闭全部今日提醒')"
      @close="store.closeModal()"
    />

    <div v-if="toast" class="toast">{{ toast }}</div>

    <footer class="foot">
      <span>数据保存在本机浏览器（localStorage），不上传服务器。</span>
      <span>提醒触发时间 = 事项日期当天本地时间 00:00；页面需保持打开或当天重新打开。</span>
    </footer>
  </div>
</template>

<style scoped>
.page { max-width: 1180px; margin: 0 auto; padding: 20px 16px 40px; }
.topbar { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.brand { display: flex; gap: 10px; align-items: center; }
.logo { font-size: 26px; }
.brand h1 { font-size: 19px; margin: 0; }
.brand p { margin: 2px 0 0; font-size: 12.5px; }
.top-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
.stat { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }
.stat-label { font-size: 12px; color: var(--muted); }
.stat-value { font-size: 24px; font-weight: 700; line-height: 1.2; margin-top: 2px; }
.stat-sub { font-size: 11px; color: var(--muted); margin-top: 2px; }
.stat-pending .stat-value { color: #b42318; }
.stat-dismissed .stat-value { color: #667085; }
.yearbar { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; padding: 10px 14px; }
.year-nav { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.year-select { border: 1px solid var(--line); border-radius: 8px; padding: 5px 8px; font-size: 13px; background: #fff; color: var(--text); }
.today-line { font-size: 11.5px; color: var(--muted); }
.toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); background: #101828; color: #fff; font-size: 12.5px; padding: 8px 16px; border-radius: 999px; box-shadow: 0 8px 20px rgba(16,24,40,.2); z-index: 1100; }
.foot { margin-top: 18px; display: flex; flex-direction: column; gap: 3px; font-size: 11px; color: var(--muted); }
@media (max-width: 760px) {
  .stat-row { grid-template-columns: 1fr 1fr; }
  .page { padding: 14px 12px 32px; }
}
</style>
