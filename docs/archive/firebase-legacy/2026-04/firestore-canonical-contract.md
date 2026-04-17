# Firestore Canonical Contract

## Current Canonical Surface
- `users`
  - Push tokens must be stored only at `users/{uid}.fcmTokens`.
- `jobPostings`
  - New writes must follow the V3 shape.
- `applications`
  - New writes must use `jobPostingId`.
- `workLogs`
  - New writes must use `jobPostingId`.
- `notifications`
  - Notification type, category, and priority are derived from the runtime notification type set.
- `reports`
  - Report ownership and joins use `jobPostingId`.
- `eventQRCodes`
  - New writes must use `jobPostingId`.

## Legacy Compatibility
- `eventId` is read-compatibility only and must not be written by new app or Functions code.
- Top-level `fcmTokens` is deprecated and must not be written or queried.
- Legacy empty collections such as `events`, `participants`, and `attendanceRecords` are deletion candidates only after:
  - live document count is `0`
  - active source references are `0`

## Cleanup Gate
- Before deleting any legacy surface, verify:
  - `workLogs.eventId = 0`
  - `eventQRCodes.eventId = 0`
  - top-level `fcmTokens` documents = `0`
  - `events`, `participants`, `attendanceRecords` documents = `0`
  - no active Functions export or app source still depends on that surface
