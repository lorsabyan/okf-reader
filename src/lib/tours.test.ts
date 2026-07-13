import { describe, expect, test } from 'bun:test';
import { buildBundle } from './core';
import {
  firstUnvisitedStep,
  getTourSummaries,
  getTours,
  isTour,
  nextStep,
  prevStep,
  resolveTourSteps,
  stepIndex,
  toursForStep,
  tourButtonLabel,
  tourProgressKey,
} from './tours';

const files = new Map([
  [
    'tours/basics.md',
    '---\ntype: TOUR\ntitle: Basics\ndescription: A short tour.\nsteps:\n  - tables/orders\n  - tables/missing\n  - tables/customers\n---\nIntro body.',
  ],
  ['tables/orders.md', '---\ntype: Table\ntitle: Orders\n---\nOrders.'],
  ['tables/customers.md', '---\ntype: Table\ntitle: Customers\n---\nCustomers. See [orders](./orders.md).'],
  ['tables/plain.md', '---\ntype: Table\n---\nNot a tour, no steps.'],
  ['tours/empty-steps.md', '---\ntype: Tour\nsteps: []\n---\nNo steps, should not count as a tour.'],
]);
const bundle = buildBundle(files, 'test');
const tour = bundle.byId.get('tours/basics')!;

describe('isTour', () => {
  test('matches type: Tour case-insensitively with non-empty steps', () => {
    expect(isTour(tour)).toBe(true);
  });

  test('rejects a Tour-typed concept with an empty steps array', () => {
    expect(isTour(bundle.byId.get('tours/empty-steps')!)).toBe(false);
  });

  test('rejects ordinary concepts', () => {
    expect(isTour(bundle.byId.get('tables/plain')!)).toBe(false);
  });
});

describe('getTours / toursForStep', () => {
  test('getTours returns only tour concepts', () => {
    expect(getTours(bundle).map((c) => c.id)).toEqual(['tours/basics']);
  });

  test('toursForStep finds tours containing a given step', () => {
    expect(toursForStep(bundle, 'tables/orders').map((c) => c.id)).toEqual(['tours/basics']);
    expect(toursForStep(bundle, 'tables/plain')).toEqual([]);
  });
});

describe('stepIndex / nextStep / prevStep', () => {
  test('stepIndex finds the position of a step, -1 if absent', () => {
    expect(stepIndex(tour, 'tables/orders')).toBe(0);
    expect(stepIndex(tour, 'tables/customers')).toBe(2);
    expect(stepIndex(tour, 'nope')).toBe(-1);
  });

  test('nextStep/prevStep walk the list, including missing-concept steps', () => {
    expect(nextStep(tour, 'tables/orders')).toBe('tables/missing');
    expect(nextStep(tour, 'tables/customers')).toBeUndefined();
    expect(prevStep(tour, 'tables/customers')).toBe('tables/missing');
    expect(prevStep(tour, 'tables/orders')).toBeUndefined();
  });

  test('nextStep/prevStep return undefined for a concept not in the tour', () => {
    expect(nextStep(tour, 'nope')).toBeUndefined();
    expect(prevStep(tour, 'nope')).toBeUndefined();
  });
});

describe('resolveTourSteps', () => {
  test('resolves titles and marks the missing step as not existing', () => {
    expect(resolveTourSteps(bundle, tour)).toEqual([
      { id: 'tables/orders', title: 'Orders', exists: true },
      { id: 'tables/missing', title: 'tables/missing', exists: false },
      { id: 'tables/customers', title: 'Customers', exists: true },
    ]);
  });
});

describe('getTourSummaries', () => {
  test('builds a summary per tour with resolved steps', () => {
    const summaries = getTourSummaries(bundle);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ id: 'tours/basics', title: 'Basics', description: 'A short tour.' });
    expect(summaries[0].steps).toHaveLength(3);
  });
});

describe('firstUnvisitedStep / tourButtonLabel', () => {
  const steps = resolveTourSteps(bundle, tour);
  const existingIds = steps.filter((s) => s.exists).map((s) => s.id);

  test('with nothing visited: first existing step, label Start tour', () => {
    expect(firstUnvisitedStep(steps, [])).toBe('tables/orders');
    expect(tourButtonLabel(steps, [])).toBe('Start tour');
  });

  test('with the first existing step visited: next unvisited, label Continue', () => {
    expect(firstUnvisitedStep(steps, ['tables/orders'])).toBe('tables/customers');
    expect(tourButtonLabel(steps, ['tables/orders'])).toBe('Continue');
  });

  test('with all existing steps visited: falls back to the first, label Restart tour', () => {
    expect(firstUnvisitedStep(steps, existingIds)).toBe('tables/orders');
    expect(tourButtonLabel(steps, existingIds)).toBe('Restart tour');
  });

  test('visiting the missing step id has no effect (it is not "existing")', () => {
    expect(firstUnvisitedStep(steps, ['tables/missing'])).toBe('tables/orders');
  });
});

describe('tourProgressKey', () => {
  test('namespaces by bundle name and tour id', () => {
    expect(tourProgressKey('ga4', 'tours/basics')).toBe('okf-tour:ga4:tours/basics');
  });
});
