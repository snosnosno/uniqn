"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordAttendance = exports.generateEventQrToken = exports.assignDealerToEvent = exports.matchDealersToEvent = exports.validateJobPostingData = exports.onWorkDateExpired = exports.expireByLastWorkDate = exports.onFixedPostingExpired = exports.manualExpireFixedPostings = exports.expireFixedPostings = exports.onTournamentApprovalChange = exports.resubmitJobPosting = exports.rejectJobPosting = exports.approveJobPosting = exports.recordLoginFailure = exports.sendLoginNotification = exports.forceDeleteAccount = exports.processScheduledDeletions = exports.decrementUnreadCounter = exports.initializeUnreadCounter = exports.resetUnreadCounter = exports.onNotificationDeleted = exports.onNotificationRead = exports.onTournamentPostingCreated = exports.onInquiryCreated = exports.onReportCreated = exports.onJobPostingClosed = exports.onSettlementCompleted = exports.onNoShow = exports.onJobPostingCancelled = exports.onJobPostingUpdated = exports.onCheckInOut = exports.onScheduleCancelled = exports.onScheduleCreated = exports.onWorkTimeChanged = exports.onApplicationStatusChanged = exports.onApplicationSubmitted = exports.sendSystemAnnouncement = exports.sendJobPostingAnnouncement = exports.getVerificationStatus = exports.verifyPhoneCode = exports.sendPhoneVerificationCode = exports.sendReceiptEmail = exports.backfillCiIndex = exports.linkIdentityVerification = exports.verifyIdentity = exports.cleanupPendingVerificationsScheduled = exports.cleanupExpiredTokensScheduled = exports.retryFailedCounterOpsScheduled = exports.cleanupRateLimitsScheduled = void 0;
exports.updateEventParticipantCount = exports.updateJobPostingApplicantCount = exports.logActionHttp = exports.logAction = exports.deleteUser = exports.updateUser = exports.getDashboardStats = exports.onUserRoleChange = exports.createUserAccount = exports.processRegistration = exports.requestRegistration = exports.migrateJobPostings = exports.submitDealerRating = exports.getPayrolls = exports.calculatePayrollsForEvent = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const cors_1 = __importDefault(require("cors"));
const sentry_1 = require("./utils/sentry");
// Initialize Firebase Admin
admin.initializeApp();
// Initialize Firestore
const db = admin.firestore();
// Initialize Sentry (에러 트래킹)
(0, sentry_1.initSentry)();
// CORS handler
const corsHandler = (0, cors_1.default)({ origin: true });
// --- Scheduled Functions ---
var cleanupRateLimits_1 = require("./scheduled/cleanupRateLimits");
Object.defineProperty(exports, "cleanupRateLimitsScheduled", { enumerable: true, get: function () { return cleanupRateLimits_1.cleanupRateLimitsScheduled; } });
var retryFailedCounterOps_1 = require("./scheduled/retryFailedCounterOps");
Object.defineProperty(exports, "retryFailedCounterOpsScheduled", { enumerable: true, get: function () { return retryFailedCounterOps_1.retryFailedCounterOpsScheduled; } });
var cleanupExpiredTokens_1 = require("./scheduled/cleanupExpiredTokens");
Object.defineProperty(exports, "cleanupExpiredTokensScheduled", { enumerable: true, get: function () { return cleanupExpiredTokens_1.cleanupExpiredTokensScheduled; } });
var cleanupPendingVerifications_1 = require("./scheduled/cleanupPendingVerifications");
Object.defineProperty(exports, "cleanupPendingVerificationsScheduled", { enumerable: true, get: function () { return cleanupPendingVerifications_1.cleanupPendingVerificationsScheduled; } });
// --- Identity Verification Functions ---
var verifyIdentity_1 = require("./auth/verifyIdentity");
Object.defineProperty(exports, "verifyIdentity", { enumerable: true, get: function () { return verifyIdentity_1.verifyIdentity; } });
var linkIdentityVerification_1 = require("./auth/linkIdentityVerification");
Object.defineProperty(exports, "linkIdentityVerification", { enumerable: true, get: function () { return linkIdentityVerification_1.linkIdentityVerification; } });
// --- Migration Functions ---
var backfillCiIndex_1 = require("./migrations/backfillCiIndex");
Object.defineProperty(exports, "backfillCiIndex", { enumerable: true, get: function () { return backfillCiIndex_1.backfillCiIndex; } });
// --- Email Functions ---
var sendReceipt_1 = require("./email/sendReceipt");
Object.defineProperty(exports, "sendReceiptEmail", { enumerable: true, get: function () { return sendReceipt_1.sendReceiptEmail; } });
// --- Phone Verification Functions ---
var phoneVerification_1 = require("./auth/phoneVerification");
Object.defineProperty(exports, "sendPhoneVerificationCode", { enumerable: true, get: function () { return phoneVerification_1.sendPhoneVerificationCode; } });
Object.defineProperty(exports, "verifyPhoneCode", { enumerable: true, get: function () { return phoneVerification_1.verifyPhoneCode; } });
Object.defineProperty(exports, "getVerificationStatus", { enumerable: true, get: function () { return phoneVerification_1.getVerificationStatus; } });
// --- Notification Functions ---
var sendJobPostingAnnouncement_1 = require("./notifications/sendJobPostingAnnouncement");
Object.defineProperty(exports, "sendJobPostingAnnouncement", { enumerable: true, get: function () { return sendJobPostingAnnouncement_1.sendJobPostingAnnouncement; } });
var sendSystemAnnouncement_1 = require("./notifications/sendSystemAnnouncement");
Object.defineProperty(exports, "sendSystemAnnouncement", { enumerable: true, get: function () { return sendSystemAnnouncement_1.sendSystemAnnouncement; } });
var onApplicationSubmitted_1 = require("./notifications/onApplicationSubmitted");
Object.defineProperty(exports, "onApplicationSubmitted", { enumerable: true, get: function () { return onApplicationSubmitted_1.onApplicationSubmitted; } });
var onApplicationStatusChanged_1 = require("./notifications/onApplicationStatusChanged");
Object.defineProperty(exports, "onApplicationStatusChanged", { enumerable: true, get: function () { return onApplicationStatusChanged_1.onApplicationStatusChanged; } });
var onWorkTimeChanged_1 = require("./notifications/onWorkTimeChanged");
Object.defineProperty(exports, "onWorkTimeChanged", { enumerable: true, get: function () { return onWorkTimeChanged_1.onWorkTimeChanged; } });
var onScheduleChanged_1 = require("./notifications/onScheduleChanged");
Object.defineProperty(exports, "onScheduleCreated", { enumerable: true, get: function () { return onScheduleChanged_1.onScheduleCreated; } });
Object.defineProperty(exports, "onScheduleCancelled", { enumerable: true, get: function () { return onScheduleChanged_1.onScheduleCancelled; } });
var onCheckInOut_1 = require("./notifications/onCheckInOut");
Object.defineProperty(exports, "onCheckInOut", { enumerable: true, get: function () { return onCheckInOut_1.onCheckInOut; } });
var onJobPostingUpdated_1 = require("./notifications/onJobPostingUpdated");
Object.defineProperty(exports, "onJobPostingUpdated", { enumerable: true, get: function () { return onJobPostingUpdated_1.onJobPostingUpdated; } });
var onJobPostingCancelled_1 = require("./notifications/onJobPostingCancelled");
Object.defineProperty(exports, "onJobPostingCancelled", { enumerable: true, get: function () { return onJobPostingCancelled_1.onJobPostingCancelled; } });
var onNoShow_1 = require("./notifications/onNoShow");
Object.defineProperty(exports, "onNoShow", { enumerable: true, get: function () { return onNoShow_1.onNoShow; } });
var onSettlementCompleted_1 = require("./notifications/onSettlementCompleted");
Object.defineProperty(exports, "onSettlementCompleted", { enumerable: true, get: function () { return onSettlementCompleted_1.onSettlementCompleted; } });
var onJobPostingClosed_1 = require("./notifications/onJobPostingClosed");
Object.defineProperty(exports, "onJobPostingClosed", { enumerable: true, get: function () { return onJobPostingClosed_1.onJobPostingClosed; } });
var onReportCreated_1 = require("./notifications/onReportCreated");
Object.defineProperty(exports, "onReportCreated", { enumerable: true, get: function () { return onReportCreated_1.onReportCreated; } });
var onInquiryCreated_1 = require("./notifications/onInquiryCreated");
Object.defineProperty(exports, "onInquiryCreated", { enumerable: true, get: function () { return onInquiryCreated_1.onInquiryCreated; } });
var onTournamentPostingCreated_1 = require("./notifications/onTournamentPostingCreated");
Object.defineProperty(exports, "onTournamentPostingCreated", { enumerable: true, get: function () { return onTournamentPostingCreated_1.onTournamentPostingCreated; } });
var onNotificationRead_1 = require("./notifications/onNotificationRead");
Object.defineProperty(exports, "onNotificationRead", { enumerable: true, get: function () { return onNotificationRead_1.onNotificationRead; } });
var onNotificationDeleted_1 = require("./notifications/onNotificationDeleted");
Object.defineProperty(exports, "onNotificationDeleted", { enumerable: true, get: function () { return onNotificationDeleted_1.onNotificationDeleted; } });
var resetUnreadCounter_1 = require("./notifications/resetUnreadCounter");
Object.defineProperty(exports, "resetUnreadCounter", { enumerable: true, get: function () { return resetUnreadCounter_1.resetUnreadCounter; } });
var initializeUnreadCounter_1 = require("./notifications/initializeUnreadCounter");
Object.defineProperty(exports, "initializeUnreadCounter", { enumerable: true, get: function () { return initializeUnreadCounter_1.initializeUnreadCounter; } });
var decrementUnreadCounterCallable_1 = require("./notifications/decrementUnreadCounterCallable");
Object.defineProperty(exports, "decrementUnreadCounter", { enumerable: true, get: function () { return decrementUnreadCounterCallable_1.decrementUnreadCounterCallable; } });
// --- Account Management Functions ---
var scheduledDeletion_1 = require("./account/scheduledDeletion");
Object.defineProperty(exports, "processScheduledDeletions", { enumerable: true, get: function () { return scheduledDeletion_1.processScheduledDeletions; } });
Object.defineProperty(exports, "forceDeleteAccount", { enumerable: true, get: function () { return scheduledDeletion_1.forceDeleteAccount; } });
var loginNotification_1 = require("./account/loginNotification");
Object.defineProperty(exports, "sendLoginNotification", { enumerable: true, get: function () { return loginNotification_1.sendLoginNotification; } });
Object.defineProperty(exports, "recordLoginFailure", { enumerable: true, get: function () { return loginNotification_1.recordLoginFailure; } });
// --- Job Posting Approval Functions (Phase 7) ---
var approveJobPosting_1 = require("./api/jobPostings/approveJobPosting");
Object.defineProperty(exports, "approveJobPosting", { enumerable: true, get: function () { return approveJobPosting_1.approveJobPosting; } });
var rejectJobPosting_1 = require("./api/jobPostings/rejectJobPosting");
Object.defineProperty(exports, "rejectJobPosting", { enumerable: true, get: function () { return rejectJobPosting_1.rejectJobPosting; } });
var resubmitJobPosting_1 = require("./api/jobPostings/resubmitJobPosting");
Object.defineProperty(exports, "resubmitJobPosting", { enumerable: true, get: function () { return resubmitJobPosting_1.resubmitJobPosting; } });
var onTournamentApprovalChange_1 = require("./triggers/onTournamentApprovalChange");
Object.defineProperty(exports, "onTournamentApprovalChange", { enumerable: true, get: function () { return onTournamentApprovalChange_1.onTournamentApprovalChange; } });
// --- Job Posting Scheduled Functions (Phase 5) ---
var expireFixedPostings_1 = require("./scheduled/expireFixedPostings");
Object.defineProperty(exports, "expireFixedPostings", { enumerable: true, get: function () { return expireFixedPostings_1.expireFixedPostings; } });
Object.defineProperty(exports, "manualExpireFixedPostings", { enumerable: true, get: function () { return expireFixedPostings_1.manualExpireFixedPostings; } });
var onFixedPostingExpired_1 = require("./triggers/onFixedPostingExpired");
Object.defineProperty(exports, "onFixedPostingExpired", { enumerable: true, get: function () { return onFixedPostingExpired_1.onFixedPostingExpired; } });
var expireByLastWorkDate_1 = require("./scheduled/expireByLastWorkDate");
Object.defineProperty(exports, "expireByLastWorkDate", { enumerable: true, get: function () { return expireByLastWorkDate_1.expireByLastWorkDate; } });
var onWorkDateExpired_1 = require("./triggers/onWorkDateExpired");
Object.defineProperty(exports, "onWorkDateExpired", { enumerable: true, get: function () { return onWorkDateExpired_1.onWorkDateExpired; } });
/**
 * Firestore trigger that automatically validates and fixes job posting data
 * when a new job posting is created or updated
 */
