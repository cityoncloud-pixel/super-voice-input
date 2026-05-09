# Goal-Driven AI Engineering Harness (GAEH)
## v1.0 Implementation Specification

---

# Review Gate (Pre-output Self Review)

## Review Decision: PASS (with constrained scope)

### Checked

- [x] Role boundary is explicit (Owner vs AI)
- [x] Supports Cursor / Codex shared workflow
- [x] Has task routing mechanism
- [x] Has loop breaker
- [x] Has rollback mechanism
- [x] Has alternative path mechanism
- [x] Has research + fallback mechanism
- [x] Has drift correction mechanism
- [x] Has file-driven persistence
- [x] Has next-step autonomous progression

### Scope intentionally excluded (v1)

- SaaS orchestration
- distributed multi-agent runtime
- cloud queueing
- CI/CD integration
- multi-user collaboration

This spec is scoped for local project engineering harness.

---

# 1. System Definition

Goal-Driven AI Engineering Harness (GAEH)

Core principle:

> Owner defines goals and acceptance.
> AI owns engineering decomposition, planning, execution, review, verification, correction and next-step progression.

Owner is strategic.

AI is operational.

---

# 2. Role Boundary

## Owner Responsibilities

Allowed:

- define goal
- define expected user experience
- approve/reject product results
- decide product trade-offs

Forbidden:

- technical decomposition
- architecture decomposition
- implementation details
- task splitting
- testing strategy
- deciding next technical step

---

## AI Responsibilities

Must own:

- goal intake
- task classification
- spec generation
- plan generation
- review
- execution
- verification
- drift correction
- rollback decision
- alternative path search
- external research
- fallback routing
- next-step continuation

---

# 3. System Architecture

```text
Owner Goal
    ↓
Intake Agent
    ↓
Classifier Agent
    ↓
Router Agent
    ↓
Spec Agent (if needed)
    ↓
Review Agent
    ↓
Planner Agent
    ↓
Review Agent
    ↓
Executor Agent
    ↓
Verify Agent
    ↓
Diff Review Agent
    ↓
Drift Guard
    ↓
Loop Breaker
    ↓
Rollback Manager
    ↓
Alternative Path Finder
    ↓
Research Layer
    ↓
Fallback Layer
    ↓
Next-Step Decision Engine
    ↓
Continue / Stop / Ask Owner
```

---

# 4. Routing System

Not all tasks need Spec.

## Route A — Tiny Fix

Use when:

- single file
- UI text
- styling
- isolated bug

Flow:

Goal → Plan → Execute → Verify

---

## Route B — Normal Task

Use when:

- local feature
- UI + state
- simple API

Flow:

Goal → Task Spec → Plan → Execute → Verify

---

## Route C — Architecture Task

Use when:

- schema changes
- backend changes
- storage changes
- cross-module changes

Flow:

Goal → Full Spec → Review → Plan → Review → Execute → Verify

---

## Route D — Phase Task

Use when:

- large system
- subsystem construction
- multiple dependent tasks

Flow:

Goal → Phase Spec → Task Queue → iterative execution

---

# 5. Core File System

```text
/project_control
    goal.md
    owner_preferences.md
    product_vision.md
    phase_status.md
    current_task.md
    task_queue.json
    backlog.md
    recent_reports.md
    decision_log.md

/ai_harness
    harness_rules.md
    routing_rules.md
    reviewer_rules.md
    execution_rules.md
    verification_rules.md
    rollback_rules.md
    loop_rules.md
    fallback_rules.md
    drift_guard_rules.md

/specs
/plans
/reviews
/reports
```

---

# 6. Core File Definitions

## goal.md

Owner-owned.

Contains:

- product goal
- desired experience
- acceptance

---

## product_vision.md

North Star.

Defines:

- product identity
- core value
- long-term direction

---

## phase_status.md

Defines:

- current phase
- current phase goal
- done criteria
- forbidden work

---

## current_task.md

Machine-active task.

Defines:

- task goal
- task scope
- task acceptance

---

## task_queue.json

AI-owned task queue.

Contains:

- task ids
- dependency graph
- route type
- status

---

## decision_log.md

Records:

- why decisions were made
- route changes
- rollback reasons
- architecture changes

---

# 7. Agent Definitions

## Intake Agent

Input:

goal.md

Output:

normalized engineering goal

---

## Classifier Agent

Determines:

- task type
- complexity
- risk
- route

Output:

classification report

---

## Spec Agent

Produces:

spec.md

Only when required.

---

## Planner Agent

Produces:

plan.md

Defines:

