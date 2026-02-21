import * as admin from "firebase-admin";
import { logger } from 'firebase-functions';
import { onCall, onRequest } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { initSentry } from './utils/sentry';
import {
  requireAuth,
  requireRole,
  requireString,
  requireEnum,
  NotFoundError,
  handleFunctionError,
  handleTriggerError,
} from './errors';

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Firestore
const db = admin.firestore();

// Initialize Sentry (에러 트래킹)
initSentry();

// --- Scheduled Functions ---
export { cleanupRateLimitsScheduled } from './scheduled/cleanupRateLimits';
export { retryFailedCounterOpsScheduled } from './scheduled/retryFailedCounterOps';
export { cleanupExpiredTokensScheduled } from './scheduled/cleanupExpiredTokens';
export { cleanupPendingVerificationsScheduled } from './scheduled/cleanupPendingVerifications';

// --- Identity Verification Functions ---
export { verifyIdentity } from './auth/verifyIdentity';
export { linkIdentityVerification } from './auth/linkIdentityVerification';

// --- Migration Functions ---
export { backfillCiIndex } from './migrations/backfillCiIndex';

// --- Email Verification Functions ---
export { checkEmailExists } from './auth/checkEmailExists';

// --- Apple Auth Functions ---
export { createCustomToken } from './auth/createCustomToken';
export { revokeAppleToken } from './auth/revokeAppleToken';

// --- Phone Duplicate Check ---
export { checkPhoneExists } from './auth/checkPhoneExists';

// --- Phone Verification Functions ---
export {
  sendPhoneVerificationCode,
  verifyPhoneCode,
  getVerificationStatus,
} from './auth/phoneVerification';

// --- Notification Functions ---
export { sendJobPostingAnnouncement } from './notifications/sendJobPostingAnnouncement';
export { sendSystemAnnouncement } from './notifications/sendSystemAnnouncement';
export { onApplicationSubmitted } from './notifications/onApplicationSubmitted';
export { onApplicationStatusChanged } from './notifications/onApplicationStatusChanged';
export { onWorkTimeChanged } from './notifications/onWorkTimeChanged';
export { onScheduleCreated, onScheduleCancelled } from './notifications/onScheduleChanged';
export { onCheckInOut } from './notifications/onCheckInOut';
export { onJobPostingUpdated } from './notifications/onJobPostingUpdated';
export { onJobPostingCancelled } from './notifications/onJobPostingCancelled';
export { onNoShow } from './notifications/onNoShow';
export { onSettlementCompleted } from './notifications/onSettlementCompleted';
export { onNegativeSettlement } from './notifications/onNegativeSettlement';
export { onJobPostingClosed } from './notifications/onJobPostingClosed';
export { onReportCreated } from './notifications/onReportCreated';
export { onInquiryCreated } from './notifications/onInquiryCreated';
export { onTournamentPostingCreated } from './notifications/onTournamentPostingCreated';
export { onNotificationRead } from './notifications/onNotificationRead';
export { onNotificationDeleted } from './notifications/onNotificationDeleted';
export { resetUnreadCounter } from './notifications/resetUnreadCounter';
export { initializeUnreadCounter } from './notifications/initializeUnreadCounter';
export { decrementUnreadCounterCallable as decrementUnreadCounter } from './notifications/decrementUnreadCounterCallable';

// --- Account Management Functions ---
export { processScheduledDeletions, forceDeleteAccount } from './account/scheduledDeletion';
export { sendLoginNotification, recordLoginFailure } from './account/loginNotification';
export { cleanupOrphanAccountsScheduled } from './account/cleanupOrphanAccounts';

// --- Job Posting Approval Functions (Phase 7) ---
export { approveJobPosting } from './api/jobPostings/approveJobPosting';
export { rejectJobPosting } from './api/jobPostings/rejectJobPosting';
export { resubmitJobPosting } from './api/jobPostings/resubmitJobPosting';
export { onTournamentApprovalChange } from './triggers/onTournamentApprovalChange';