exports.validateJobPostingData = functions.region('asia-northeast3').firestore.document("jobPostings/{postId}").onWrite(async (change, context) => {
    const postId = context.params.postId;
    // Skip if document was deleted
    if (!change.after.exists) {
        return;
    }
    const data = change.after.data();
    if (!data)
        return;
    let needsUpdate = false;
    const updates = {};
    // Auto-generate requiredRoles if missing
    if (!data.requiredRoles && data.timeSlots) {
        const requiredRoles = Array.from(new Set(data.timeSlots.flatMap((ts) => ts.roles ? ts.roles.map((r) => r.name) : [])));
        updates.requiredRoles = requiredRoles;
        needsUpdate = true;
        functions.logger.info(`Auto-generating requiredRoles for post ${postId}:`, requiredRoles);
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
        functions.logger.info(`Auto-generating searchIndex for post ${postId}`);
    }
    // Convert string dates to Timestamp if needed
    if (data.startDate && typeof data.startDate === 'string') {
        updates.startDate = admin.firestore.Timestamp.fromDate(new Date(data.startDate));
        needsUpdate = true;
        functions.logger.info(`Converting startDate to Timestamp for post ${postId}`);
    }
    if (data.endDate && typeof data.endDate === 'string') {
        updates.endDate = admin.firestore.Timestamp.fromDate(new Date(data.endDate));
        needsUpdate = true;
        functions.logger.info(`Converting endDate to Timestamp for post ${postId}`);
    }
    // Apply updates if needed
    if (needsUpdate) {
        try {
            await change.after.ref.update(updates);
            functions.logger.info(`Auto-fixed job posting ${postId}`, updates);
        }
        catch (error) {
            functions.logger.error(`Failed to auto-fix job posting ${postId}:`, error);
        }
    }
});
exports.matchDealersToEvent = functions.region('asia-northeast3').https.onCall(async (data, context) => { });
exports.assignDealerToEvent = functions.region('asia-northeast3').https.onCall(async (data, context) => { });
exports.generateEventQrToken = functions.region('asia-northeast3').https.onCall(async (data, context) => { });
exports.recordAttendance = functions.region('asia-northeast3').https.onCall(async (data, context) => { });
exports.calculatePayrollsForEvent = functions.region('asia-northeast3').https.onCall(async (data, context) => { });
exports.getPayrolls = functions.region('asia-northeast3').https.onCall(async (data, context) => { });
exports.submitDealerRating = functions.region('asia-northeast3').https.onCall(async (data, context) => { });
// --- Data Migration Functions ---
/**
 * Migrates existing job postings to include requiredRoles and proper date formats
 * Only callable by admin users
 */
