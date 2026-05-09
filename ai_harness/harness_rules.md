# GAEH Harness Rules (AI-owned)

## 0) Operating Law (Role Boundary)
- Owner owns: Goal / Scope boundaries / Acceptance / UX & product tradeoffs / approvals.
- AI owns: engineering decomposition / spec & plan / implementation / verification / reporting / fixing.

## 1) Non-negotiables
- File-driven persistence: do not rely on chat memory; treat `project_control/` as source of truth.
- No silent scope expansion: any new work must be reflected in `project_control/goal.md` or `project_control/change_requests.md`, and logged in `project_control/decision_log.md`.
- No product decisions by AI: if a choice affects UX, business rules, or scope boundaries, ask Owner.
- Every cycle must produce artifacts: plan/spec (as needed), verification result, report, and next-step.

## 2) Core Artifacts (Must Use)
- Goal: `project_control/goal.md`
- Phase: `project_control/phase_status.md`
- Queue: `project_control/task_queue.json`
- Decisions: `project_control/decision_log.md`
- Owner approvals: `project_control/approval.json`
- Change requests: `project_control/change_requests.md`
- Issues / bug reports: `project_control/issues.md`
- Specs: `specs/*.spec.md`
- Plans: `plans/*.plan.md`
- Reviews: `reviews/*.review.md`
- Reports: `reports/*.report.md`

## 3) Consent Gate (Owner Approval Required)
Before starting continuous execution for a goal, AI must obtain explicit Owner approval.

Approved if any of the following is true:
- Owner replies in chat with token `APPROVE` (optionally `APPROVE <task_id>`), OR
- `project_control/approval.json` has a `PENDING` item for `start_execution` switched to `APPROVED`.

If not approved:
- AI may only ask clarifying questions and draft spec/plan proposals.
- AI must not implement code changes beyond non-destructive inspection and documentation edits.

## 4) Goal Clarity First (Boundary + UI Focus)
If `project_control/goal.md` is incomplete or has UNKNOWNs:
- Ask the smallest set of questions that unblock verifiable acceptance and clear boundaries.
- Prioritize boundary ambiguity and UI/interaction requirements over tech-stack preferences.
- If Owner cannot answer, proceed with best-effort assumptions and record them in `project_control/.ggs/assumptions.md` (when GGS exists) or `project_control/decision_log.md`.

## 5) Phase Completion & New Requirements
After a phase/task is done:
- Summarize what is completed and how it was verified in `reports/*.report.md`.
- If Owner adds new requirements, capture them in `project_control/change_requests.md`.
- AI must (a) re-check scope/acceptance, (b) propose goal updates when necessary, and (c) re-request approval before executing new work.

## 6) When “Done” Still Has Problems (Triage & Fix)
If Owner reports issues (or updates `project_control/issues.md`):
- Produce a hypothesis list (most likely first) + evidence to collect.
- Identify the root cause, document it in `reports/*.report.md`, and fix it.
- Add regression verification steps and re-run minimal checks.

