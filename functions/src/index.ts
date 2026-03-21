import * as admin from "firebase-admin";
import { initSentry } from "./utils/sentry";

if (!admin.apps.length) {
  admin.initializeApp();
}

initSentry();

export * from "./api";
export * from "./scheduled";
export * from "./triggers";
