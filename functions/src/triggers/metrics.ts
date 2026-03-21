import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { handleTriggerError } from "../errors";

export const updateEventParticipantCount = onDocumentWritten(
  { document: "participants/{participantId}", region: "asia-northeast3" },
  async (event) => {
    const db = admin.firestore();
    const participantData = event.data?.after.exists
      ? event.data.after.data()
      : null;
    const previousData = event.data?.before.exists
      ? event.data.before.data()
      : null;
    const eventId = participantData?.eventId || previousData?.eventId;

    if (!eventId) {
      logger.warn("No eventId found in participant document");
      return;
    }

    try {
      const participantsSnapshot = await db
        .collection("participants")
        .where("eventId", "==", eventId)
        .get();

      await db.collection("events").doc(eventId).update({
        participantCount: participantsSnapshot.size,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info(
        `Updated participantCount for event ${eventId}: ${participantsSnapshot.size}`,
      );
    } catch (error) {
      logger.error("Error updating participant count", error);
      throw handleTriggerError(error, {
        operation: "updateEventParticipantCount",
        context: { eventId },
      });
    }
  },
);
