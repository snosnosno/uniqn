# ☁️ API Reference (Firebase Functions)

**최종 업데이트**: 2025년 11월 27일
**버전**: v0.2.4 (Production Ready + 구인공고 4타입)
**상태**: 🚀 **Production Ready**

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
| **🏆 Tournament Approval** | | |
| `approveJobPosting` | HTTPS (onCall) | **Admin-only:** Approves a tournament job posting. |
| `rejectJobPosting` | HTTPS (onCall) | **Admin-only:** Rejects a tournament job posting with reason. |
| `resubmitJobPosting` | HTTPS (onCall) | Resubmits a rejected tournament job posting. |
| `onTournamentApprovalChange` | Firestore (onUpdate) | Sends notifications when tournament approval status changes. |
| **💳 Payment System** | | |
| `confirmPayment` | HTTPS (onCall) | Confirms a payment and grants chips to the user. |
| `manualGrantChips` | HTTPS (onCall) | **Admin-only:** Manually grants chips to a user. |
| `refundPayment` | HTTPS (onCall) | Requests a refund for a payment. |
| `approveRefund` | HTTPS (onCall) | **Admin-only:** Approves a refund request. |
| `rejectRefund` | HTTPS (onCall) | **Admin-only:** Rejects a refund request. |
| **📅 Subscription** | | |
| `grantMonthlyBlueChips` | Pub/Sub (Scheduled) | Grants monthly blue chips to active subscribers (runs on 1st day of month). |
| `manualGrantSubscriptionChips` | HTTPS (onCall) | **Admin-only:** Manually grants subscription chips. |
| **⏰ Scheduled Functions** | | |
| `expireChips` | Pub/Sub (Scheduled) | Expires red/blue chips based on expiry date (runs daily at 00:00). |
| `chipExpiryNotification` | Pub/Sub (Scheduled) | Sends chip expiry notifications (runs daily at 09:00). |
| `cleanupRateLimitsScheduled` | Pub/Sub (Scheduled) | Cleans up expired rate limit records (runs daily at 00:00). |
| **📧 Email & Notifications** | | |
| `sendReceiptEmail` | HTTPS (onCall) | Sends a receipt email to the user. |
| **🔐 Authentication** | | |
| `sendPhoneVerificationCode` | HTTPS (onCall) | Sends a 6-digit verification code to a phone number. |
| `verifyPhoneCode` | HTTPS (onCall) | Verifies the phone verification code. |
| `getVerificationStatus` | HTTPS (onCall) | Gets email/phone verification status for a user. |

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

## 🏆 Tournament Approval Functions

### `approveJobPosting`

- **Trigger**: HTTPS (onCall)
- **Description**: **Admin-only** function to approve a tournament job posting. Changes the approval status from 'pending' to 'approved'.
- **Parameters**:
    - `postingId` (string): The ID of the job posting to approve.
- **Returns**:
    ```typescript
    {
      success: boolean;
      postingId: string;
      approvedBy: string;
      approvedAt: string;
    }
    ```
- **Security**: **Admin-only**. Requires `admin` role in custom claims.
- **Processing**:
    1. Validates admin authentication
    2. Checks if posting exists and is a tournament type
    3. Verifies current status is 'pending'
    4. Updates `tournamentConfig.approvalStatus` to 'approved'
    5. Records `approvedBy` and `approvedAt`
    6. Triggers `onTournamentApprovalChange` for notification
- **Error Codes**:
    - `unauthenticated`: User not logged in
    - `permission-denied`: User is not an admin
    - `not-found`: Job posting not found
    - `invalid-argument`: Not a tournament posting
    - `failed-precondition`: Not in pending status

### `rejectJobPosting`

- **Trigger**: HTTPS (onCall)
- **Description**: **Admin-only** function to reject a tournament job posting with a reason.
- **Parameters**:
    - `postingId` (string): The ID of the job posting to reject.
    - `reason` (string): Rejection reason (minimum 10 characters).
- **Returns**:
    ```typescript
    {
      success: boolean;
      postingId: string;
      rejectedBy: string;
      rejectedAt: string;
    }
    ```
- **Security**: **Admin-only**. Requires `admin` role in custom claims.
- **Processing**:
    1. Validates admin authentication
    2. Validates rejection reason (minimum 10 characters)
    3. Checks if posting exists and is a tournament type
    4. Verifies current status is 'pending'
    5. Updates `tournamentConfig.approvalStatus` to 'rejected'
    6. Records `rejectedBy`, `rejectedAt`, and `rejectionReason`
    7. Triggers `onTournamentApprovalChange` for notification
