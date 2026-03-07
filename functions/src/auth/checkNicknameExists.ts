/**
 * 닉네임 중복 확인 Cloud Function
 *
 * @description
 * 회원가입 프로필 단계 및 프로필 수정 시 닉네임 중복을 실시간 확인합니다.
 * 인증 없이 호출 가능 (회원가입 전이므로).
 * IP Rate Limiting + reCAPTCHA v3 (웹) 적용.
 *
 * excludeUid: 프로필 수정 시 자기 자신의 닉네임을 제외하기 위한 선택 파라미터
 *
 * @version 1.2.0
 */

import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import { ValidationError, ERROR_CODES } from "../errors/AppError";
import { hasXSSPattern } from "../utils/security";
import { withCallableGuard } from "../middleware/callableGuard";

/**
 * 닉네임 중복 확인
 *
 * - Firestore users 컬렉션에서 nickname 필드 조회
 * - 인증 불필요 (회원가입 전 호출)
 * - IP 기반 Rate Limiting + reCAPTCHA v3 (웹) 적용
 */
export const checkNicknameExists = onCall(
  { region: "asia-northeast3", cors: true },
  (request) =>
    withCallableGuard(
      request,
      {
        operation: "checkNicknameExists",
        rateLimit: {
          maxRequests: 10,
          keyPrefix: "ratelimit:check-nickname",
        },
        errorContext: (req) => ({
          nickname:
            typeof req.data?.nickname === "string"
              ? req.data.nickname
              : undefined,
        }),
      },
      async (req) => {
        // 1. 닉네임 파라미터 검증
        const rawNickname = req.data?.nickname;
        if (
          !rawNickname ||
          typeof rawNickname !== "string" ||
          rawNickname.trim().length === 0
        ) {
          throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
            userMessage: "닉네임을 입력해주세요.",
            field: "nickname",
          });
        }

        const nickname = rawNickname.trim();

        // 길이 검증
        if (nickname.length < 2) {
          throw new ValidationError(ERROR_CODES.VALIDATION_MIN_LENGTH, {
            userMessage: "닉네임은 최소 2자 이상이어야 합니다.",
            field: "nickname",
          });
        }

        if (nickname.length > 15) {
          throw new ValidationError(ERROR_CODES.VALIDATION_MAX_LENGTH, {
            userMessage: "닉네임은 15자를 초과할 수 없습니다.",
            field: "nickname",
          });
        }

        // XSS 검증
        if (hasXSSPattern(nickname)) {
          throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
            userMessage: "사용할 수 없는 문자열이 포함되어 있습니다.",
            field: "nickname",
          });
        }

        // 2. excludeUid 파라미터 (프로필 수정 시 자기 자신 제외)
        const excludeUid =
          typeof req.data?.excludeUid === "string" && req.data.excludeUid.length > 0
            ? req.data.excludeUid
            : undefined;

        // 3. Firestore에서 닉네임 중복 확인
        const snapshot = await admin
          .firestore()
          .collection("users")
          .where("nickname", "==", nickname)
          .limit(excludeUid ? 2 : 1)
          .get();

        let exists: boolean;
        if (excludeUid && !snapshot.empty) {
          exists = snapshot.docs.some((doc) => doc.id !== excludeUid);
        } else {
          exists = !snapshot.empty;
        }

        logger.info("닉네임 중복 확인 완료", {
          nickname,
          exists,
          excludeUid: excludeUid ?? null,
        });

        return { exists };
      },
    ),
);