exports.migrateJobPostings = functions.region('asia-northeast3').https.onCall(async (data, context) => {
    // Check admin permissions
    if (context.auth?.token?.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can run data migrations.');
    }
    functions.logger.info("Starting job postings migration...");
    try {
        const jobPostingsRef = db.collection('jobPostings');
        const snapshot = await jobPostingsRef.get();
        let migratedCount = 0;
        let skippedCount = 0;
        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            const data = doc.data();
            let needsUpdate = false;
            const updates = {};
            // Check if requiredRoles field is missing
            if (!data.requiredRoles && data.timeSlots) {
                const requiredRoles = Array.from(new Set(data.timeSlots.flatMap((ts) => ts.roles ? ts.roles.map((r) => r.name) : [])));
                updates.requiredRoles = requiredRoles;
                needsUpdate = true;
            }
            // Check if searchIndex field is missing
            if (!data.searchIndex) {
                const searchIndex = [
                    data.title || '',
                    data.location || '',
                    data.description || '',
                    ...(updates.requiredRoles || data.requiredRoles || [])
                ].join(' ').toLowerCase().split(/\s+/).filter(word => word.length > 0);
                updates.searchIndex = searchIndex;
                needsUpdate = true;
            }
            // Check if dates need conversion to Timestamp
            if (data.startDate && typeof data.startDate === 'string') {
                updates.startDate = admin.firestore.Timestamp.fromDate(new Date(data.startDate));
                needsUpdate = true;
            }
            if (data.endDate && typeof data.endDate === 'string') {
                updates.endDate = admin.firestore.Timestamp.fromDate(new Date(data.endDate));
                needsUpdate = true;
            }
            if (needsUpdate) {
                batch.update(doc.ref, updates);
                migratedCount++;
            }
            else {
                skippedCount++;
            }
        });
        if (migratedCount > 0) {
            await batch.commit();
        }
        functions.logger.info(`Migration completed: ${migratedCount} updated, ${skippedCount} skipped`);
        return {
            success: true,
            message: `Migration completed successfully`,
            stats: {
                total: snapshot.docs.length,
                migrated: migratedCount,
                skipped: skippedCount
            }
        };
    }
    catch (error) {
        functions.logger.error("Migration failed:", error);
        throw new functions.https.HttpsError('internal', 'Migration failed', error.message);
    }
});
// --- Authentication and Role Management Functions ---
/**
 * Handles a new user registration request.
 * - Dealers are created and enabled immediately.
 * - Managers are created as disabled and await admin approval.
 * - Passes extra data (phone, gender) via displayName for the trigger.
 */