- **Error Codes**:
    - `unauthenticated`: User not logged in
    - `permission-denied`: User is not an admin
    - `not-found`: Job posting not found
    - `invalid-argument`: Not a tournament posting or reason too short
    - `failed-precondition`: Not in pending status

### `resubmitJobPosting`

- **Trigger**: HTTPS (onCall)
- **Description**: Allows the posting owner to resubmit a rejected tournament job posting for re-review.
- **Parameters**:
    - `postingId` (string): The ID of the job posting to resubmit.
- **Returns**:
    ```typescript
    {
      success: boolean;
      postingId: string;
      resubmittedBy: string;
      resubmittedAt: string;
    }
    ```
- **Security**: Authenticated users only. Must be the posting owner.
- **Processing**:
    1. Validates user authentication
    2. Checks if posting exists and user is the owner
    3. Verifies posting is a tournament type
    4. Verifies current status is 'rejected'
    5. Preserves previous rejection info in `previousRejection`
    6. Updates `tournamentConfig.approvalStatus` to 'pending'
    7. Records `resubmittedAt` and `resubmittedBy`
    8. Clears previous rejection fields
- **Error Codes**:
    - `unauthenticated`: User not logged in
    - `permission-denied`: User is not the posting owner
    - `not-found`: Job posting not found
    - `invalid-argument`: Not a tournament posting
    - `failed-precondition`: Not in rejected status

### `onTournamentApprovalChange`

- **Trigger**: Firestore (onUpdate) on `jobPostings/{postingId}`
- **Description**: Sends notifications to the posting owner when a tournament approval status changes.
- **Processing**:
    1. Detects changes to `tournamentConfig.approvalStatus`
    2. If changed to 'approved': Creates success notification
    3. If changed to 'rejected': Creates notification with rejection reason
    4. Notification is stored in `notifications` collection
- **Notification Types**:
    - `tournament_approved`: "대회 공고가 승인되었습니다"
    - `tournament_rejected`: "대회 공고가 거부되었습니다. 사유: {reason}"

---

## 💳 Payment System Functions

### `confirmPayment`

- **Trigger**: HTTPS (onCall)
- **Description**: Confirms a Toss Payments transaction and grants red chips to the user's balance. Includes comprehensive security validation (signature verification, amount validation, duplicate prevention).
- **Parameters**:
    - `orderId` (string): Unique order ID in format `ORD_{userId}_{packageId}_{timestamp}`
    - `paymentKey` (string): Toss Payments payment key
    - `amount` (number): Payment amount in KRW
- **Returns**:
    ```typescript
    {
      success: boolean;
      message: string;
      chipBalance: {
        redChips: number;
        blueChips: number;
      };
    }
    ```
- **Security**:
    - Authenticated users only
    - Server-side amount validation against package price
    - Duplicate payment prevention via `orderId` check
    - User ownership validation (orderId must match authenticated user)
    - Rate limiting: 5 requests per minute per user
- **Error Codes**:
    - `unauthenticated`: User not logged in
    - `invalid-argument`: Missing required parameters
    - `permission-denied`: User attempting to confirm someone else's payment
    - `already-exists`: Duplicate payment (orderId already processed)
    - `failed-precondition`: Amount mismatch or payment already confirmed
    - `internal`: Toss API error or server error
- **Example**:
    ```typescript
    const confirmPayment = httpsCallable(functions, 'confirmPayment');
    const result = await confirmPayment({
      orderId: 'ORD_abc123_pkg2_1737689400000',
      paymentKey: 'tgen_abc123xyz',
      amount: 5500
    });
    ```

### `manualGrantChips`

- **Trigger**: HTTPS (onCall)
- **Description**: **Admin-only** function to manually grant red or blue chips to a specific user. Creates a transaction record for audit purposes.
- **Parameters**:
    - `userId` (string): Target user's UID
    - `chipType` ('red' | 'blue'): Type of chip to grant
    - `amount` (number): Number of chips to grant
    - `reason` (string): Reason for manual grant (e.g., "Promotional bonus", "Compensation")
- **Returns**:
    ```typescript
    {
      success: boolean;
      message: string;
      transaction: {
        id: string;
        userId: string;
        type: 'grant';
        chipType: 'red' | 'blue';
        amount: number;
        balance: number;
        reason: string;
        createdAt: Timestamp;
      };
    }
    ```
