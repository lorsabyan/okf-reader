---
type: Tour
title: GA4 essentials
description: A guided walk through the GA4 export schema, from raw dataset to the metrics built on top of it.
steps:
  - datasets/ga4_obfuscated_sample_ecommerce
  - tables/events_
  - references/metrics/event_count
  - references/metrics/user_count
  - references/metrics/day_count
timestamp: '2026-07-13T00:00:00+00:00'
---

This tour is a five-stop introduction to the `ga4_obfuscated_sample_ecommerce` sample dataset. It starts at the dataset level — what it contains, where it lives, and its known limitations — then drops into the `events_` table that backs almost everything else in this bundle.

From there it walks through three of the table's core metrics: event count, user count, and day count. Together they're the numbers used in the dataset's own sample query, so by the end of the tour you'll be able to read that query and know exactly what each piece measures.