exports.requestRegistration = functions.region('asia-northeast3').https.onCall(async (data) => {
    functions.logger.info("requestRegistration called with data:", data);
    const { email, password, name, nickname, role, phone, gender, consents } = data;
    if (!email || !password || !name || !role) {
        functions.logger.error("Validation failed: Missing required fields.", { data });
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields for registration.');
    }
    // 웹앱에서는 employer로 가입
    const validRoles = ['employer', 'staff'];
    if (!validRoles.includes(role)) {
        functions.logger.error("Validation failed: Invalid role.", { role });
        throw new functions.https.HttpsError('invalid-argument', `Role must be one of: ${validRoles.join(', ')}`);
    }
    try {
        // 1. Firebase Auth 사용자 생성
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: name,
            disabled: false,
            emailVerified: false,
        });
        const uid = userRecord.uid;
        functions.logger.info(`User created successfully: ${email} (UID: ${uid})`);
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
        functions.logger.info(`Profile created and claims set for UID: ${uid}`);
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
                functions.logger.info(`Consent data saved for user ${userRecord.uid}`);
            }
            catch (consentError) {
                functions.logger.error("Error saving consent data:", consentError);
                // Don't fail the registration if consent saving fails
            }
        }
        return { success: true, message: `Registration for ${name} as ${role} is processing.` };
    }
    catch (error) {
        functions.logger.error("Error during registration request:", error);
        const errorCode = error.code;
        switch (errorCode) {
            case 'auth/email-already-exists':
                throw new functions.https.HttpsError('already-exists', 'This email address is already in use by another account.');
            case 'auth/invalid-email':
                throw new functions.https.HttpsError('invalid-argument', 'The email address is not valid.', { originalCode: errorCode });
            case 'auth/weak-password':
                throw new functions.https.HttpsError('invalid-argument', 'The password is too weak. Please use a stronger password.', { originalCode: errorCode });
            case 'auth/operation-not-allowed':
                throw new functions.https.HttpsError('unimplemented', 'Email/password sign-in is not enabled.', { originalCode: errorCode });
            default:
                throw new functions.https.HttpsError('internal', 'An unexpected error occurred during registration.', { originalCode: errorCode || 'unknown' });
        }
    }
});
/**
 * Processes a registration request for a manager, either approving or rejecting it.
 * Only callable by an admin.
 */
