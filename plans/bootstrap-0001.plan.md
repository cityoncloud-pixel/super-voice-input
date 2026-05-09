# Plan: bootstrap-0001 — GAEH Skeleton

## Goal
在当前项目根目录落地 GAEH v1.0 最小骨架，确保可开始第一次“Goal→Route→Plan→Execute→Verify”循环。

## Steps
1. 创建核心目录：`project_control/`, `ai_harness/`, `specs/`, `plans/`, `reviews/`, `reports/`
2. 写入最小控制文件：`goal.md`, `phase_status.md`, `current_task.md`, `task_queue.json`
3. 写入规则文件：`ai_harness/*.md`
4. 提供入口文档：`README.md`
5. 做一次一致性自检（路径存在、队列字段一致）

## Verification
- `task_queue.json` 解析正常
- `current_task_id` 指向存在的 task
- artifacts 路径在仓内且文件存在（plan/review/report）

