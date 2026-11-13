<script setup lang="ts">
import { computed } from 'vue'
import {
  type Dismissal,
  type Occurrence,
  type ReminderItem,
  daysInMonth,
  monthMatrix,
  occurrencesOfYear,
  todayKey,
} from '../lib/reminder'

const props = defineProps<{
  year: number
  items: ReminderItem[]
  dismissals: Dismissal[]
  selectedDate: string
}>()

const emit = defineEmits<{ (e: 'select', date: string): void }>()

const today = computed(() => todayKey())

/** 该年度全部实例，按日期分组 */
const byDate = computed(() => {
  const map = new Map<string, Occurrence[]>()
  for (const o of occurrencesOfYear(props.items, props.dismissals, props.year)) {
    const arr = map.get(o.occurrence) || []
    arr.push(o)
    map.set(o.occurrence, arr)
  }
  return map
})

const months = computed(() =>
  Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    const cells = monthMatrix(props.year, month).map(day => {
      if (day === null) return null
      const date = `${props.year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const list = byDate.value.get(date) || []
      return {
        day,
        date,
        total: list.length,
        pending: list.filter(o => o.status === 'pending').length,
        hasRepeat: list.some(o => o.item.repeatYearly),
        isToday: date === today.value,
        isSelected: date === props.selectedDate,
      }
    })
    const list = Array.from(byDate.value.values()).flat().filter(o => Number(o.occurrence.slice(5, 7)) === month)
    return {
      month,
      cells,
      total: list.length,
      pending: list.filter(o => o.status === 'pending').length,
      days: daysInMonth(props.year, month),
    }
  }),
)

const weekdayHead = ['日', '一', '二', '三', '四', '五', '六']
</script>

<template>
  <section class="card year-view">
    <header class="sec-head">
      <div>
        <h2>{{ year }} 年度视图</h2>
        <p class="muted">
          12 个月一览；有事项的日期会标出小圆点，红点=待提醒，灰点=已关闭，点任意日期进入日期视图
        </p>
      </div>
      <div class="legend">
        <span class="dot legend-pending"></span> 待提醒
        <span class="dot legend-dismissed"></span> 已关闭
        <span class="ring legend-today"></span> 今天
      </div>
    </header>

    <div class="months">
      <div v-for="m in months" :key="m.month" class="month" :class="{ 'month-empty': m.total === 0 }">
        <div class="month-head">
          <b>{{ m.month }} 月</b>
          <span v-if="m.total" class="chip" :class="{ 'chip-pending': m.pending > 0 }">
            {{ m.total }} 项<template v-if="m.pending"> · {{ m.pending }} 待提醒</template>
          </span>
          <span v-else class="chip chip-none">无事项</span>
        </div>
        <div class="week-head">
          <span v-for="w in weekdayHead" :key="w">{{ w }}</span>
        </div>
        <div class="days">
          <button
            v-for="(c, idx) in m.cells"
            :key="idx"
            type="button"
            class="day"
            :class="{
              blank: !c,
              today: c?.isToday,
              selected: c?.isSelected,
              'has-pending': (c?.pending || 0) > 0,
              'has-only-dismissed': !!c && c.total > 0 && c.pending === 0,
            }"
            :disabled="!c"
            :title="c && c.total ? `${c.date} · ${c.total} 项事项` : c?.date"
            @click="c && emit('select', c.date)"
          >
            <span class="num">{{ c?.day }}</span>
            <span v-if="c && c.total" class="marks">
              <i v-for="n in Math.min(c.total, 3)" :key="n" class="dot" :class="n <= c.pending ? 'legend-pending' : 'legend-dismissed'"></i>
              <i v-if="c.hasRepeat" class="repeat-flag" title="每年重复">↻</i>
            </span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.sec-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.sec-head h2 { font-size: 15px; margin: 0 0 4px; }
.sec-head p { margin: 0; font-size: 12.5px; }
.legend { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); flex-wrap: wrap; }
.legend .dot, .legend .ring { margin-left: 8px; }
.months { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
.month { border: 1px solid var(--line); border-radius: 10px; padding: 8px 9px 10px; background: #fcfcfd; }
.month-empty { opacity: .78; }
.month-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 12.5px; }
.week-head { display: grid; grid-template-columns: repeat(7, 1fr); font-size: 10.5px; color: var(--muted); text-align: center; margin-bottom: 2px; }
.days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.day {
  position: relative; aspect-ratio: 1 / 1; min-height: 26px; border: 1px solid transparent; background: transparent;
  border-radius: 7px; font-size: 11.5px; color: var(--text); cursor: pointer; display: flex;
  flex-direction: column; align-items: center; justify-content: center; padding: 0; line-height: 1;
}
.day.blank { visibility: hidden; cursor: default; }
.day:hover:not(.blank) { background: #eef2ff; }
.day.today { border-color: #2f6fed; }
.day.selected { background: #e8efff; border-color: #2f6fed; font-weight: 600; }
.day.has-pending { color: #b42318; font-weight: 600; }
.day.has-only-dismissed { color: #475467; }
.marks { display: flex; align-items: center; gap: 2px; margin-top: 2px; height: 6px; }
.dot { width: 4px; height: 4px; border-radius: 50%; display: inline-block; }
.legend-pending { background: #e5484d; }
.legend-dismissed { background: #c0c5cf; }
.ring { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid #2f6fed; display: inline-block; }
.repeat-flag { font-size: 8px; color: #2f6fed; line-height: 1; font-style: normal; }
.chip { font-size: 10.5px; padding: 1px 6px; border-radius: 999px; background: #eef0f4; color: var(--muted); }
.chip-pending { background: #fdeceb; color: #b42318; }
.chip-none { background: transparent; color: #b6bcc7; }
</style>