- **Security**: **Admin-only**. Requires `admin` role in custom claims.
- **Error Codes**:
    - `unauthenticated`: User not logged in
    - `permission-denied`: User is not an admin
    - `invalid-argument`: Missing or invalid parameters
    - `not-found`: Target user not found
    - `internal`: Server error
- **Example**:
    ```typescript
    const manualGrantChips = httpsCallable(functions, 'manualGrantChips');
    const result = await manualGrantChips({
      userId: 'abc123',
      chipType: 'red',
      amount: 100,
      reason: 'Promotional bonus for new user'
    });
    ```

### `refundPayment`

- **Trigger**: HTTPS (onCall)
- **Description**: Requests a refund for a payment. Validates refund eligibility (within 7 days, usage limits, blacklist check) and creates a refund request for admin approval.
- **Parameters**:
    - `orderId` (string): Original payment order ID
    - `reason` (string): Reason for refund request
- **Returns**:
    ```typescript
    {
      success: boolean;
      message: string;
      refundRequestId: string;
    }
    ```
- **Security**:
    - Authenticated users only
    - User must own the payment
    - Rate limiting: 3 requests per 5 minutes per user
- **Validation Rules**:
    - Must be within 7 days of payment
    - Monthly limit: 1 refund
    - Yearly limit: 3 refunds
    - User must not be on blacklist
    - Payment must not be fully used (chips deducted)
- **Error Codes**:
    - `unauthenticated`: User not logged in
    - `invalid-argument`: Missing parameters
    - `permission-denied`: Not payment owner or blacklisted
    - `not-found`: Payment not found
    - `failed-precondition`: Refund period expired, limit exceeded, or chips fully used
    - `internal`: Server error
- **Example**:
    ```typescript
    const refundPayment = httpsCallable(functions, 'refundPayment');
    const result = await refundPayment({
      orderId: 'ORD_abc123_pkg2_1737689400000',
      reason: '단순 변심'
    });
    ```

### `approveRefund`

- **Trigger**: HTTPS (onCall)
- **Description**: **Admin-only** function to approve a refund request. Calls Toss API to process the refund and deducts chips from user's balance.
- **Parameters**:
    - `refundRequestId` (string): Refund request document ID
    - `adminNotes` (string, optional): Admin notes for the approval
- **Returns**:
    ```typescript
    {
      success: boolean;
      message: string;
    }
    ```
- **Security**: **Admin-only**. Requires `admin` role.
- **Processing**:
    1. Validates refund request exists and is pending
    2. Calculates refund amount (20% fee if partially used)
    3. Calls Toss API `/payments/{paymentKey}/cancel`
    4. Deducts chips from user balance (Firestore transaction)
    5. Updates refund request status to 'completed'
    6. Sends notification to user
- **Error Codes**:
    - `unauthenticated`: User not logged in
    - `permission-denied`: User is not an admin
    - `not-found`: Refund request not found
    - `failed-precondition`: Request already processed or insufficient chips
    - `internal`: Toss API error or server error
- **Example**:
    ```typescript
    const approveRefund = httpsCallable(functions, 'approveRefund');
    const result = await approveRefund({
      refundRequestId: 'refund_abc123',
      adminNotes: '정상 환불 처리'
    });
    ```

### `rejectRefund`

- **Trigger**: HTTPS (onCall)
- **Description**: **Admin-only** function to reject a refund request.
- **Parameters**:
    - `refundRequestId` (string): Refund request document ID
    - `adminNotes` (string, optional): Reason for rejection
- **Returns**:
    ```typescript
    {
      success: boolean;
      message: string;
    }
    ```
- **Security**: **Admin-only**. Requires `admin` role.
- **Error Codes**: Same as `approveRefund`
- **Example**:
    ```typescript
    const rejectRefund = httpsCallable(functions, 'rejectRefund');
    const result = await rejectRefund({
      refundRequestId: 'refund_abc123',
      adminNotes: '환불 기간 초과'
    });
    ```

---

## 📅 Subscription Functions

### `grantMonthlyBlueChips`

- **Trigger**: Pub/Sub (Scheduled)
- **Schedule**: 1st day of every month at 00:00 Asia/Seoul
- **Description**: Automatically grants monthly blue chips to all active subscription users. Prevents duplicate grants using `lastChipGrantMonth` field.
- **Cloud Scheduler Command**:
    ```bash
    gcloud scheduler jobs create pubsub grantMonthlyBlueChips \
      --schedule="0 0 1 * *" \
      --time-zone="Asia/Seoul" \
      --topic="grant-monthly-blue-chips" \
      --message-body="{}"
    ```
