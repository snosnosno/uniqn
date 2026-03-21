import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { onDocumentWritten } from "firebase-functions/v2/firestore";

export const onUserRoleChange = onDocumentWritten(
  { document: "users/{uid}", region: "asia-northeast3" },
  async (event) => {
    const { uid } = event.params;
    const newRole = event.data?.after.exists
      ? event.data.after.data()?.role
      : null;
    const oldRole = event.data?.before.exists
      ? event.data.before.data()?.role
      : null;

    if (newRole === oldRole) {
      logger.info(`User ${uid}: role unchanged`, { role: newRole });
      return null;
    }

    try {
      logger.info(`Setting custom claim for user ${uid}`, { newRole });
      await admin.auth().setCustomUserClaims(uid, { role: newRole });
      return { result: `Custom claim for ${uid} updated to ${newRole}.` };
    } catch (error) {
      logger.error(`Failed to set custom claim for ${uid}`, error);
      return { error: "Failed to set custom claim." };
    }
  },
);
