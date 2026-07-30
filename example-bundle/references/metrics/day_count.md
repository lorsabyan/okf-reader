---
type: Reference
resource: https://developers.google.com/analytics/bigquery/web-ecommerce-demo-dataset
title: Day Count
description: Total number of unique days.
tags:
- metric
generated:
  by: reference_agent/unknown
  at: '2026-05-28T22:50:10+00:00'
sources:
- id: web-ecommerce-demo-dataset
  resource: https://developers.google.com/analytics/bigquery/web-ecommerce-demo-dataset
---

Total number of unique days.

```sql
COUNT(DISTINCT event_date)
```
