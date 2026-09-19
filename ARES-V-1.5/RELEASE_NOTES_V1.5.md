# ARES v1.5 — Behavioural Transition Engine

## New rule: Potential Contact-Management Event

Direct Phone/Contacts activity
+
unusual Contacts-resource access
+
possible Settings/system transition
+
change in later call/contact behaviour
→ Potential Contact-Management Event

### Evidential safeguards
- The APR does not directly record a semantic Block/Unblock action.
- A candidate is not labelled confirmed blocking/unblocking.
- Each candidate exposes the four rule components, score, source evidence, before/after activity counts and alternative explanations.
- A `Possible Block/Unblock Candidate` requires all four components in the current APR-only implementation.
- Confirmation should require independent evidence such as a recoverable backup/device-state artefact.

## Behavioural Transition Engine
v1.5 introduces state-change analysis on top of HARE rather than treating every resource event independently.
