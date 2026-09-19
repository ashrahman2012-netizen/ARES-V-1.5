# GitHub Gap Analysis — ARES v1.4

## LocoKit
Gap: fragmented APR records.
Pattern adopted: Observation -> Segment -> human-level activity item, with continuity tolerance for short internal state changes.
License: LGPL-3.0. No LocoKit code copied.

## app-privacy-report-viewer
Gap: APR ingestion transparency.
Pattern adopted: local/offline NDJSON processing, filtering, retain raw evidence.

## iLEAPP
Gap: future iOS backup and artifact parsing.
Pattern adopted: modular artifact processors, normalized timelines, fixture-based testing, iTunes/Finder backup compatibility as a future source adapter.

## MVT
Gap: forensic plugin discipline.
Pattern adopted: source-specific plugins, explicit limitations, independently traceable processing.

## Network analysis projects
Gap: domains overwhelmed the user timeline.
Pattern adopted: network is context by default, not a user activity trigger. Exception: clustered browser/video traffic.
