<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ReminderItem } from '../lib/reminder'

const props = defineProps<{
  date: string
  editing: ReminderItem | null
}>()

const emit = defineEmits<{
  (e: 'submit', payload: { title: string; note: string; date: string; repeatYearly: boolean }): void
  (e: 'cancel'): void
}>()

const title = ref('')
const note = ref('')
const date = ref(props.date)
const repeatYearly = ref(false)
const error = ref('')

function sync() {
  if (props.editing) {
    title.value = props.editing.title
    note.value = props.editing.note
    date.value = props.editing.date
    repeatYearly.value = props.editing.repeatYearly
  } else {
    title.value = ''
    note.value = ''
    date.value = props.date
    repeatYearly.value = false
  }
  error.value = ''
}

watch(() => props.editing, sync, { immediate: true })
watch(() => props.date, () => {
  if (!props.editing) date.value = props.date
})

const isEditing = computed(() => !!props.editing)

function submit() {
  const t = title.value.trim()
  if (!t) {
    error.value = '请填写事项内容'
    return
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date.value)) {
    error.value = '请选择有效日期'
    return
  }
  error.value = ''
  emit('submit', { title: t, note: note.value.trim(), date: date.value, repeatYearly: repeatYearly.value })
}
</script>

<template>
  <div class="form">
    <div class="form-head">
      <b>{{ isEditing ? '编辑事项' : '新增事项' }}</b>
      <span class="muted">日期默认取当前选中日，可改成一年中的任意一天</span>
    </div>

    <div class="grid">
      <label class="field field-title">
        <span>事项内容 <em>*</em></span>
        <input v-model="title" maxlength="60" placeholder="例如：妈妈生日 / 交物业费" @keyup.enter="submit" />
      </label>

      <label class="field">
        <span>日期</span>
        <input v-model="date" type="date" />
      </label>

      <label class="field field-repeat">
        <span>重复</span>
        <label class="check">
          <input v-model="repeatYearly" type="checkbox" />
          每年重复（同月同日）
        </label>
      </label>

      <label class="field field-note">
        <span>备注</span>
        <input v-model="note" maxlength="120" placeholder="可选，会一起显示在提醒弹窗里" @keyup.enter="submit" />
      </label>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="actions">
      <button type="button" class="btn primary" @click="submit">{{ isEditing ? '保存修改' : '添加到日程' }}</button>
      <button v-if="isEditing" type="button" class="btn" @click="emit('cancel')">取消编辑</button>
      <span class="muted tip">每年重复的事项只存一条，按年自动展开到每年同一天</span>
    </div>
  </div>
</template>

<style scoped>
.form { border: 1px dashed var(--line); border-radius: 10px; padding: 12px; background: #fbfcfe; }
.form-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
.form-head b { font-size: 13.5px; }
.form-head .muted { font-size: 12px; }
.grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; }
.field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted); }
.field span { font-size: 12px; }
.field em { color: #d92d20; font-style: normal; }
.field input[type='text'], .field input:not([type]) { }
.field input { border: 1px solid var(--line); border-radius: 8px; padding: 7px 9px; font-size: 13px; background: #fff; color: var(--text); }
.field input:focus { outline: 2px solid #cddafd; border-color: #7ea6f8; }
.field-note { grid-column: 1 / -1; }
.check { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--text); padding: 7px 0; }
.error { color: #b42318; font-size: 12px; margin: 8px 0 0; }
.actions { display: flex; align-items: center; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.tip { font-size: 11.5px; }
@media (max-width: 760px) {
  .grid { grid-template-columns: 1fr 1fr; }
  .field-title { grid-column: 1 / -1; }
  .field-repeat { grid-column: 1 / -1; }
}
</style>
