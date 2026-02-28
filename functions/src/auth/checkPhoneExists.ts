/**
 * 전화번호 중복 확인 Cloud Function
 *
 * @description
 * 회원가입 Step 2에서 SMS 인증 발송 전 전화번호 중복을 확인합니다.
 * 인증 없이 호출 가능 (회원가입 전이므로).
 * Firebase Auth + Firestore 양쪽 모두 확인하여 정합성을 보장합니다.
 * Auth에 phone-only 고아 계정이 있으면 즉시 삭제하여 재가입을 허용합니다.
 *
 * @version 1.3.0
 *
 * // TODO [P1]: Firebase App Check 적용 (네이티브 봇 보호)
 */

import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import { ValidationError, ERROR_CODES } from "../errors/AppError";
import { isValidKoreanPhone, toE164, maskPhone } from "../utils/phone";
import { withCallableGuard } from "../middleware/callableGuard";

/**
 * 전화번호 중복 확인
 *
 * - Firebase Auth에서 해당 전화번호로 등록된 계정 존재 여부 확인
 * - Firestore users 컬렉션에서 phone 필드 조회
 * - 인증 불필요 (회원가입 전 호출)
 * - IP 기반 Rate Limiting + reCAPTCHA v3 (웹) 적용
 */
export const checkPhoneExists = onCall(
  { region: "asia-northeast3", cors: true },
  (request) =>
    withCallableGuard(
      request,
      {
        operation: "checkPhoneExists",
        rateLimit: {
          maxRequests: 5,
          keyPrefix: "ratelimit:check-phone",
          authenticatedMaxRequests: 20,
        },
        errorContext: (req) => ({
          phone:
            typeof req.data?.phone === "string"
              ? maskPhone(req.data.phone)
              : undefined,
        }),
      },
      async (req) => {
        // 1. 전화번호 파라미터 검증
        const rawPhone = req.data?.phone;
        if (
          !rawPhone ||
          typeof rawPhone !== "string" ||
          rawPhone.trim().length === 0
        ) {
          throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
            userMessage: "전화번호를 입력해주세요.",
            field: "phone",
          });
        }

        // 2. 전화번호 정규화 + 형식 검증
        const cleaned = rawPhone.replace(/[-\s]/g, "");

        if (!isValidKoreanPhone(cleaned)) {
          throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
            userMessage: "올바른 전화번호 형식이 아닙니다.",
            field: "phone",
          });
        }

        const e164Phone = toE164(cleaned);

        // 3. Firebase Auth에서 확인 + 고아 계정 즉시 정리
        let existsInAuth = false;
        try {
          const authUser =
            await admin.auth().getUserByPhoneNumber(e164Phone);

          // 고아 계정 감지: Auth에 존재하지만 Firestore users 문서가 없는 phone-only 계정
          // (가입 중단/크래시로 생성된 계정 → 즉시 삭제하여 재가입 허용)
          if (!authUser.email) {
            const userDoc = await admin
              .firestore()
              .collection("users")
              .doc(authUser.uid)
              .get();
            if (!userDoc.exists) {
              logger.info("고아 phone-only 계정 감지 → 즉시 삭제", {
                uid: authUser.uid,
                phone: maskPhone(e164Phone),
              });
              try {
                await admin.auth().deleteUser(authUser.uid);
                // orphanAccounts 마킹 문서도 함께 정리
                try {
                  await admin
                    .firestore()
                    .collection("orphanAccounts")
                    .doc(authUser.uid)
                    .delete();
                } catch {
                  // orphanAccounts 문서 미존재 시 무시
                }
                existsInAuth = false;
              } catch (deleteErr) {
                // [S3] 고아 계정 삭제 실패 시 전체 함수가 실패하지 않도록 안전 처리
                logger.warn("고아 계정 삭제 실패 - 존재하는 것으로 처리", {
                  uid: authUser.uid,
                  error: deleteErr,
                });
                existsInAuth = true;
              }
            } else {
              existsInAuth = true;
            }
          } else {
            existsInAuth = true;
          }
        } catch (authError: unknown) {
          if (
            authError &&
            typeof authError === "object" &&
            "code" in authError &&
            (authError as { code: string }).code === "auth/user-not-found"
          ) {
            existsInAuth = false;
          } else {
            throw authError;
          }
        }

        // 4. Firestore에서도 확인 (Auth에 없지만 Firestore에만 있는 경우 대비)
        let existsInFirestore = false;
        if (!existsInAuth) {
          const snapshot = await admin
            .firestore()
            .collection("users")
            .where("phone", "==", e164Phone)
            .limit(1)
            .get();

          existsInFirestore = !snapshot.empty;
        }

        const exists = existsInAuth || existsInFirestore;

        logger.info("전화번호 중복 확인 완료", {
          phone: maskPhone(e164Phone),
          exists,
          source: existsInAuth
            ? "auth"
            : existsInFirestore
              ? "firestore"
              : "none",
        });

        return { exists };
      },
    ),
);