exports.processRegistration = functions.region('asia-northeast3').https.onCall(async (data, context) => {
    if (context.auth?.token?.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can process registration requests.');
    }
    const { targetUid, action } = data; // action can be 'approve' or 'reject'
    if (!targetUid || !action) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing "targetUid" or "action".');
    }
    const userRef = db.collection('users').doc(targetUid);
    try {
        const userDoc = await userRef.get();
        if (!userDoc.exists || userDoc.data()?.role !== 'pending_manager') {
            throw new functions.https.HttpsError('not-found', 'The specified user is not awaiting approval.');
        }
        if (action === 'approve') {
            await admin.auth().updateUser(targetUid, { disabled: false });
            await admin.auth().setCustomUserClaims(targetUid, { role: 'manager' });
            await userRef.update({ role: 'manager' });
            return { success: true, message: 'User approved as manager.' };
        }
        else if (action === 'reject') {
            await admin.auth().deleteUser(targetUid);
            await userRef.delete();
            return { success: true, message: 'User registration rejected.' };
        }
        else {
            throw new functions.https.HttpsError('invalid-argument', 'Action must be "approve" or "reject".');
        }
    }
    catch (error) {
        functions.logger.error("Error processing registration:", error);
        throw new functions.https.HttpsError('internal', 'Failed to process registration.', error.message);
    }
});
/**
 * Creates a new user account, stores details in Firestore, and sets a custom role claim.
 */
