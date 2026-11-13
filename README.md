# 每日事项提示器

按年份浏览、按日期录入每日事项，支持「每年重复」，并在事项日期当天**本地时间 00:00** 自动弹窗提醒。
纯前端单机应用：数据保存在浏览器 localStorage，无需任何后端，开箱即可运行。

## 功能

- **年度视图**：12 个月日历一览，有事项的日期标出小圆点（红点=待提醒，灰点=已关闭），点击任意日期进入日期视图；
- **日期视图**：查看/管理某一天的全部事项，支持编辑、删除、关闭本次提醒、撤销关闭；
- **事项录入区**：事项内容、日期（一年中任意一天）、备注，可勾选「每年重复」（2 月 29 日在平年自动落到 2 月 28 日并标记）；
- **提醒弹窗**：到点自动弹出，展示事项内容与备注；点击「知道了（仅关闭本次）」只关闭**这一次**，不影响同一条事项在其他日期或后续年度的提醒，也不影响其他事项；
- **状态区分**：每条实例明确标注「待提醒 / 已关闭」，统计卡片与日历圆点同步展示；已关闭的可在列表中一键恢复；
- **测试提醒**：不看当前时间，直接把今天的待提醒弹出来，方便随时验证效果。

## 运行

```bash
npm install
npm run dev        # 开发模式，默认 http://127.0.0.1:5273/
npm test           # 运行 18 条核心逻辑单元测试
npm run build      # 构建到 dist/
npm run preview    # 预览构建产物
```

要求 Node.js ≥ 18。

## 提醒触发机制

- 触发时刻 = 事项日期当天 **本地时间 00:00:00**；
- 页面在 00:00 时保持打开 → 定时器到点立即弹出；
- 当天晚些时候才打开页面 → 同一天内补弹（catch-up），不会漏；
- 之前日期未关闭的提醒**不会补弹**（避免一开页面弹出一堆历史），但列表与统计里仍显示为「待提醒」，可手动关闭或恢复；
- 双保险定时：先 `setTimeout` 精确跳到下一个零点，再加 20 秒心跳，兜住系统休眠、改系统时间、定时器降频等场景。

## 「仅关闭本次」的实现

关闭记录的粒度是 `itemId + 具体日期`（occurrence）：

```
{ key: "it_xxx::2026-03-08", itemId: "it_xxx", occurrence: "2026-03-08", dismissedAt: "…" }
```

- 同一条每年重复事项在 2027-03-08 仍有独立状态，默认「待提醒」；
- 同一天的其他事项互不影响；
- 列表中可「撤销关闭」，把某一次恢复为待提醒。

## 项目结构

```
daily-reminder/
├── index.html                    # 入口 HTML
├── package.json                  # 依赖与脚本（vue / vite / vitest / typescript）
├── tsconfig.json
├── vite.config.ts                # 端口跟随 PORT，本地默认 5273
├── src/
│   ├── main.ts                   # 应用入口
│   ├── App.vue                   # 页面骨架：顶栏、统计、年份导航、视图编排、toast
│   ├── styles.css                # 全局样式（浅色主题，与家庭事务台同风格）
│   ├── components/
│   │   ├── YearView.vue          # 年度视图：12 个月日历 + 圆点标记
│   │   ├── DayView.vue           # 日期视图：当日事项列表与操作
│   │   ├── ItemForm.vue          # 事项录入区：内容/日期/每年重复/备注
│   │   └── ReminderModal.vue     # 00:00 提醒弹窗
│   ├── lib/
│   │   ├── reminder.ts           # 纯逻辑：年度展开、状态、到期判定、月历矩阵
│   │   └── store.ts              # 响应式状态 + localStorage 持久化 + 定时调度
└── tests/
    └── reminder.test.ts          # vitest 单元测试（18 条，覆盖核心规则）
```

## 技术选型

| 层 | 选择 | 理由 |
|---|---|---|
| 框架 | Vue 3 `<script setup>` + TypeScript | 与「家庭事务台」同栈，组件可复用、类型安全 |
| 构建 | Vite 5 | 开箱即用、秒级冷启动 |
| 状态 | 轻量自研 store（`reactive` + `computed`） | 规模小，不值得引入 Pinia |
| 持久化 | localStorage（key `daily-reminder.v1`） | 单机离线可用，零后端依赖 |
| 测试 | Vitest | 与 Vite 同生态，`npm test` 一条命令 |
| 时间 | 全部使用本地时区 `Date`（不用 `toISOString`） | 提醒语义是「本地时间 00:00」 |

## 数据模型

```ts
interface ReminderItem {
  id: string
  title: string
  note: string
  date: string          // 锚定日期 YYYY-MM-DD
  repeatYearly: boolean // 每年重复：只取月日，按年展开
  createdAt: string
  updatedAt: string
}

interface Dismissal {
  key: string        // `${itemId}::${occurrence}`
  itemId: string
  occurrence: string // 被关闭的那一次，YYYY-MM-DD
  dismissedAt: string
}
```

## License

MIT