- steps
- files
- validation

---

## Reviewer Agent

Reviews:

- spec
- plan
- diff

Returns:

PASS / REVISE / BLOCK

---

## Executor Agent

Executes plan.

Must not expand scope.

---

## Verify Agent

Checks:

- functionality
- tests
- compatibility

Returns:

PASS / FAIL

---

## Drift Guard

Checks:

- goal alignment
- phase alignment
- scope drift

Returns:

ON_TRACK / DRIFTING / OFF_TRACK

---

# 8. Loop Breaker Mechanism

Purpose:

Prevent infinite repair loops.

Trigger:

- same failure twice
- same test failing twice
- repeated patching with no progress

Policy:

1st failure → patch

2nd failure → diagnose

3rd failure → block original path

Actions:

- re-plan
- alternative path
- rollback

---

# 9. Rollback System

## Soft Rollback

Partial file rollback.

Use when:

small localized issue.

---

## Task Rollback

Entire task rollback.

Use when:

task polluted system.

---

## Strategy Rollback

Plan-level rollback.

Use when:

approach is fundamentally wrong.

---

Rollback triggers:

- core flow broken
- data corruption risk
- contract violation
- scope drift

---

# 10. Alternative Path Mechanism

When current path fails:

AI must generate:

## Path A

Minimal patch

---

## Path B

Local redesign

---

## Path C

Degraded fallback

---

Selection priority:

A → B → C

Owner only involved if product trade-off exists.

---

# 11. Research Layer

Purpose:

Get latest information.

Use when:

- framework changed
- API changed
- dependency mismatch
- official docs changed

Priority:

1. official docs
2. release notes
3. official GitHub
4. issue tracker
5. community

Output:

updated solution proposal

---

# 12. Fallback Layer

Every external dependency must define:

Primary path

Fallback path

Degraded path

Examples:

Primary model fails → backup model

Primary API fails → secondary API

Video generation fails → storyboard fallback

TTS fails → subtitle fallback

---

# 13. Autonomous Progression Rules

AI must continue automatically when:

- next task is clear
- no product trade-off needed
- no owner decision required

AI must ask owner only when:

- UX trade-off needed
- product goal conflict
- destructive migration
- impossible constraint

AI must never ask:

- implementation detail questions
- architecture detail questions

---

# 14. Review Gates

## Spec Gate

Checks:

problem clarity
acceptance clarity
scope clarity

---

## Plan Gate

Checks:

execution quality
scope fit
testability

---

## Execution Gate

Checks:

actual completion
scope discipline

---

## Verify Gate

Checks:

works correctly
tests pass
compatible

---

## Drift Gate

Checks:

still aligned

---

# 15. State Machine

```text
goal_intake
→ classified
→ routed
→ spec_drafting
→ spec_reviewing
→ spec_approved
→ planning
→ plan_reviewing
→ plan_approved
→ executing
→ verifying
→ diff_reviewing
→ reporting
→ next_task_decision
→ completed
```

Error states:

```text
blocked
rollback_required
alternative_path_required
research_required
owner_decision_required
```

---

# 16. Execution Workflow

Standard invocation:

Step 1:

Owner writes:

goal.md

Step 2:

AI reads goal

Step 3:

AI classifies

Step 4:

AI routes

Step 5:

AI creates task queue

Step 6:

AI executes current task

Step 7:

AI verifies

Step 8:

AI reports

Step 9:

AI selects next task

Step 10:

Repeat

---

# 17. Cursor / Codex Unified Driving Method

Shared command:

Read /project_control and /ai_harness.

Act as Goal-Driven AI Engineering Harness.

Do not ask technical implementation questions.

Classify goal.

Build task queue.

Select next task.

Execute according to route.

Verify.

Report.

Choose next step.

Only ask owner for product decisions.

---

# 18. Construction Path (Implementation Path)

Phase 1:

Create file system

---

Phase 2:

Write harness_rules.md

---

Phase 3:

Implement intake + classifier

---

Phase 4:

Implement spec/planner/reviewer prompts

---

Phase 5:

Implement loop breaker

---

Phase 6:

Implement rollback rules

---

Phase 7:

Implement drift guard

---

Phase 8:

Implement research/fallback layer

---

Phase 9:

Run on real project

---

# 19. MVP Recommendation

Minimum viable harness:

Required:

goal.md
phase_status.md
current_task.md
task_queue.json
harness_rules.md

Recommended:

decision_log.md
backlog.md

---

# 20. Final Principle

Owner owns:

Goal
Experience
Acceptance

AI owns:

Engineering.

This is the operating law.