- **Processing**:
    1. Queries all active subscriptions with `autoRenew: true`
    2. Checks `lastChipGrantMonth` to prevent duplicates
    3. Grants chips via Firestore transaction
    4. Updates `lastChipGrantMonth` to current month
    5. Sets `blueChipExpiry` to next month's 1st day
- **Subscription Plans**:
    - Free: 5 blue chips/month
    - Standard: 30 blue chips/month
    - Pro: 80 blue chips/month

### `manualGrantSubscriptionChips`

- **Trigger**: HTTPS (onCall)
- **Description**: **Admin-only** function to manually grant subscription chips to a specific user.
- **Parameters**:
    - `userId` (string): Target user's UID
    - `subscriptionId` (string): Subscription document ID
- **Returns**:
    ```typescript
    {
      success: boolean;
      message: string;
    }
    ```
- **Security**: **Admin-only**. Requires `admin` role.
- **Example**:
    ```typescript
    const manualGrantSubscriptionChips = httpsCallable(functions, 'manualGrantSubscriptionChips');
    const result = await manualGrantSubscriptionChips({
      userId: 'abc123',
      subscriptionId: 'sub_abc123'
    });
    ```

---

## ⏰ Scheduled Functions

### `expireChips`

- **Trigger**: Pub/Sub (Scheduled)
- **Schedule**: Daily at 00:00 Asia/Seoul
- **Description**: Expires red and blue chips based on expiry dates. Red chips expire 1 year after purchase, blue chips expire on 1st day of next month.
- **Cloud Scheduler Command**:
    ```bash
    gcloud scheduler jobs create pubsub expireChips \
      --schedule="0 0 * * *" \
      --time-zone="Asia/Seoul" \
      --topic="expire-chips" \
      --message-body="{}"
    ```
- **Processing**:
    1. Red Chip Expiry: Queries users where `redChipExpiry <= now`
    2. Blue Chip Expiry: Resets all blue chips on 1st day of month
    3. Updates chip balances via Firestore transaction
    4. Creates expiry transaction records
    5. Logs statistics (total users, expired chips)

### `chipExpiryNotification`

- **Trigger**: Pub/Sub (Scheduled)
- **Schedule**: Daily at 09:00 Asia/Seoul
- **Description**: Sends chip expiry notifications to users at 30 days, 7 days, 3 days, and 0 days before expiry.
- **Cloud Scheduler Command**:
    ```bash
    gcloud scheduler jobs create pubsub chipExpiryNotification \
      --schedule="0 9 * * *" \
      --time-zone="Asia/Seoul" \
      --topic="chip-expiry-notification" \
      --message-body="{}"
    ```
- **Notification Thresholds**: [30, 7, 3, 0] days before expiry
- **Processing**:
    1. For each threshold, queries users with chips expiring on target date
    2. Creates notification document in `notifications` collection
    3. Notification type: `finance`
    4. Users receive real-time notifications via Firestore listeners

### `cleanupRateLimitsScheduled`

- **Trigger**: Pub/Sub (Scheduled)
- **Schedule**: Daily at 00:00 Asia/Seoul
- **Description**: Cleans up expired rate limit records to prevent database bloat.
- **Cloud Scheduler Command**:
    ```bash
    gcloud scheduler jobs create pubsub cleanupRateLimits \
      --schedule="0 0 * * *" \
      --time-zone="Asia/Seoul" \
      --topic="cleanup-rate-limits" \
      --message-body="{}"
    ```

---

## 📧 Email & Notifications

### `sendReceiptEmail`

- **Trigger**: HTTPS (onCall)
- **Description**: Sends a receipt email to the user for payment, subscription, or refund transactions.
- **Parameters**:
    - `orderId` (string): Transaction order ID
    - `userId` (string): User's UID
    - `receiptType` ('payment' | 'subscription' | 'refund'): Receipt type
- **Returns**:
    ```typescript
    {
      success: boolean;
      message: string;
      email: string;
    }
    ```
- **Security**: Authenticated users can only request their own receipts
- **Processing**:
    1. Validates user authentication and ownership
    2. Fetches transaction data from Firestore
    3. Fetches user profile data
    4. Generates HTML receipt
    5. Sends email ⚠️ **[PENDING]** SendGrid/Nodemailer 미연동 (개발 환경에서는 콘솔 로그 출력)
    6. Records email sent in `users/{userId}/receipts/{orderId}`
- **Error Codes**:
    - `unauthenticated`: User not logged in
    - `permission-denied`: Requesting someone else's receipt
    - `not-found`: Transaction or user not found
    - `failed-precondition`: Email address missing
    - `internal`: Server error
