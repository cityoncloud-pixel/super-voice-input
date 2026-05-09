# Drift Guard Rules (AI-owned)

Every major step must check:
- 是否仍对齐 `project_control/goal.md`
- 是否违反 `project_control/phase_status.md` 的 Forbidden Work

Return:
- ON_TRACK / DRIFTING / OFF_TRACK

Action:
- DRIFTING: 停止扩张，回到 acceptance
- OFF_TRACK: 触发 rollback_required 或 owner_decision_required