exports.createUserAccount = functions.region('asia-northeast3').https.onCall(async (data, context) => {
    if (context.auth?.token?.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can create new user accounts.');
    }
    const { email, name, role } = data;
    if (!email || !name || !role) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with "email", "name", and "role" arguments.');
    }
    try {
        const userRecord = await admin.auth().createUser({ email, displayName: name });
        await admin.auth().setCustomUserClaims(userRecord.uid, { role });
        await db.collection('users').doc(userRecord.uid).set({
            name,
            email,
            role,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { result: `Successfully created ${role}: ${name} (${email})` };
    }
    catch (error) {
        functions.logger.error("Error creating new user:", error);
        throw new functions.https.HttpsError('internal', error.message, error);
    }
});
/**
 * Firestore trigger that automatically sets a custom user claim whenever a user's role is
 * created or changed in the 'users' collection.
 */
exports.onUserRoleChange = functions.region('asia-northeast3').firestore.document('users/{uid}').onWrite(async (change, context) => {
    const { uid } = context.params;
    const newRole = change.after.exists ? change.after.data()?.role : null;
    const oldRole = change.before.exists ? change.before.data()?.role : null;
    if (newRole === oldRole) {
        functions.logger.info(`User ${uid}: Role unchanged (${newRole}). No action taken.`);
        return null;
    }
    try {
        functions.logger.info(`Setting custom claim for user ${uid}. New role: ${newRole}`);
        await admin.auth().setCustomUserClaims(uid, { role: newRole });
        return { result: `Custom claim for ${uid} updated to ${newRole}.` };
    }
    catch (error) {
        functions.logger.error(`Failed to set custom claim for ${uid}`, error);
        return { error: 'Failed to set custom claim.' };
    }
});
// --- Dashboard Functions ---
exports.getDashboardStats = functions.region('asia-northeast3').https.onRequest((request, response) => {
    corsHandler(request, response, async () => {
        try {
            const now = new Date();
            const ongoingEventsQuery = db.collection("events").where("endDate", ">=", now);
            const totalStaffQuery = db.collection("users").where("role", "==", "staff");
            const topStaffQuery = db.collection("users")
                .where("role", "==", "staff")
                .orderBy("rating", "desc")
                .limit(5);
            const [ongoingEventsSnapshot, totalStaffSnapshot, topStaffSnapshot,] = await Promise.all([
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
        }
        catch (error) {
            functions.logger.error("Error getting dashboard stats:", error);
            response.status(500).send({ data: { error: "Internal Server Error" } });
        }
    });
});
/**
 * Updates an existing user's details.
 * Only callable by an admin.
 */
exports.updateUser = functions.region('asia-northeast3').https.onCall(async (data, context) => {
    if (context.auth?.token?.role !== 'admin') {
        functions.logger.error("updateUser denied", { auth: context.auth });
        throw new functions.https.HttpsError('permission-denied', 'Only admins can update users.');
    }
    const { uid, name, role } = data;
    if (!uid || !name || !role) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: "uid", "name", or "role".');
    }
    try {
        const userRef = db.collection('users').doc(uid);
        await userRef.update({ name, role });
        return { success: true, message: `User ${uid} updated successfully.` };
    }
    catch (error) {
        functions.logger.error(`Error updating user ${uid}:`, error);
        throw new functions.https.HttpsError('internal', 'Failed to update user.', error.message);
    }
});
/**
 * Deletes a user from Firebase Authentication and Firestore.
 * Only callable by an admin.
 */
exports.deleteUser = functions.region('asia-northeast3').https.onCall(async (data, context) => {
    if (context.auth?.token?.role !== 'admin') {
        functions.logger.error("deleteUser denied", { auth: context.auth });
        throw new functions.https.HttpsError('permission-denied', 'Only admins can delete users.');
    }
    const { uid } = data;
    if (!uid) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required field: "uid".');
    }
    try {
        await admin.auth().deleteUser(uid);
        functions.logger.info(`Successfully deleted user ${uid} from Auth.`);
        const userRef = db.collection('users').doc(uid);
        await userRef.delete();
        functions.logger.info(`Successfully deleted user ${uid} from Firestore.`);
        return { success: true, message: `User ${uid} deleted successfully.` };
    }
    catch (error) {
        functions.logger.error(`Error deleting user ${uid}:`, error);
        throw new functions.https.HttpsError('internal', 'Failed to delete user.', error.message);
    }
});
/**
 * Logs user actions for audit trail and analytics purposes.
 * This is a "fire-and-forget" function - it should not block the client.
 */
exports.logAction = functions.region('asia-northeast3').https.onCall(async (data, context) => {
    try {
        const { action, details = {} } = data;
        if (!action) {
            throw new functions.https.HttpsError('invalid-argument', 'Action is required.');
        }
        // Get user information from context
        const userId = context.auth?.uid || 'anonymous';
        const userEmail = context.auth?.token?.email || 'unknown';
        const userRole = context.auth?.token?.role || 'unknown';
        // Create log entry
        const logEntry = {
            action,
            details,
            userId,
            userEmail,
            userRole,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            ip: context.rawRequest?.ip || 'unknown',
            userAgent: context.rawRequest?.get('user-agent') || 'unknown'
        };
        // Store in actionLogs collection
        await db.collection('actionLogs').add(logEntry);
        // Also log to Firebase Functions logger for debugging
        functions.logger.info(`Action logged: ${action}`, {
            userId,
            userEmail,
            userRole,
            details,
        });
        return { success: true, message: 'Action logged successfully' };
    }
    catch (error) {
        functions.logger.error('Error logging action:', error);
        // Don't throw errors for logging - this should be fire-and-forget
        // Just return a success to prevent blocking the client
        return { success: false, error: error.message };
    }
});
/**
 * Alternative HTTP endpoint version of logAction for cases where onCall doesn't work
 * This handles CORS properly for direct HTTP requests
 */
exports.logActionHttp = functions.region('asia-northeast3').https.onRequest((request, response) => {
    corsHandler(request, response, async () => {
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
            functions.logger.info(`HTTP Action logged: ${action}`, { details });
            response.status(200).send({ success: true, message: 'Action logged successfully' });
        }
        catch (error) {
            functions.logger.error('Error logging HTTP action:', error);
            response.status(200).send({ success: false, error: error.message });
        }
    });
});
// --- Performance Optimization Triggers ---
/**
 * Automatically updates applicantCount in job postings when applications are created/deleted
 */