// --- Job Posting OG Sync ---
export { onJobPostingOGSync } from './triggers/onJobPostingOGSync';

// --- Job Posting Scheduled Functions (Phase 5) ---
export { expireFixedPostings, manualExpireFixedPostings } from './scheduled/expireFixedPostings';
export { onFixedPostingExpired } from './triggers/onFixedPostingExpired';
export { expireByLastWorkDate } from './scheduled/expireByLastWorkDate';
export { onWorkDateExpired } from './triggers/onWorkDateExpired';

/**
 * Firestore trigger that automatically validates and fixes job posting data
 * when a new job posting is created or updated
 */
export const validateJobPostingData = onDocumentWritten(
  { document: 'jobPostings/{postId}', region: 'asia-northeast3' },
  async (event) => {
    const postId = event.params.postId;

    // Skip if document was deleted
    if (!event.data?.after.exists) {
        return;
    }

    const data = event.data?.after.data();
    if (!data) return;

    let needsUpdate = false;
    const updates: Record<string, unknown> = {};

    // Auto-generate requiredRoles if missing
    if (!data.requiredRoles && data.timeSlots) {
        const requiredRoles = Array.from(new Set(
            data.timeSlots.flatMap((ts: { roles?: Array<{ name: string }> }) =>
                ts.roles ? ts.roles.map((r: { name: string }) => r.name) : []
            )
        ));
        updates.requiredRoles = requiredRoles;
        needsUpdate = true;
        logger.info(`Auto-generating requiredRoles for post ${postId}:`, requiredRoles);
    }

    // Auto-generate searchIndex if missing
    if (!data.searchIndex) {
        const searchIndex = [
            data.title || '',
            data.location || '',
            data.description || '',
            ...(updates.requiredRoles || data.requiredRoles || [])
        ].join(' ').toLowerCase().split(/\s+/).filter(word => word.length > 0);
        updates.searchIndex = searchIndex;
        needsUpdate = true;
        logger.info(`Auto-generating searchIndex for post ${postId}`);
    }

    // Convert string dates to Timestamp if needed
    if (data.startDate && typeof data.startDate === 'string') {
        updates.startDate = admin.firestore.Timestamp.fromDate(new Date(data.startDate));
        needsUpdate = true;
        logger.info(`Converting startDate to Timestamp for post ${postId}`);
    }

    if (data.endDate && typeof data.endDate === 'string') {
        updates.endDate = admin.firestore.Timestamp.fromDate(new Date(data.endDate));
        needsUpdate = true;
        logger.info(`Converting endDate to Timestamp for post ${postId}`);
    }

    // Apply updates if needed
    if (needsUpdate) {
        try {
            await event.data?.after.ref.update(updates);
            logger.info(`Auto-fixed job posting ${postId}`, updates);
        } catch (error) {
            logger.error(`Failed to auto-fix job posting ${postId}:`, error);
            throw handleTriggerError(error, {
                operation: 'validateJobPostingData',
                context: { postId },
            });
        }
    }
  }
);
// --- Data Migration Functions ---

/**
 * Migrates existing job postings to include requiredRoles and proper date formats
 * Only callable by admin users
 */
