# ARES v1.4 — Human Activity Reconstruction Engine (HARE)

ARES v1.4 changes the analysis model from **record classification** to **human activity reconstruction**.

## Run on Windows
1. Extract the ZIP.
2. Double-click `Launch ARES v1.4.bat`.
3. Import an Apple App Privacy Report `.ndjson`.

No evidence upload is required.

## Major changes
- Raw APR → immutable low-level observations.
- Temporal segmentation into high-level User Activity Items.
- Separate **Evidence Status** from **User Involvement Score**.
- Sustained microphone/camera signals drive communication/camera activity.
- Contacts, Photos, Location and network records are supporting evidence by default.
- Same-app communication segments separated by <=60 seconds merge into a sequence.
- Browser/video network records are clustered before probable browsing/streaming classification.
- Network observations overlapping user activity are labelled supporting context; isolated traffic remains background/unlinked.
- App-active duration comes from high-level activity items, not raw permission totals.

## Important limitation
ARES v1.4 does not reproduce Apple Screen Time. App Privacy Reports do not contain a universal foreground app-open/app-close log.

## Open-source research basis
ARES v1.4 independently implements concepts inspired by:
- `johnspurlock/app-privacy-report-viewer`: local APR processing and source filtering.
- `sobri909/LocoKit`: low-level samples grouped into high-level timeline items.
- `abrignoni/iLEAPP`: modular forensic artifact processing and backup-oriented architecture.
- `mvt-project/mvt`: plugin-oriented forensic processing and explicit analytical limitations.

No third-party source code is bundled in this package.
