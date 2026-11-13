<script setup lang="ts">
import { computed } from 'vue'
import type { Occurrence } from '../lib/reminder'
import { formatCN, weekdayCN } from '../lib/reminder'

const props = defineProps<{
  open: boolean
  queue: Occurrence[]
}>()

const emit = defineEmits<{
  (e: 'dismiss', itemId: string, occurrence: string): void
  (e: 'dismissAll'): void
  (e: 'close'): void
}>()

const current = computed(() => props.queue[0] || null)
const rest = computed(() => props.queue.slice(1))
</script>

<template>
  <div v-if="open && queue.length" class="mask" role="dialog" aria-modal="true" aria-label="事项提醒">
    <div class="dialog">
      <div class="head">
        <span class="bell">🔔</span>
        <div>
          <div class="kicker">00:00 事项提醒</div>
          <div class="when">{{ current ? formatCN(current.occurrence) + ' · ' + weekdayCN(current.occurrence) : '' }}</div>
        </div>
        <span class="count">待关闭 {{ queue.length }}</span>
      </div>

      <div v-if="current" class="body">
        <div class="title">{{ current.item.title }}</div>
        <div v-if="current.item.note" class="note">{{ current.item.note }}</div>
        <div class="tags">
          <span v-if="current.item.repeatYearly" class="tag">↻ 每年重复</span>
          <span v-else class="tag">仅此一次</span>
          <span v-if="current.leapAdjusted" class="tag">2/29 → 平年 2/28</span>
          <span class="tag tag-state">待提醒</span>
        </div>
      </div>

      <div v-if="rest.length" class="rest">
        <div class="rest-title">还有 {{ rest.length }} 条今日提醒</div>
        <ul>
          <li v-for="o in rest" :key="o.itemId + o.occurrence">{{ o.item.title }}</li>
        </ul>
      </div>

      <div class="actions">
        <button
          v-if="current"
          type="button"
          class="btn primary"
          @click="emit('dismiss', current.itemId, current.occurrence)"
        >
          知道了（仅关闭本次）
        </button>
        <button v-if="queue.length > 1" type="button" class="btn" @click="emit('dismissAll')">全部关闭</button>
        <button type="button" class="btn ghost" @click="emit('close')">稍后再说</button>
      </div>

      <p class="foot">
        关闭只针对本次（{{ current?.occurrence }}），不会影响同一条事项在明年或其他日期的提醒。
      </p>
    </div>
  </div>
</template>

<style scoped>
.mask { position: fixed; inset: 0; background: rgba(16, 24, 40, .45); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 1000; }
.dialog { width: 100%; max-width: 420px; background: #fff; border-radius: 14px; box-shadow: 0 20px 48px rgba(16, 24, 40, .24); padding: 16px 18px 14px; animation: pop .16s ease-out; }
@keyframes pop { from { transform: translateY(6px) scale(.98); opacity: 0; } to { transform: none; opacity: 1; } }
.head { display: flex; align-items: center; gap: 10px; }
.bell { font-size: 22px; }
.kicker { font-size: 11.5px; color: #b42318; font-weight: 600; letter-spacing: .3px; }
.when { font-size: 12px; color: var(--muted); margin-top: 1px; }
.count { margin-left: auto; font-size: 11px; color: #667085; background: #f2f4f7; border-radius: 999px; padding: 2px 8px; }
.body { margin-top: 12px; border: 1px solid var(--line); border-radius: 10px; padding: 12px; background: #fffafa; }
.title { font-size: 16px; font-weight: 700; line-height: 1.4; }
.note { font-size: 13px; color: #475467; margin-top: 6px; line-height: 1.55; }
.tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
.tag { font-size: 10.5px; padding: 1px 7px; border-radius: 999px; background: #f2f4f7; color: #475467; }
.tag-state { background: #fdeceb; color: #b42318; }
.rest { margin-top: 12px; font-size: 12px; color: #475467; }
.rest-title { color: var(--muted); margin-bottom: 4px; }
.rest ul { margin: 0; padding-left: 18px; }
.actions { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
.actions .btn { flex: 1 1 auto; }
.ghost { background: #fff; }
.foot { font-size: 11px; color: var(--muted); margin: 10px 0 0; line-height: 1.5; }
</style>
