# Functions Source Layout

Public Firebase exports are organized through three barrels:

- `src/api/`: callable and HTTP entry points grouped by domain
- `src/triggers/`: Firestore-driven exports, including job posting contract touchpoints
- `src/scheduled/`: scheduler-driven exports grouped by domain

`src/index.ts` is now bootstrap-only. It initializes Admin/Sentry once and re-exports from the domain barrels.

## Canonical Job Posting Touchpoints

These modules are the main contract-sensitive paths for job postings:

- `src/api/jobPostings/`: admin approval, rejection, resubmission, and manual fixed-post expiration entry points
- `src/triggers/jobPostings.ts`: derived `searchIndex` sync and canonical `applicationCount` maintenance
- `src/triggers/onJobPostingOGSync.ts`: reads canonical job posting fields for OG projection without reshaping the document

When adding new job posting functions, prefer touching only canonical fields already allowed by the V3 contract. Derived fields should stay explicitly scoped, such as `searchIndex` and `applicationCount`.