export const migrateJobPostings = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    try {
        // Check admin permissions
        requireAuth(request);
        requireRole(request, 'admin');

        logger.info("Starting job postings migration...");

        const jobPostingsRef = db.collection('jobPostings');
        const snapshot = await jobPostingsRef.get();

        let migratedCount = 0;
        let skippedCount = 0;
        const batch = db.batch();

        snapshot.docs.forEach((doc) => {
            const docData = doc.data();
            let needsUpdate = false;
            const updates: Record<string, unknown> = {};

            // Check if requiredRoles field is missing
            if (!docData.requiredRoles && docData.timeSlots) {
                const requiredRoles = Array.from(new Set(
                    docData.timeSlots.flatMap((ts: { roles?: Array<{ name: string }> }) =>
                        ts.roles ? ts.roles.map((r: { name: string }) => r.name) : []
                    )
                ));
                updates.requiredRoles = requiredRoles;
                needsUpdate = true;
            }

            // Check if searchIndex field is missing
            if (!docData.searchIndex) {
                const searchIndex = [
                    docData.title || '',
                    docData.location || '',
                    docData.description || '',
                    ...(updates.requiredRoles || docData.requiredRoles || [])
                ].join(' ').toLowerCase().split(/\s+/).filter(word => word.length > 0);
                updates.searchIndex = searchIndex;
                needsUpdate = true;
            }

            // Check if dates need conversion to Timestamp
            if (docData.startDate && typeof docData.startDate === 'string') {
                updates.startDate = admin.firestore.Timestamp.fromDate(new Date(docData.startDate));
                needsUpdate = true;
            }

            if (docData.endDate && typeof docData.endDate === 'string') {
                updates.endDate = admin.firestore.Timestamp.fromDate(new Date(docData.endDate));
                needsUpdate = true;
            }

            if (needsUpdate) {
                batch.update(doc.ref, updates);
                migratedCount++;
            } else {
                skippedCount++;
            }
        });

        if (migratedCount > 0) {
            await batch.commit();
        }

        logger.info(`Migration completed: ${migratedCount} updated, ${skippedCount} skipped`);

        return {
            success: true,
            message: `Migration completed successfully`,
            stats: {
                total: snapshot.docs.length,
                migrated: migratedCount,
                skipped: skippedCount
            }
        };

    } catch (error: unknown) {
        throw handleFunctionError(error, {
            operation: 'migrateJobPostings',
            context: { userId: request.auth?.uid },
        });
    }
  }
);


// --- Authentication and Role Management Functions ---

/**
 * Handles a new user registration request.
 * - Dealers are created and enabled immediately.
 * - Managers are created as disabled and await admin approval.
 * - Passes extra data (phone, gender) via displayName for the trigger.
 */
export const requestRegistration = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    try {
        logger.info("requestRegistration called with data:", request.data);

        const { email, password, name, nickname, role, phone, gender, consents } = request.data;

        // 입력 검증
        requireString(email, 'email');
        requireString(password, 'password');
        requireString(name, 'name');
        requireString(role, 'role');

        // 웹앱에서는 employer로 가입
        const validRoles = ['employer', 'staff'];
        requireEnum(role, validRoles, 'role');

        // 1. Firebase Auth 사용자 생성
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: name,
            disabled: false,
            emailVerified: false,
        });

        const uid = userRecord.uid;
        logger.info(`User created successfully: ${email} (UID: ${uid})`);

        // 2. Firestore에 프로필 생성
        const userRef = db.collection("users").doc(uid);
        await userRef.set({
            uid,
            email,
            name,
            nickname: nickname || name,
            phone: phone || null,
            role,
            gender: gender || null,
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 3. Custom Claims 설정
        await admin.auth().setCustomUserClaims(uid, { role });

        logger.info(`Profile created and claims set for UID: ${uid}`);

        // Save consent data to Firestore if provided
        if (consents && userRecord.uid) {
            try {
                const consentRef = db.collection('users').doc(userRecord.uid).collection('consents').doc('current');

                const consentData = {
                    version: '1.0.0',
                    userId: userRecord.uid,
                    termsOfService: {
                        agreed: consents.termsOfService?.agreed ?? true,
                        version: consents.termsOfService?.version ?? '1.0.0',
                        agreedAt: admin.firestore.FieldValue.serverTimestamp(),
                    },
                    privacyPolicy: {
                        agreed: consents.privacyPolicy?.agreed ?? true,
                        version: consents.privacyPolicy?.version ?? '1.0.0',
                        agreedAt: admin.firestore.FieldValue.serverTimestamp(),
                    },
                    ...(consents.marketing?.agreed && {
                        marketing: {
                            agreed: consents.marketing.agreed,
                            agreedAt: admin.firestore.FieldValue.serverTimestamp(),
                        },
                    }),
                    ...(consents.locationService?.agreed && {
                        locationService: {
                            agreed: consents.locationService.agreed,
                            agreedAt: admin.firestore.FieldValue.serverTimestamp(),
                        },
                    }),
                    ...(consents.pushNotification?.agreed && {
                        pushNotification: {
                            agreed: consents.pushNotification.agreed,
                            agreedAt: admin.firestore.FieldValue.serverTimestamp(),
                        },
                    }),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };

                await consentRef.set(consentData);
                logger.info(`Consent data saved for user ${userRecord.uid}`);
            } catch (consentError: unknown) {
                logger.error("Error saving consent data:", consentError);
                // Don't fail the registration if consent saving fails
            }
        }

        return { success: true, message: `Registration for ${name} as ${role} is processing.` };

    } catch (error: unknown) {
        throw handleFunctionError(error, {
            operation: 'requestRegistration',
            context: { email: request.data?.email, role: request.data?.role },
        });
    }
  }
);


