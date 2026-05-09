# Loop Breaker Rules (AI-owned)

Trigger:
- 同一失败重复两次（同一测试/同一报错/同一路径）

Policy:
1) 第 1 次失败：小修补
2) 第 2 次失败：诊断 + 重写 plan
3) 第 3 次失败：BLOCK 当前路径 → Alternative Path / Rollback

