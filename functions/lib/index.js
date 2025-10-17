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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateEventParticipantCount = exports.updateJobPostingApplicantCount = exports.logActionHttp = exports.logAction = exports.deleteUser = exports.updateUser = exports.getDashboardStats = exports.onUserRoleChange = exports.createUserData = exports.createUserAccount = exports.processRegistration = exports.requestRegistration = exports.migrateJobPostings = exports.submitDealerRating = exports.getPayrolls = exports.calculatePayrollsForEvent = exports.recordAttendance = exports.generateEventQrToken = exports.assignDealerToEvent = exports.matchDealersToEvent = exports.validateJobPostingData = exports.onJobPostingCreated = exports.onApplicationStatusChange = exports.broadcastNewJobPosting = exports.onWorkTimeChanged = exports.onApplicationStatusChanged = exports.onApplicationSubmitted = exports.sendJobPostingAnnouncement = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const cors_1 = __importDefault(require("cors"));
// Initialize Firebase Admin
admin.initializeApp();
// Initialize Firestore
const db = admin.firestore();
// CORS handler
const corsHandler = (0, cors_1.default)({ origin: true });
// --- Notification Functions ---
var sendJobPostingAnnouncement_1 = require("./notifications/sendJobPostingAnnouncement");
Object.defineProperty(exports, "sendJobPostingAnnouncement", { enumerable: true, get: function () { return sendJobPostingAnnouncement_1.sendJobPostingAnnouncement; } });
var onApplicationSubmitted_1 = require("./notifications/onApplicationSubmitted");
Object.defineProperty(exports, "onApplicationSubmitted", { enumerable: true, get: function () { return onApplicationSubmitted_1.onApplicationSubmitted; } });
var onApplicationStatusChanged_1 = require("./notifications/onApplicationStatusChanged");
Object.defineProperty(exports, "onApplicationStatusChanged", { enumerable: true, get: function () { return onApplicationStatusChanged_1.onApplicationStatusChanged; } });
var onWorkTimeChanged_1 = require("./notifications/onWorkTimeChanged");
Object.defineProperty(exports, "onWorkTimeChanged", { enumerable: true, get: function () { return onWorkTimeChanged_1.onWorkTimeChanged; } });
var broadcastNewJobPosting_1 = require("./notifications/broadcastNewJobPosting");
Object.defineProperty(exports, "broadcastNewJobPosting", { enumerable: true, get: function () { return broadcastNewJobPosting_1.broadcastNewJobPosting; } });
// --- Existing Functions (placeholders for brevity) ---
exports.onApplicationStatusChange = functions.firestore.document('applications/{applicationId}').onUpdate(async (change, context) => { });
exports.onJobPostingCreated = functions.firestore.document("jobPostings/{postId}").onCreate(async (snap, context) => { });
/**
 * Firestore trigger that automatically validates and fixes job posting data
 * when a new job posting is created or updated
 */