- **Example**:
    ```typescript
    const sendReceiptEmail = httpsCallable(functions, 'sendReceiptEmail');
    const result = await sendReceiptEmail({
      orderId: 'ORD_abc123_pkg2_1737689400000',
      userId: 'abc123',
      receiptType: 'payment'
    });
    ```

---

## 🔐 Authentication Functions

### `sendPhoneVerificationCode`

- **Trigger**: HTTPS (onCall)
- **Description**: Sends a 6-digit verification code to a phone number via SMS. Code expires after 5 minutes. ⚠️ **[PENDING]** Twilio/AWS SNS 미연동 (개발 환경에서는 코드 직접 반환)
- **Parameters**:
    - `phoneNumber` (string): Phone number in format "010-1234-5678"
    - `userId` (string): User's UID
- **Returns**:
    ```typescript
    {
      success: boolean;
      message: string;
      expiresIn: number;  // 300 seconds (5 minutes)
      code?: string;      // Only in development environment
    }
    ```
- **Security**:
    - Authenticated users only
    - 1-minute cooldown between requests
    - Duplicate phone number prevention
- **Validation**:
    - Phone number format: `^010[0-9]{8}$`
    - Normalized format: `+821012345678`
- **Processing**:
    1. Validates phone number format
    2. Checks for duplicate phone number in verified users
    3. Enforces 1-minute cooldown
    4. Generates 6-digit code
    5. Creates verification record with 5-minute expiry
    6. Sends SMS ⚠️ **[PENDING]** 실제 SMS 서비스 연동 필요
    7. In development, returns code in response
- **Error Codes**:
    - `unauthenticated`: User not logged in
    - `invalid-argument`: Invalid phone number format
    - `already-exists`: Phone number already verified by another user
    - `failed-precondition`: Cooldown period active
    - `internal`: Server error
- **Example**:
    ```typescript
    const sendPhoneVerificationCode = httpsCallable(functions, 'sendPhoneVerificationCode');
    const result = await sendPhoneVerificationCode({
      phoneNumber: '010-1234-5678',
      userId: 'abc123'
    });
    ```

### `verifyPhoneCode`

- **Trigger**: HTTPS (onCall)
- **Description**: Verifies the 6-digit phone verification code. Limited to 3 attempts.
- **Parameters**:
    - `phoneNumber` (string): Phone number in format "010-1234-5678"
    - `code` (string): 6-digit verification code
    - `userId` (string): User's UID
- **Returns**:
    ```typescript
    {
      success: boolean;
      message: string;
      phoneNumber: string;  // Normalized format
    }
    ```
- **Security**:
    - Authenticated users only
    - 3 attempt limit
    - 5-minute expiry
- **Processing**:
    1. Finds pending verification record
    2. Checks expiry time
    3. Checks attempt limit (3 attempts max)
    4. Validates code match
    5. Updates verification status to 'verified'
    6. Updates user profile with verified phone number
    7. Creates verification record in `userVerifications` collection
- **Error Codes**:
    - `unauthenticated`: User not logged in
    - `invalid-argument`: Invalid code format (not 6 digits)
    - `not-found`: No pending verification found
    - `failed-precondition`: Code expired or attempt limit exceeded
    - `permission-denied`: Incorrect code (decrements attempt counter)
    - `internal`: Server error
- **Example**:
    ```typescript
    const verifyPhoneCode = httpsCallable(functions, 'verifyPhoneCode');
    const result = await verifyPhoneCode({
      phoneNumber: '010-1234-5678',
      code: '123456',
      userId: 'abc123'
    });
    ```

### `getVerificationStatus`

- **Trigger**: HTTPS (onCall)
- **Description**: Retrieves email and phone verification status for a user.
- **Parameters**:
    - `userId` (string): User's UID
- **Returns**:
    ```typescript
    {
      success: boolean;
      emailVerified: boolean;
      phoneVerified: boolean;
      phoneNumber?: string;  // If phone is verified
    }
    ```
- **Security**: Users can only check their own status (or admins can check any user)
- **Error Codes**:
    - `unauthenticated`: User not logged in
    - `permission-denied`: Checking someone else's status without admin role
    - `not-found`: User not found
    - `internal`: Server error
- **Example**:
    ```typescript
    const getVerificationStatus = httpsCallable(functions, 'getVerificationStatus');
    const result = await getVerificationStatus({
      userId: 'abc123'
    });
    ```

---
