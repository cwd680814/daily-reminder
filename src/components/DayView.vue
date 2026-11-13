<script setup lang="ts">
import { computed } from 'vue'
import ItemForm from './ItemForm.vue'
import { type Occurrence, type ReminderItem, formatCN, weekdayCN } from '../lib/reminder'

const props = defineProps<{
  date: string
  occurrences: Occurrence[]
  editing: ReminderItem | null
  /** 该日期上全部事项（跨年，用于提示"其他年份同日"） */
  relatedYears: number[]
}>()

const emit = defineEmits<{
  (e: 'submit', payload: { title: string; note: string; date: string; repeatYearly: boolean }): void
  (e: 'cancel'): void
  (e: 'edit', item: ReminderItem): void
  (e: 'remove', itemId: string): void
  (e: 'dismiss', itemId: string, occurrence: string): void
  (e: 'restore', itemId: string, occurrence: string): void
}>()

const pendingCount = computed(() => props.occurrences.filter(o => o.status === 'pending').length)
const dismissedCount = computed(() => props.occurrences.filter(o => o.status === 'dismissed').length)
</script>

<template>
  <section class="card day-view">
    <header class="sec-head">
      <div>
        <h2>📅 {{ formatCN(date) }} · {{ weekdayCN(date) }}</h2>
        <p class="muted">
          这一天共 {{ occurrences.length }} 项事项<span v-if="pendingCount">，其中 <b class="hot">{{ pendingCount }}</b> 项待提醒</span><span v-if="dismissedCount">，{{ dismissedCount }} 项已关闭</span>
        </p>
      </div>
    </header>

    <div v-if="!occurrences.length" class="empty-line">这一天还没有事项，用下面的录入区添加。</div>

    <ul v-else class="list">
      <li v-for="o in occurrences" :key="o.itemId + o.occurrence" class="row" :class="o.status">
        <div class="main">
          <div class="title-line">
            <span class="title">{{ o.item.title }}</span>
            <span v-if="o.item.repeatYearly" class="tag tag-repeat">↻ 每年重复</span>
            <span v-if="o.leapAdjusted" class="tag tag-leap">2/29 → 2/28</span>
            <span class="badge" :class="o.status === 'pending' ? 'b-pending' : 'b-dismissed'">
              {{ o.status === 'pending' ? '待提醒' : '已关闭' }}
            </span>
          </div>
          <div v-if="o.item.note" class="note">{{ o.item.note }}</div>
          <div class="meta">
            原始日期 {{ o.item.date }}
            <template v-if="relatedYears.length > 1"> · 同年同日还有 {{ relatedYears.filter(y => y !== o.year).join('、') }} 年</template>
          </div>
        </div>
        <div class="ops">
          <button v-if="o.status === 'pending'" type="button" class="btn xs" @click="emit('dismiss', o.itemId, o.occurrence)">关闭本次</button>
          <button v-else type="button" class="btn xs" @click="emit('restore', o.itemId, o.occurrence)">撤销关闭</button>
          <button type="button" class="btn xs" @click="emit('edit', o.item)">编辑</button>
          <button type="button" class="btn xs danger" @click="emit('remove', o.itemId)">删除</button>
        </div>
      </li>
    </ul>

    <ItemForm :date="date" :editing="editing" @submit="emit('submit', $event)" @cancel="emit('cancel')" />

    <p class="hint">
      「关闭本次」只作用于 {{ date }} 这天的这一次提醒：同一条每年重复事项在往后的年份仍会照常提醒，其他日期也不受影响。
    </p>
  </section>
</template>

<style scoped>
.sec-head { margin-bottom: 10px; }
.sec-head h2 { font-size: 15px; margin: 0 0 4px; }
.sec-head p { margin: 0; font-size: 12.5px; }
.hot { color: #b42318; }
.empty-line { font-size: 12.5px; color: var(--muted); padding: 10px 0 14px; }
.list { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.row { display: flex; justify-content: space-between; gap: 10px; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; background: #fff; }
.row.dismissed { background: #fafbfc; }
.row.pending { border-left: 3px solid #e5484d; }
.title-line { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.title { font-size: 13.5px; font-weight: 600; }
.row.dismissed .title { color: #667085; font-weight: 500; }
.note { font-size: 12.5px; color: #475467; margin-top: 4px; }
.meta { font-size: 11px; color: var(--muted); margin-top: 5px; }
.ops { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex-shrink: 0; }
.tag { font-size: 10.5px; padding: 1px 6px; border-radius: 999px; }
.tag-repeat { background: #eef4ff; color: #1d4ed8; }
.tag-leap { background: #fff6e0; color: #b54708; }
.badge { font-size: 10.5px; padding: 1px 7px; border-radius: 999px; border: 1px solid transparent; }
.b-pending { background: #fdeceb; color: #b42318; border-color: #f8c9c6; }
.b-dismissed { background: #f2f4f7; color: #667085; border-color: #e4e7ec; }
.hint { font-size: 11.5px; color: var(--muted); margin: 10px 0 0; }
@media (max-width: 760px) {
  .row { flex-direction: column; }
  .ops { justify-content: flex-end; }
}
</style>