exports.validateJobPostingData = functions.firestore.document("jobPostings/{postId}").onWrite(async (change, context) => {
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
exports.matchDealersToEvent = functions.https.onCall(async (data, context) => { });
exports.assignDealerToEvent = functions.https.onCall(async (data, context) => { });
exports.generateEventQrToken = functions.https.onCall(async (data, context) => { });
exports.recordAttendance = functions.https.onCall(async (data, context) => { });
exports.calculatePayrollsForEvent = functions.https.onCall(async (data, context) => { });
exports.getPayrolls = functions.https.onCall(async (data, context) => { });
exports.submitDealerRating = functions.https.onCall(async (data, context) => { });
// --- Data Migration Functions ---
/**
 * Migrates existing job postings to include requiredRoles and proper date formats
 * Only callable by admin users
 */
exports.migrateJobPostings = functions.https.onCall(async (data, context) => {
    var _a, _b;
    // Check admin permissions
    if (((_b = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.token) === null || _b === void 0 ? void 0 : _b.role) !== 'admin') {
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
exports.requestRegistration = functions.https.onCall(async (data) => {
    functions.logger.info("requestRegistration called with data:", data);
    const { email, password, name, role, phone, gender } = data;
    if (!email || !password || !name || !role) {
        functions.logger.error("Validation failed: Missing required fields.", { data });
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields for registration.');
        if (role !== 'staff' && role !== 'manager') {
            functions.logger.error("Validation failed: Invalid role.", { role });
            throw new functions.https.HttpsError('invalid-argument', 'Role must be either "staff" or "manager".');
        }
    }
    try {
        const isManager = role === 'manager';
        // Combine extra profile data into a parsable JSON string.
        const extraData = JSON.stringify(Object.assign(Object.assign({}, (phone && { phone })), (gender && { gender })));
        // Build the displayName with embedded markers for the trigger to parse.
        // Format: "Real Name [{...extraData}] [PENDING_MANAGER]"
        let displayNameForAuth = `${name} [${extraData}]`;
        if (isManager) {
            displayNameForAuth += ' [PENDING_MANAGER]';
        }
        await admin.auth().createUser({
            email,
            password,
            displayName: displayNameForAuth,
            disabled: isManager,
        });
        return { success: true, message: `Registration for ${name} as ${role} is processing.` };
    }
    catch (error) {
        console.error("Error during registration request:", error);
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
exports.processRegistration = functions.https.onCall(async (data, context) => {
    var _a, _b, _c;
    if (((_b = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.token) === null || _b === void 0 ? void 0 : _b.role) !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can process registration requests.');
    }
    const { targetUid, action } = data; // action can be 'approve' or 'reject'
    if (!targetUid || !action) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing "targetUid" or "action".');
    }
    const userRef = db.collection('users').doc(targetUid);
    try {
        const userDoc = await userRef.get();
        if (!userDoc.exists || ((_c = userDoc.data()) === null || _c === void 0 ? void 0 : _c.role) !== 'pending_manager') {
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
        console.error("Error processing registration:", error);
        throw new functions.https.HttpsError('internal', 'Failed to process registration.', error.message);
    }
});
/**
 * Creates a new user account, stores details in Firestore, and sets a custom role claim.
 */
exports.createUserAccount = functions.https.onCall(async (data, context) => {
    var _a, _b;
    if (((_b = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.token) === null || _b === void 0 ? void 0 : _b.role) !== 'admin') {
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
        console.error("Error creating new user:", error);
        throw new functions.https.HttpsError('internal', error.message, error);
    }
});
/**
 * Firestore trigger that automatically creates a user document in Firestore
 * when a new user is created in Firebase Authentication.
 * This handles all user creation sources and parses extra data from the displayName.
 */
exports.createUserData = functions.auth.user().onCreate(async (user) => {
    const { uid, email, displayName, phoneNumber } = user;
    const userRef = db.collection("users").doc(uid);
    functions.logger.info(`New user: ${email} (UID: ${uid}). Parsing displayName: "${displayName}"`);
    let initialRole = 'staff';
    let finalDisplayName = "Unnamed User";
    let extraData = { phone: phoneNumber || null };
    if (displayName) {
        const extraDataMatch = displayName.match(/\[(\{.*\})\]/);
        const pendingManagerMatch = displayName.includes('[PENDING_MANAGER]');
        finalDisplayName = displayName
            .replace(/\[PENDING_MANAGER\]/g, '')
            .replace(/\[(\{.*\})\]/g, '')
            .trim();
        if (finalDisplayName === "")
            finalDisplayName = "Unnamed User";
        if (pendingManagerMatch)
            initialRole = 'pending_manager';
        if (extraDataMatch && extraDataMatch[1]) {
            try {
                const parsedData = JSON.parse(extraDataMatch[1]);
                extraData = Object.assign(Object.assign({}, extraData), parsedData);
            }
            catch (e) {
                functions.logger.error(`Failed to parse extra data from displayName for UID ${uid}`, { displayName, e });
            }
        }
    }
    try {
        await userRef.set(Object.assign({ name: finalDisplayName, email: email, role: initialRole, createdAt: admin.firestore.FieldValue.serverTimestamp() }, extraData));
        await admin.auth().setCustomUserClaims(uid, { role: initialRole });
        if (initialRole === 'pending_manager') {
            await admin.auth().updateUser(uid, { disabled: true });
        }
        functions.logger.info(`Successfully created Firestore document/claims for UID: ${uid}`);
    }
    catch (error) {
        functions.logger.error(`Failed to create Firestore document for UID: ${uid}`, error);
    }
    return null;
});
/**
 * Firestore trigger that automatically sets a custom user claim whenever a user's role is
 * created or changed in the 'users' collection.
 */
exports.onUserRoleChange = functions.firestore.document('users/{uid}').onWrite(async (change, context) => {
    var _a, _b;
    const { uid } = context.params;
    const newRole = change.after.exists ? (_a = change.after.data()) === null || _a === void 0 ? void 0 : _a.role : null;
    const oldRole = change.before.exists ? (_b = change.before.data()) === null || _b === void 0 ? void 0 : _b.role : null;
    if (newRole === oldRole) {
        console.log(`User ${uid}: Role unchanged (${newRole}). No action taken.`);
        return null;
    }
    try {
        console.log(`Setting custom claim for user ${uid}. New role: ${newRole}`);
        await admin.auth().setCustomUserClaims(uid, { role: newRole });
        return { result: `Custom claim for ${uid} updated to ${newRole}.` };
    }
    catch (error) {
        console.error(`Failed to set custom claim for ${uid}`, error);
        return { error: 'Failed to set custom claim.' };
    }
});
// --- Dashboard Functions ---
exports.getDashboardStats = functions.https.onRequest((request, response) => {
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
            const topRatedStaff = topStaffSnapshot.docs.map((doc) => (Object.assign({ id: doc.id }, doc.data())));
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
exports.updateUser = functions.https.onCall(async (data, context) => {
    var _a, _b;
    if (((_b = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.token) === null || _b === void 0 ? void 0 : _b.role) !== 'admin') {
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
exports.deleteUser = functions.https.onCall(async (data, context) => {
    var _a, _b;
    if (((_b = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.token) === null || _b === void 0 ? void 0 : _b.role) !== 'admin') {
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
exports.logAction = functions.https.onCall(async (data, context) => {
    var _a, _b, _c, _d, _e, _f, _g;
    try {
        const { action, details = {} } = data;
        if (!action) {
            throw new functions.https.HttpsError('invalid-argument', 'Action is required.');
        }
        // Get user information from context
        const userId = ((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid) || 'anonymous';
        const userEmail = ((_c = (_b = context.auth) === null || _b === void 0 ? void 0 : _b.token) === null || _c === void 0 ? void 0 : _c.email) || 'unknown';
        const userRole = ((_e = (_d = context.auth) === null || _d === void 0 ? void 0 : _d.token) === null || _e === void 0 ? void 0 : _e.role) || 'unknown';
        // Create log entry
        const logEntry = {
            action,
            details,
            userId,
            userEmail,
            userRole,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            ip: ((_f = context.rawRequest) === null || _f === void 0 ? void 0 : _f.ip) || 'unknown',
            userAgent: ((_g = context.rawRequest) === null || _g === void 0 ? void 0 : _g.get('user-agent')) || 'unknown'
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
exports.logActionHttp = functions.https.onRequest((request, response) => {
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
exports.updateJobPostingApplicantCount = functions.firestore
    .document('applications/{applicationId}')
    .onWrite(async (change, context) => {
    const applicationData = change.after.exists ? change.after.data() : null;
    const previousData = change.before.exists ? change.before.data() : null;
    // Get job posting ID from either new or old data
    const jobPostingId = (applicationData === null || applicationData === void 0 ? void 0 : applicationData.jobPostingId) || (previousData === null || previousData === void 0 ? void 0 : previousData.jobPostingId);
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
exports.updateEventParticipantCount = functions.firestore
    .document('participants/{participantId}')
    .onWrite(async (change, context) => {
    const participantData = change.after.exists ? change.after.data() : null;
    const previousData = change.before.exists ? change.before.data() : null;
    // Get event ID from either new or old data
    const eventId = (participantData === null || participantData === void 0 ? void 0 : participantData.eventId) || (previousData === null || previousData === void 0 ? void 0 : previousData.eventId);
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