/**
 * Processes a registration request for a manager, either approving or rejecting it.
 * Only callable by an admin.
 */
export const processRegistration = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    try {
        requireAuth(request);
        requireRole(request, 'admin');

        const { targetUid, action } = request.data;

        // 입력 검증
        requireString(targetUid, 'targetUid');
        requireEnum(action, ['approve', 'reject'], 'action');

        const userRef = db.collection('users').doc(targetUid);

        const userDoc = await userRef.get();
        if (!userDoc.exists || userDoc.data()?.role !== 'pending_manager') {
            throw new NotFoundError({
                message: 'The specified user is not awaiting approval.',
                metadata: { resource: 'User', resourceId: targetUid },
            });
        }

        if (action === 'approve') {
            await admin.auth().updateUser(targetUid, { disabled: false });
            await admin.auth().setCustomUserClaims(targetUid, { role: 'manager' });
            await userRef.update({ role: 'manager' });
            return { success: true, message: 'User approved as manager.' };
        } else if (action === 'reject') {
            await admin.auth().deleteUser(targetUid);
            await userRef.delete();
            return { success: true, message: 'User registration rejected.' };
        }

        return { success: false };
    } catch (error: unknown) {
        throw handleFunctionError(error, {
            operation: 'processRegistration',
            context: {
                userId: request.auth?.uid,
                targetUid: request.data?.targetUid,
            },
        });
    }
  }
);

/**
 * Creates a new user account, stores details in Firestore, and sets a custom role claim.
 */
export const createUserAccount = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    try {
        requireAuth(request);
        requireRole(request, 'admin');

        const { email, name, role } = request.data;

        // 입력 검증
        requireString(email, 'email');
        requireString(name, 'name');
        requireString(role, 'role');

        const userRecord = await admin.auth().createUser({ email, displayName: name });
        await admin.auth().setCustomUserClaims(userRecord.uid, { role });
        await db.collection('users').doc(userRecord.uid).set({
            name,
            email,
            role,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { result: `Successfully created ${role}: ${name} (${email})` };
    } catch (error: unknown) {
        throw handleFunctionError(error, {
            operation: 'createUserAccount',
            context: {
                userId: request.auth?.uid,
                email: request.data?.email,
            },
        });
    }
  }
);


/**
 * Firestore trigger that automatically sets a custom user claim whenever a user's role is
 * created or changed in the 'users' collection.
 */
export const onUserRoleChange = onDocumentWritten(
  { document: 'users/{uid}', region: 'asia-northeast3' },
  async (event) => {
    const { uid } = event.params;
    const newRole = event.data?.after.exists ? event.data?.after.data()?.role : null;
    const oldRole = event.data?.before.exists ? event.data?.before.data()?.role : null;

    if (newRole === oldRole) {
        logger.info(`User ${uid}: Role unchanged (${newRole}). No action taken.`);
        return null;
    }

    try {
        logger.info(`Setting custom claim for user ${uid}. New role: ${newRole}`);
        await admin.auth().setCustomUserClaims(uid, { role: newRole });
        return { result: `Custom claim for ${uid} updated to ${newRole}.` };
    } catch (error) {
        logger.error(`Failed to set custom claim for ${uid}`, error);
        return { error: 'Failed to set custom claim.' };
    }
  }
);


