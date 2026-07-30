# 016 — Render `Attested Computation` concepts

- **Status**: TODO
- **Commit**: 4ae3ca5 (all excerpts verified against the tree)
- **Severity**: MED (v0.2's headline addition renders as an untyped generic concept)
- **Category**: Feature / spec conformance
- **Estimated scope**: `packages/okf-core/src/core.ts` (contract fields), a
  `ComputationContract` component, concept-page branch.
- **Depends on**: 013

## Problem

OKF v0.2 §10 adds `type: Attested Computation`: a concept that carries not just what a number
*means* but the sanctioned way to compute it, so a consumer can confirm an agent ran the blessed
computation instead of improvising its own SQL. Its contract lives in frontmatter:

    runtime: bigquery                # REQUIRED for this type
    parameters:
      - { name: year, type: integer, required: true }
    executor:
      resource: references/skills/run-on-bq.md
      receipt: [job_id, executed_sql, result]
    attester:
      resource: references/attesters/revenue.py

The reader models none of these fields (`grep -rl 'Attested Computation' src packages` → 0 files),
so `computations/revenue-ytd.md` in upstream `acme_retail` renders as an ordinary concept: title,
description, prose body. The contract that makes it *attested* — what runtime it targets, what
parameters a caller may fill, what evidence a run must return, what code checks it — is invisible.

This matters more than a missing badge. The whole point of §10 is that an agent may supply
*values* for declared parameters and must never author or edit the computation. A reader that
shows the SQL without showing that boundary invites exactly the misuse the type exists to prevent.

## Target

### A. Carry the contract (extends 013's model work)

    // target — packages/okf-core/src/core.ts
    export interface Parameter { name: string; type?: string; required?: boolean }

    export interface Computation {
      runtime?: string;
      parameters: Parameter[];
      computation?: string;                          // path form (§10.3), when not an inline fence
      executor?: { resource?: string; receipt: string[] };
      attester?: { resource?: string };
    }

    // on Concept:
    computation?: Computation;   // present only for type: Attested Computation

Populate it only when `type` is `Attested Computation` (case-insensitively compared), leaving
every other concept untouched.

### B. `ComputationContract` component on the concept page

Rendered above the body when `concept.computation` is present:

- **Runtime** as a badge — it is what defines whether a parameter is a SQL bind variable, a dbt
  var, or a Python argument (§10.2), so it belongs next to the parameters, not buried.
- **Parameters** as a small table: name, type, required.
- **Executor / attester** as links when their `resource` resolves in the bundle (they conventionally
  point into `references/`, §6.3), plain text otherwise. Show `executor.receipt` as the declared
  evidence fields.
- A short, plain-language note that a caller may only supply parameter values and must not rewrite
  the computation. Copy should state the rule, not lecture.
- When `computation:` names a file rather than an inline `# Computation` fence, link that file.

### C. Cross-links

A `Metric` links to its computation with an ordinary markdown link (§10.4), so backlinks already
connect them — no new graph work. Consider surfacing "used by" on the computation page from the
existing `backlinks` map, which is a one-liner given the current model.

## Verification

- `bun test`: contract parsed for `type: Attested Computation`; `computation` undefined for every
  other type; a bare/missing `parameters` yields `[]`; `receipt` defaults to `[]`.
- Browser pass against upstream `acme_retail`, which has two Attested Computations
  (`computations/revenue-ytd`, `computations/gross-margin-period`) — one with `parameters`, both
  with executor and attester, plus a legacy metric that deliberately has **no** computation, which
  should render unchanged.
- `bun run typecheck && bun test && bun run build && bun run e2e`.

## Out of scope

- **Executing anything.** OKF records the computation and the means to check it; it does not run
  it (§10). The reader displays a contract, it does not become a runner.
- Receipt/verdict wire formats — spec §12 explicitly defers these to a future revision.
