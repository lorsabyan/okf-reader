---
type: Reference
resource: https://developers.google.com/analytics/bigquery/basic-queries
title: Join Google Analytics Events to Google Ads Clicks
description: Join Google Analytics event data with Google Ads click data.
tags:
- join
- Google Ads
generated:
  by: reference_agent/unknown
  at: '2026-05-28T22:51:46+00:00'
sources:
- id: bigquery-basic-queries
  resource: https://developers.google.com/analytics/bigquery/basic-queries
---

Join Google Analytics event data with Google Ads click data.

```sql
GA_EVENTS.collected_traffic_source.gclid = ADS_CLICKS.gclid
```