exports.updateJobPostingApplicantCount = functions.region('asia-northeast3').firestore
    .document('applications/{applicationId}')
    .onWrite(async (change, context) => {
    const applicationData = change.after.exists ? change.after.data() : null;
    const previousData = change.before.exists ? change.before.data() : null;
    // Get job posting ID from either new or old data
    const jobPostingId = applicationData?.jobPostingId || previousData?.jobPostingId;
    if (!jobPostingId) {
        functions.logger.warn('No jobPostingId found in application document');
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
        functions.logger.info(`Updated applicantCount for job posting ${jobPostingId}: ${applicantCount}`);
    }
    catch (error) {
        functions.logger.error('Error updating applicant count:', error);
    }
});
/**
 * Automatically updates participantCount in events when participants are added/removed
 */
exports.updateEventParticipantCount = functions.region('asia-northeast3').firestore
    .document('participants/{participantId}')
    .onWrite(async (change, context) => {
    const participantData = change.after.exists ? change.after.data() : null;
    const previousData = change.before.exists ? change.before.data() : null;
    // Get event ID from either new or old data
    const eventId = participantData?.eventId || previousData?.eventId;
    if (!eventId) {
        functions.logger.warn('No eventId found in participant document');
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
        functions.logger.info(`Updated participantCount for event ${eventId}: ${participantCount}`);
    }
    catch (error) {
        functions.logger.error('Error updating participant count:', error);
    }
});
//# sourceMappingURL=index.js.map