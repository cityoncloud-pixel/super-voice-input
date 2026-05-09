# Verification Rules (AI-owned)

Verify must return PASS/FAIL.

Minimum checks:
- 文件存在、链接一致（路径引用不破）
- 队列状态合理（current_task_id 存在且 status 匹配）

If project code exists:
- 跑最小相关测试（优先单测，其次 build/run smoke test）

## Tiny Fix (Route A) 最小验证清单
- UI/功能：手动走通 1 次核心路径，并记录在 report
- API：至少验证 1 次成功与 1 次失败（如 404/400）路径（若本次改动涉及 API）
- 数据/文件：若改动涉及写入/删除，必须验证落盘与清理正确（例如删记录同时删文件）
