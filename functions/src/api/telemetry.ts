import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { onCall, onRequest } from "firebase-functions/v2/https";
import { requireString } from "../errors";

export const logAction = onCall(
  { region: "asia-northeast3" },
  async (request) => {
    try {
      const db = admin.firestore();
      const { action, details = {} } = request.data;

      requireString(action, "action");

      const userId = request.auth?.uid || "anonymous";
      const userEmail = request.auth?.token?.email || "unknown";
      const userRole = request.auth?.token?.role || "unknown";

      await db.collection("actionLogs").add({
        action,
        details,
        userId,
        userEmail,
        userRole,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ip: request.rawRequest?.ip || "unknown",
        userAgent: request.rawRequest?.get("user-agent") || "unknown",
      });

      logger.info(`Action logged: ${action}`, {
        userId,
        userEmail,
        userRole,
        details,
      });

      return { success: true, message: "Action logged successfully" };
    } catch (error: unknown) {
      logger.error("Error logging action", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
);

export const logActionHttp = onRequest(
  { region: "asia-northeast3", cors: true },
  async (request, response) => {
    try {
      const db = admin.firestore();

      if (request.method !== "POST") {
        response.status(405).send({ error: "Method not allowed" });
        return;
      }

      const { action, details = {} } = request.body as {
        action?: string;
        details?: Record<string, unknown>;
      };

      if (!action) {
        response.status(400).send({ error: "Action is required" });
        return;
      }

      await db.collection("actionLogs").add({
        action,
        details,
        userId: "http_request",
        userEmail: "unknown",
        userRole: "unknown",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ip: request.ip || "unknown",
        userAgent: request.get("user-agent") || "unknown",
      });

      logger.info(`HTTP Action logged: ${action}`, { details });

      response
        .status(200)
        .send({ success: true, message: "Action logged successfully" });
    } catch (error: unknown) {
      logger.error("Error logging HTTP action", error);
      response.status(200).send({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
);
