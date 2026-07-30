/**
 * OKF v0.2 Attested Computation contracts (spec §10).
 *
 * An Attested Computation concept carries not just what a value *means* but a
 * sanctioned way to compute it, so a consumer can confirm the agent ran the
 * blessed computation instead of improvising its own. This module models the
 * contract; it does not execute anything — OKF records the computation and the
 * means to check it, and stops there (§10).
 *
 * Browser-safe (no node imports), per the @okf/core rules in CLAUDE.md.
 */

export const ATTESTED_COMPUTATION_TYPE = 'attested computation';

/** A typed, named hole the agent may fill — and the only thing it may fill. */
export interface Parameter {
  name: string;
  type?: string;
  required?: boolean;
}

export interface Executor {
  /** Run instructions or code a runner follows. Conventionally under `references/`. */
  resource?: string;
  /** Fields a run must return: the evidence the attester inspects. */
  receipt: string[];
}

export interface Attester {
  /** Deterministic code (no LLM) that takes a receipt and returns a verdict. */
  resource?: string;
}

export interface Computation {
  /**
   * REQUIRED for this type. Defines what `parameters` mean — a SQL bind
   * variable, a dbt var, a Python argument — and so how the executor and
   * attester interpret them.
   */
  runtime?: string;
  parameters: Parameter[];
  /**
   * Frontmatter `computation`: a path to a file holding the computation, used
   * instead of an inline body fence (§10.3). Absent ⇒ the body's
   * `# Computation` section is the computation.
   */
  path?: string;
  executor?: Executor;
  attester?: Attester;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String);
}

function parseParameters(value: unknown): Parameter[] {
  if (!Array.isArray(value)) return [];
  const params: Parameter[] = [];
  for (const entry of value) {
    const rec = asRecord(entry);
    if (!rec) continue;
    const name = rec.name;
    if (typeof name !== 'string' || !name.trim()) continue;
    params.push({
      name,
      ...(rec.type != null ? { type: String(rec.type) } : {}),
      ...(rec.required != null ? { required: Boolean(rec.required) } : {}),
    });
  }
  return params;
}

/** True for the Attested Computation type, compared case-insensitively. */
export function isAttestedComputation(type: unknown): boolean {
  return typeof type === 'string' && type.trim().toLowerCase() === ATTESTED_COMPUTATION_TYPE;
}

/**
 * Read the contract from a concept's frontmatter, or undefined when the concept
 * is not an Attested Computation. Every other type is left untouched.
 */
export function parseComputation(data: Record<string, unknown>): Computation | undefined {
  if (!isAttestedComputation(data.type)) return undefined;

  const executorRec = asRecord(data.executor);
  const attesterRec = asRecord(data.attester);

  return {
    ...(typeof data.runtime === 'string' && data.runtime.trim() ? { runtime: data.runtime } : {}),
    parameters: parseParameters(data.parameters),
    ...(typeof data.computation === 'string' && data.computation.trim()
      ? { path: data.computation }
      : {}),
    ...(executorRec
      ? {
          executor: {
            ...(typeof executorRec.resource === 'string' ? { resource: executorRec.resource } : {}),
            receipt: toStringArray(executorRec.receipt),
          },
        }
      : {}),
    ...(attesterRec
      ? {
          attester: {
            ...(typeof attesterRec.resource === 'string' ? { resource: attesterRec.resource } : {}),
          },
        }
      : {}),
  };
}
