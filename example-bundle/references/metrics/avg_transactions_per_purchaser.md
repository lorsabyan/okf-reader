---
type: Reference
resource: https://developers.google.com/analytics/bigquery/basic-queries
title: Average Transactions Per Purchaser
description: The average number of transactions made by purchasers.
tags:
- metric
- ecommerce
generated:
  by: reference_agent/unknown
  at: '2026-05-28T22:51:41+00:00'
sources:
- id: bigquery-basic-queries
  resource: https://developers.google.com/analytics/bigquery/basic-queries
---

The average number of transactions made by purchasers.

```sql
COUNT(*) / COUNT(DISTINCT user_pseudo_id)
-- for events where event_name IN ('in_app_purchase', 'purchase')
```