// --- Dashboard Functions ---

export const getDashboardStats = onRequest(
  { region: 'asia-northeast3', cors: true },
  async (_request, response) => {
    try {
      const now = new Date();
      const ongoingEventsQuery = db.collection("events").where("endDate", ">=", now);
      const totalStaffQuery = db.collection("users").where("role", "==", "staff");
      const topStaffQuery = db.collection("users")
        .where("role", "==", "staff")
        .orderBy("rating", "desc")
        .limit(5);

      const [
        ongoingEventsSnapshot,
        totalStaffSnapshot,
        topStaffSnapshot,
      ] = await Promise.all([
        ongoingEventsQuery.get(),
        totalStaffQuery.get(),
        topStaffQuery.get(),
      ]);

      const topRatedStaff = topStaffSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
      }));

      response.status(200).send({
        data: {
          ongoingEventsCount: ongoingEventsSnapshot.size,
          totalStaffCount: totalStaffSnapshot.size,
          topRatedStaff,
        },
      });
    } catch (error) {
      logger.error("Error getting dashboard stats:", error);
      response.status(500).send({ data: { error: "Internal Server Error" } });
    }
  }
);

/**
 * Updates an existing user's details.
 * Only callable by an admin.
 */
export const updateUser = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    try {
        requireAuth(request);
        requireRole(request, 'admin');

        const { uid, name, role } = request.data;

        // 입력 검증
        requireString(uid, 'uid');
        requireString(name, 'name');
        requireString(role, 'role');

        const userRef = db.collection('users').doc(uid);
        await userRef.update({ name, role });

        return { success: true, message: `User ${uid} updated successfully.` };
    } catch (error: unknown) {
        throw handleFunctionError(error, {
            operation: 'updateUser',
            context: {
                userId: request.auth?.uid,
                targetUid: request.data?.uid,
            },
        });
    }
  }
);

/**
 * Deletes a user from Firebase Authentication and Firestore.
 * Only callable by an admin.
 */
export const deleteUser = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    try {
        requireAuth(request);
        requireRole(request, 'admin');

        const { uid } = request.data;

        // 입력 검증
        requireString(uid, 'uid');

        await admin.auth().deleteUser(uid);
        logger.info(`Successfully deleted user ${uid} from Auth.`);

        const userRef = db.collection('users').doc(uid);
        await userRef.delete();
        logger.info(`Successfully deleted user ${uid} from Firestore.`);

        return { success: true, message: `User ${uid} deleted successfully.` };
    } catch (error: unknown) {
        throw handleFunctionError(error, {
            operation: 'deleteUser',
            context: {
                userId: request.auth?.uid,
                targetUid: request.data?.uid,
            },
        });
    }
  }
);

/**
 * Logs user actions for audit trail and analytics purposes.
 * This is a "fire-and-forget" function - it should not block the client.
 */
export const logAction = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    try {
        const { action, details = {} } = request.data;

        // 입력 검증
        requireString(action, 'action');

        // Get user information from request
        const userId = request.auth?.uid || 'anonymous';
        const userEmail = request.auth?.token?.email || 'unknown';
        const userRole = request.auth?.token?.role || 'unknown';

        // Create log entry
        const logEntry = {
            action,
            details,
            userId,
            userEmail,
            userRole,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            ip: request.rawRequest?.ip || 'unknown',
            userAgent: request.rawRequest?.get('user-agent') || 'unknown'
        };

        // Store in actionLogs collection
        await db.collection('actionLogs').add(logEntry);

        // Also log to Firebase Functions logger for debugging
        logger.info(`Action logged: ${action}`, {
            userId,
            userEmail,
            userRole,
            details,
        });

        return { success: true, message: 'Action logged successfully' };

    } catch (error: unknown) {
        logger.error('Error logging action:', error);

        // Don't throw errors for logging - this should be fire-and-forget
        // Just return a success to prevent blocking the client
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
);

