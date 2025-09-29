# ☁️ API Reference (Firebase Functions)

**Version**: v0.2.2
**Status**: 🚀 Production Ready

This document provides a reference for all Firebase Cloud Functions used in the T-HOLDEM project.

## 📋 Functions Overview

| Function Name | Trigger Type | Description |
|---|---|---|
| `onApplicationStatusChange` | Firestore (onUpdate) | Updates related data when an application's status changes. |
| `onJobPostingCreated` | Firestore (onCreate) | Performs actions when a new job posting is created. |
| `validateJobPostingData` | Firestore (onWrite) | Validates and auto-corrects job posting data. |
| `matchDealersToEvent` | HTTPS (onCall) | Matches suitable dealers to a specific event. |
| `assignDealerToEvent` | HTTPS (onCall) | Assigns a specific dealer to an event. |
| `generateEventQrToken` | HTTPS (onCall) | Generates a QR code token for event attendance. |
| `recordAttendance` | HTTPS (onCall) | Records staff attendance via QR code scan. |
| `calculatePayrollsForEvent` | HTTPS (onCall) | Calculates payroll for all staff in an event. |
| `getPayrolls` | HTTPS (onCall) | Retrieves payroll data for a specific period. |
| `submitDealerRating` | HTTPS (onCall) | Submits a rating for a dealer's performance. |
| `migrateJobPostings` | HTTPS (onCall) | **Admin-only:** Migrates job postings to the new schema. |
| `requestRegistration` | HTTPS (onCall) | Handles new user registration requests. |
| `processRegistration` | HTTPS (onCall) | **Admin-only:** Approves or rejects manager registration. |
| `createUserAccount` | HTTPS (onCall) | **Admin-only:** Creates a new user account. |
| `createUserData` | Auth (onCreate) | Creates a corresponding user document in Firestore. |
| `onUserRoleChange` | Firestore (onWrite) | Sets custom user claims when a user's role changes. |
| `getDashboardStats` | HTTPS (onRequest) | Retrieves statistics for the main dashboard. |
| `updateUser` | HTTPS (onCall) | **Admin-only:** Updates a user's details. |
| `deleteUser` | HTTPS (onCall) | **Admin-only:** Deletes a user from Auth and Firestore. |
| `logAction` | HTTPS (onCall) | Logs user actions for auditing and analytics. |
| `logActionHttp` | HTTPS (onRequest) | HTTP endpoint version of `logAction`. |
| `updateJobPostingApplicantCount` | Firestore (onWrite) | Updates the applicant count on a job posting. |
| `updateEventParticipantCount` | Firestore (onWrite) | Updates the participant count on an event. |

---

## Function Details

### `requestRegistration`

- **Trigger**: HTTPS (onCall)
- **Description**: Handles new user registration requests. Dealers are created and enabled immediately, while managers are created as disabled and await admin approval.
- **Parameters**:
    - `email` (string): The user's email address.
    - `password` (string): The user's chosen password.
    - `name` (string): The user's full name.
    - `role` (string): The desired role (`staff` or `manager`).
    - `phone` (string, optional): The user's phone number.
    - `gender` (string, optional): The user's gender.
- **Returns**: `{ success: boolean, message: string }`
- **Security**: Publicly accessible.

### `processRegistration`

- **Trigger**: HTTPS (onCall)
- **Description**: Approves or rejects a manager's registration request.
- **Parameters**:
    - `targetUid` (string): The UID of the user to process.
    - `action` (string): The action to perform (`approve` or `reject`).
- **Returns**: `{ success: boolean, message: string }`
- **Security**: **Admin-only**. Requires the caller to have an `admin` role in their custom claims.

### `createUserData`

- **Trigger**: Auth (onCreate)
- **Description**: Automatically creates a user document in the `users` collection in Firestore when a new user is created in Firebase Authentication. It also parses extra data (like phone and gender) embedded in the `displayName`.
- **Parameters**: `user` (AuthUserRecord): The user record created in Firebase Auth.
- **Returns**: `null`

---
