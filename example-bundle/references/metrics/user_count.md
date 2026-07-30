---
type: Reference
resource: https://developers.google.com/analytics/bigquery/web-ecommerce-demo-dataset
title: User Count
description: Total number of unique users.
tags:
- metric
generated:
  by: reference_agent/unknown
  at: '2026-05-28T22:50:09+00:00'
sources:
- id: web-ecommerce-demo-dataset
  resource: https://developers.google.com/analytics/bigquery/web-ecommerce-demo-dataset
---

Total number of unique users.

```sql
COUNT(DISTINCT user_pseudo_id)
```