/**
 * Alternative HTTP endpoint version of logAction for cases where onCall doesn't work
 * This handles CORS properly for direct HTTP requests
 */
export const logActionHttp = onRequest(
  { region: 'asia-northeast3', cors: true },
  async (request, response) => {
    try {
        if (request.method !== 'POST') {
            response.status(405).send({ error: 'Method not allowed' });
            return;
        }

        const { action, details = {} } = request.body;

        if (!action) {
            response.status(400).send({ error: 'Action is required' });
            return;
        }

        // Create log entry (without auth context since this is HTTP)
        const logEntry = {
            action,
            details,
            userId: 'http_request',
            userEmail: 'unknown',
            userRole: 'unknown',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            ip: request.ip || 'unknown',
            userAgent: request.get('user-agent') || 'unknown'
        };

        // Store in actionLogs collection
        await db.collection('actionLogs').add(logEntry);

        // Log to Firebase Functions logger
        logger.info(`HTTP Action logged: ${action}`, { details });

        response.status(200).send({ success: true, message: 'Action logged successfully' });

    } catch (error: unknown) {
        logger.error('Error logging HTTP action:', error);
        response.status(200).send({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
);

// --- Performance Optimization Triggers ---

/**
 * Automatically updates applicantCount in job postings when applications are created/deleted
 */
export const updateJobPostingApplicantCount = onDocumentWritten(
  { document: 'applications/{applicationId}', region: 'asia-northeast3' },
  async (event) => {
    const applicationData = event.data?.after.exists ? event.data?.after.data() : null;
    const previousData = event.data?.before.exists ? event.data?.before.data() : null;

    // Get job posting ID from either new or old data
    const jobPostingId = applicationData?.jobPostingId || previousData?.jobPostingId;

    if (!jobPostingId) {
        logger.warn('No jobPostingId found in application document');
        return;
    }

    try {
        // Count total applications for this job posting
        const applicationsSnapshot = await db
            .collection('applications')
            .where('jobPostingId', '==', jobPostingId)
            .get();

        const applicantCount = applicationsSnapshot.size;

        // Update the job posting with the new count
        await db.collection('jobPostings').doc(jobPostingId).update({
            applicantCount,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });

        logger.info(`Updated applicantCount for job posting ${jobPostingId}: ${applicantCount}`);

    } catch (error) {
        logger.error('Error updating applicant count:', error);
        throw handleTriggerError(error, {
            operation: 'updateJobPostingApplicantCount',
            context: { jobPostingId },
        });
    }
  }
);

/**
 * Automatically updates participantCount in events when participants are added/removed
 */
export const updateEventParticipantCount = onDocumentWritten(
  { document: 'participants/{participantId}', region: 'asia-northeast3' },
  async (event) => {
    const participantData = event.data?.after.exists ? event.data?.after.data() : null;
    const previousData = event.data?.before.exists ? event.data?.before.data() : null;

    // Get event ID from either new or old data
    const eventId = participantData?.eventId || previousData?.eventId;

    if (!eventId) {
        logger.warn('No eventId found in participant document');
        return;
    }

    try {
        // Count total participants for this event
        const participantsSnapshot = await db
            .collection('participants')
            .where('eventId', '==', eventId)
            .get();

        const participantCount = participantsSnapshot.size;

        // Update the event with the new count
        await db.collection('events').doc(eventId).update({
            participantCount,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });

        logger.info(`Updated participantCount for event ${eventId}: ${participantCount}`);

    } catch (error) {
        logger.error('Error updating participant count:', error);
        throw handleTriggerError(error, {
            operation: 'updateEventParticipantCount',
            context: { eventId },
        });
    }
  }
);
