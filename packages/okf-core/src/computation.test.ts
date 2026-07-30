import { describe, expect, test } from 'bun:test';
import { buildBundle } from './core.ts';
import { isAttestedComputation, parseComputation } from './computation.ts';

const CONTRACT = [
  '---',
  'type: Attested Computation',
  'title: Revenue for fiscal year',
  'description: Recognized revenue.',
  'runtime: bigquery',
  'parameters:',
  '  - { name: year, type: integer, required: true }',
  'executor:',
  '  resource: references/skills/run-on-bq.md',
  '  receipt: [job_id, executed_sql, result]',
  'attester:',
  '  resource: references/attesters/revenue.py',
  '---',
  '',
  '# Computation',
  '',
  '    SELECT 1',
].join('\n');

describe('isAttestedComputation', () => {
  test('matches case-insensitively', () => {
    expect(isAttestedComputation('Attested Computation')).toBe(true);
    expect(isAttestedComputation('attested computation')).toBe(true);
    expect(isAttestedComputation('  Attested Computation  ')).toBe(true);
  });

  test('does not match other types', () => {
    expect(isAttestedComputation('Metric')).toBe(false);
    expect(isAttestedComputation(undefined)).toBe(false);
  });
});

describe('parseComputation', () => {
  test('reads the full contract', () => {
    const c = parseComputation({
      type: 'Attested Computation',
      runtime: 'bigquery',
      parameters: [{ name: 'year', type: 'integer', required: true }],
      executor: { resource: 'references/skills/run-on-bq.md', receipt: ['job_id', 'executed_sql'] },
      attester: { resource: 'references/attesters/revenue.py' },
    });
    expect(c).toEqual({
      runtime: 'bigquery',
      parameters: [{ name: 'year', type: 'integer', required: true }],
      executor: { resource: 'references/skills/run-on-bq.md', receipt: ['job_id', 'executed_sql'] },
      attester: { resource: 'references/attesters/revenue.py' },
    });
  });

  test('is undefined for every other type — nothing else grows a contract', () => {
    expect(parseComputation({ type: 'Metric', runtime: 'bigquery' })).toBeUndefined();
    expect(parseComputation({})).toBeUndefined();
  });

  test('missing parameters yields an empty list, not undefined', () => {
    expect(parseComputation({ type: 'Attested Computation' })?.parameters).toEqual([]);
  });

  test('parameters without a name are dropped', () => {
    const c = parseComputation({
      type: 'Attested Computation',
      parameters: [{ type: 'integer' }, { name: 'year' }, 'nonsense'],
    });
    expect(c?.parameters).toEqual([{ name: 'year' }]);
  });

  test('an executor without a receipt still yields an empty receipt list', () => {
    const c = parseComputation({
      type: 'Attested Computation',
      executor: { resource: 'references/skills/run.md' },
    });
    expect(c?.executor).toEqual({ resource: 'references/skills/run.md', receipt: [] });
  });

  test('the file form of the computation is read from `computation:`', () => {
    const c = parseComputation({
      type: 'Attested Computation',
      computation: 'references/computations/revenue.sql',
    });
    expect(c?.path).toBe('references/computations/revenue.sql');
  });

  test('a missing runtime is preserved as absent, not invented', () => {
    // §10.2 makes runtime REQUIRED for the type; surfacing its absence is the
    // reader's job, so the parser must not paper over it with a default.
    expect(parseComputation({ type: 'Attested Computation' })?.runtime).toBeUndefined();
  });
});

describe('buildBundle attaches the contract', () => {
  test('an Attested Computation concept carries it', () => {
    const bundle = buildBundle(new Map([['computations/revenue.md', CONTRACT]]), 'test');
    const c = bundle.byId.get('computations/revenue')!;
    expect(c.computation?.runtime).toBe('bigquery');
    expect(c.computation?.parameters).toEqual([{ name: 'year', type: 'integer', required: true }]);
    expect(c.computation?.executor?.receipt).toEqual(['job_id', 'executed_sql', 'result']);
    expect(c.computation?.attester?.resource).toBe('references/attesters/revenue.py');
  });

  test('an ordinary concept does not', () => {
    const bundle = buildBundle(
      new Map([['metrics/revenue.md', '---\ntype: Metric\ndescription: d\n---\nBody.']]),
      'test',
    );
    expect(bundle.byId.get('metrics/revenue')!.computation).toBeUndefined();
  });
});
