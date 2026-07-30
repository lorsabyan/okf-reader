---
type: Reference
resource: https://developers.google.com/analytics/bigquery/basic-queries
title: Average Pageviews
description: The average number of pageviews per user.
tags:
- metric
generated:
  by: reference_agent/unknown
  at: '2026-05-28T22:51:43+00:00'
sources:
- id: bigquery-basic-queries
  resource: https://developers.google.com/analytics/bigquery/basic-queries
---

The average number of pageviews per user.

```sql
SUM(page_view_count) / COUNT(*)
-- where page_view_count is COUNTIF(event_name = 'page_view') per user
```
