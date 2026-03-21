import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { onCall } from "firebase-functions/v2/https";
import {
  NotFoundError,
  handleFunctionError,
  requireAuth,
  requireEnum,
  requireRole,
  requireString,
} from "../errors";

export const requestRegistration = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    try {
      const db = admin.firestore();
      const { email, password, name, nickname, role, phone, gender, consents } =
        request.data;

      logger.info("requestRegistration called", { email, role });

      requireString(email, "email");
      requireString(password, "password");
      requireString(name, "name");
      requireString(role, "role");

      const validRoles = ["employer", "staff"] as const;
      requireEnum(role, validRoles, "role");

      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: name,
        disabled: false,
        emailVerified: false,
      });

      const uid = userRecord.uid;

      await db.collection("users").doc(uid).set({
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

      await admin.auth().setCustomUserClaims(uid, { role });

      if (consents && uid) {
        try {
          const consentRef = db
            .collection("users")
            .doc(uid)
            .collection("consents")
            .doc("current");

          const consentData = {
            version: "1.0.0",
            userId: uid,
            termsOfService: {
              agreed: consents.termsOfService?.agreed ?? true,
              version: consents.termsOfService?.version ?? "1.0.0",
              agreedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            privacyPolicy: {
              agreed: consents.privacyPolicy?.agreed ?? true,
              version: consents.privacyPolicy?.version ?? "1.0.0",
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
          logger.info("Consent data saved", { userId: uid });
        } catch (consentError: unknown) {
          logger.error("Error saving consent data", consentError);
        }
      }

      return {
        success: true,
        message: `Registration for ${name} as ${role} is processing.`,
      };
    } catch (error: unknown) {
      throw handleFunctionError(error, {
        operation: "requestRegistration",
        context: { email: request.data?.email, role: request.data?.role },
      });
    }
  },
);

export const processRegistration = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    try {
      const db = admin.firestore();

      requireAuth(request);
      requireRole(request, "admin");

      const { targetUid, action } = request.data;

      requireString(targetUid, "targetUid");
      requireEnum(action, ["approve", "reject"], "action");

      const userRef = db.collection("users").doc(targetUid);
      const userDoc = await userRef.get();

      if (!userDoc.exists || userDoc.data()?.role !== "pending_manager") {
        throw new NotFoundError({
          message: "The specified user is not awaiting approval.",
          metadata: { resource: "User", resourceId: targetUid },
        });
      }

      if (action === "approve") {
        await admin.auth().updateUser(targetUid, { disabled: false });
        await admin.auth().setCustomUserClaims(targetUid, { role: "manager" });
        await userRef.update({ role: "manager" });
        return { success: true, message: "User approved as manager." };
      }

      await admin.auth().deleteUser(targetUid);
      await userRef.delete();

      return { success: true, message: "User registration rejected." };
    } catch (error: unknown) {
      throw handleFunctionError(error, {
        operation: "processRegistration",
        context: {
          userId: request.auth?.uid,
          targetUid: request.data?.targetUid,
        },
      });
    }
  },
);

export const createUserAccount = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    try {
      const db = admin.firestore();

      requireAuth(request);
      requireRole(request, "admin");

      const { email, name, role } = request.data;

      requireString(email, "email");
      requireString(name, "name");
      requireString(role, "role");

      const userRecord = await admin
        .auth()
        .createUser({ email, displayName: name });

      await admin.auth().setCustomUserClaims(userRecord.uid, { role });
      await db.collection("users").doc(userRecord.uid).set({
        name,
        email,
        role,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { result: `Successfully created ${role}: ${name} (${email})` };
    } catch (error: unknown) {
      throw handleFunctionError(error, {
        operation: "createUserAccount",
        context: {
          userId: request.auth?.uid,
          email: request.data?.email,
        },
      });
    }
  },
);

export const getDashboardStats = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    try {
      const db = admin.firestore();

      requireAuth(request);
      requireRole(request, "admin");

      const now = new Date();
      const ongoingEventsQuery = db.collection("events").where("endDate", ">=", now);
      const totalStaffQuery = db.collection("users").where("role", "==", "staff");
      const topStaffQuery = db
        .collection("users")
        .where("role", "==", "staff")
        .orderBy("rating", "desc")
        .limit(5);

      const [ongoingEventsSnapshot, totalStaffSnapshot, topStaffSnapshot] =
        await Promise.all([
          ongoingEventsQuery.get(),
          totalStaffQuery.get(),
          topStaffQuery.get(),
        ]);

      const topRatedStaff = topStaffSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return {
        ongoingEventsCount: ongoingEventsSnapshot.size,
        totalStaffCount: totalStaffSnapshot.size,
        topRatedStaff,
      };
    } catch (error: unknown) {
      logger.error("Error getting dashboard stats", error);
      throw handleFunctionError(error, {
        operation: "getDashboardStats",
        context: { userId: request.auth?.uid },
      });
    }
  },
);

export const updateUser = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    try {
      const db = admin.firestore();

      requireAuth(request);
      requireRole(request, "admin");

      const { uid, name, role } = request.data;

      requireString(uid, "uid");
      requireString(name, "name");
      requireString(role, "role");

      await db.collection("users").doc(uid).update({ name, role });

      return { success: true, message: `User ${uid} updated successfully.` };
    } catch (error: unknown) {
      throw handleFunctionError(error, {
        operation: "updateUser",
        context: {
          userId: request.auth?.uid,
          targetUid: request.data?.uid,
        },
      });
    }
  },
);

export const deleteUser = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    try {
      const db = admin.firestore();

      requireAuth(request);
      requireRole(request, "admin");

      const { uid } = request.data;

      requireString(uid, "uid");

      await admin.auth().deleteUser(uid);
      logger.info("Deleted user from Auth", { uid });

      await db.collection("users").doc(uid).delete();
      logger.info("Deleted user from Firestore", { uid });

      return { success: true, message: `User ${uid} deleted successfully.` };
    } catch (error: unknown) {
      throw handleFunctionError(error, {
        operation: "deleteUser",
        context: {
          userId: request.auth?.uid,
          targetUid: request.data?.uid,
        },
      });
    }
  },
);
