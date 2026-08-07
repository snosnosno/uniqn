/**
 * ops 참가자 서비스 — 워크인 등록(검증) + 리바이/애드온 위임.
 */
import { logger } from '@/utils/logger';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { isAppError, ValidationError, ERROR_CODES } from '@/errors';
import { opsParticipantRepository, type RegisterParticipantInput } from '@/repositories/ops';
import {
  registerParticipantSchema,
  chipCountSchema,
  noShowSchema,
  participantUpdateSchema,
  type ChipCountInput,
  type NoShowInput,
  type ParticipantUpdateInput,
} from '@/schemas/opsParticipant.schema';
import { prizeCorrectionSchema, type PrizeCorrectionInput } from '@/schemas/opsPrize.schema';
import { UUID_LIKE_RE } from '@/schemas/common';

const COMPONENT = 'opsParticipantService';

export async function registerParticipant(
  input: RegisterParticipantInput,
  actorId: string
): Promise<{ participantId: string; entryNumber: number }> {
  try {
    logger.info('ops 참가자 등록', { component: COMPONENT, tournamentId: input.tournamentId });
    const parsed = registerParticipantSchema.safeParse(input);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: typeof first === 'string' ? first : '입력값을 확인해 주세요.',
      });
    }
    return await opsParticipantRepository.registerWithEvent(input, actorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '참가자 등록',
      component: COMPONENT,
      context: { tournamentId: input.tournamentId },
    });
  }
}

export async function addRebuy(participantId: string, actorId: string): Promise<void> {
  try {
    logger.info('ops 리바이', { component: COMPONENT, participantId });
    await opsParticipantRepository.addRebuy(participantId, actorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '리바이',
      component: COMPONENT,
      context: { participantId },
    });
  }
}

export async function addAddon(participantId: string, actorId: string): Promise<void> {
  try {
    logger.info('ops 애드온', { component: COMPONENT, participantId });
    await opsParticipantRepository.addAddon(participantId, actorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '애드온',
      component: COMPONENT,
      context: { participantId },
    });
  }
}

export async function bustParticipant(
  participantId: string,
  actorId: string,
  eliminatorId?: string | null
) {
  try {
    logger.info('ops 탈락 처리', { component: COMPONENT, participantId });
    // 🔨H2: eliminatorId 그룹형 uuid 경계 가드(무검증 시 비-uuid 가 22P02 → INFRA_NOT_FOUND 오도).
    // 빈 문자열도 명시 검사(truthy 체크는 '' 를 통과시켜 RPC 22P02 유발).
    if (eliminatorId !== null && eliminatorId !== undefined && !UUID_LIKE_RE.test(eliminatorId)) {
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: '넉아웃 상대 식별자가 올바르지 않아요.',
      });
    }
    return await opsParticipantRepository.bustParticipant(participantId, actorId, eliminatorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '탈락 처리',
      component: COMPONENT,
      context: { participantId },
    });
  }
}

export async function undoBust(participantId: string, actorId: string) {
  try {
    logger.info('ops 탈락 취소', { component: COMPONENT, participantId });
    return await opsParticipantRepository.undoBust(participantId, actorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '탈락 취소',
      component: COMPONENT,
      context: { participantId },
    });
  }
}

export async function correctPrize(input: PrizeCorrectionInput, actorId: string) {
  try {
    logger.info('ops 상금 정정', { component: COMPONENT, participantId: input.participantId });
    const parsed = prizeCorrectionSchema.safeParse(input);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: typeof first === 'string' ? first : '입력값을 확인해 주세요.',
      });
    }
    return await opsParticipantRepository.correctPrize(
      parsed.data.participantId,
      actorId,
      parsed.data.amount,
      parsed.data.reason ?? null
    );
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '상금 정정',
      component: COMPONENT,
      context: { participantId: input.participantId },
    });
  }
}

export async function reenterParticipant(participantId: string, actorId: string) {
  try {
    logger.info('ops 재진입', { component: COMPONENT, participantId });
    return await opsParticipantRepository.reenterParticipant(participantId, actorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '재진입',
      component: COMPONENT,
      context: { participantId },
    });
  }
}

/** 결함①: 칩 카운트 수동 입력(절대값). 값 경계는 서버와 동일(1~20억) — 왕복 전 클라에서 선차단. */
export async function setParticipantChips(input: ChipCountInput, actorId: string) {
  try {
    logger.info('ops 칩 카운트', { component: COMPONENT, participantId: input.participantId });
    const parsed = chipCountSchema.safeParse(input);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: typeof first === 'string' ? first : '입력값을 확인해 주세요.',
      });
    }
    return await opsParticipantRepository.setChips(
      parsed.data.participantId,
      actorId,
      parsed.data.chips
    );
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '칩 카운트',
      component: COMPONENT,
      context: { participantId: input.participantId },
    });
  }
}

/**
 * 결함②: 노쇼 표시/취소(undo-first — noShow=false 로 왕복, 서버 멱등).
 * 상태 게이트(checked_in ↔ no_show)는 **서버 단독 판정**이다 — 클라가 본 status 는
 * 실시간 목록의 스냅샷이라 누른 순간과 어긋날 수 있고, 여기서 중복 판정하면 두 계층이 갈라진다.
 */
export async function setParticipantNoShow(input: NoShowInput, actorId: string) {
  try {
    logger.info('ops 노쇼 설정', {
      component: COMPONENT,
      participantId: input.participantId,
      noShow: input.noShow,
    });
    const parsed = noShowSchema.safeParse(input);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: typeof first === 'string' ? first : '입력값을 확인해 주세요.',
      });
    }
    return await opsParticipantRepository.setNoShow(
      parsed.data.participantId,
      actorId,
      parsed.data.noShow
    );
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: input.noShow ? '노쇼 처리' : '노쇼 취소',
      component: COMPONENT,
      context: { participantId: input.participantId },
    });
  }
}

/**
 * 결함③: 참가자 등록 정보 정정. 빈 문자열 → null(지우기) 정규화는 스키마 transform 이 한다 —
 * 서버도 같은 규칙이라 두 계층이 갈라지지 않는다.
 */
export async function updateParticipant(input: ParticipantUpdateInput, actorId: string) {
  try {
    logger.info('ops 참가자 정정', { component: COMPONENT, participantId: input.participantId });
    const parsed = participantUpdateSchema.safeParse(input);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: typeof first === 'string' ? first : '입력값을 확인해 주세요.',
      });
    }
    return await opsParticipantRepository.updateParticipant(parsed.data.participantId, actorId, {
      name: parsed.data.name,
      nationality: parsed.data.nationality,
      phone: parsed.data.phone,
    });
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '참가자 정정',
      component: COMPONENT,
      context: { participantId: input.participantId },
    });
  }
}

/**
 * 결함③: 오등록 참가자 제거(**비가역**).
 * 게이트 판정은 **서버 단독**이다 — 클라가 본 status·이력은 실시간 목록의 스냅샷이라 누른 순간과
 * 어긋날 수 있다. 여기서 중복 판정하면 두 계층이 갈라지고, 갈라진 쪽이 넓으면 조용히 뚫린다.
 */
export async function deleteParticipant(participantId: string, actorId: string) {
  try {
    logger.info('ops 등록 취소(삭제)', { component: COMPONENT, participantId });
    if (!UUID_LIKE_RE.test(participantId)) {
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: '올바른 참가자 ID 가 아닙니다',
      });
    }
    return await opsParticipantRepository.deleteParticipant(participantId, actorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '등록 취소',
      component: COMPONENT,
      context: { participantId },
    });
  }
}

/**
 * 결함⑤: 플레이어 계정 연결(claim) 해제. 지금까지 DB 에만 있고 클라 참조가 0건이던 회로다.
 * 값 검증은 uuid 형태뿐 — 상태 판정은 서버(is_ops_member + 참가자 존재)가 단독으로 한다.
 */
export async function unclaimParticipant(participantId: string, actorId: string) {
  try {
    logger.info('ops 플레이어 연결 해제', { component: COMPONENT, participantId });
    if (!UUID_LIKE_RE.test(participantId)) {
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: '올바른 참가자 ID 가 아닙니다',
      });
    }
    return await opsParticipantRepository.unclaimParticipant(participantId, actorId);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '플레이어 연결 해제',
      component: COMPONENT,
      context: { participantId },
    });
  }
}

/** S1 C4: 상금 지급 마킹(undo-first — paid=false 로 왕복 취소, 서버 멱등). */
export async function setPrizePaid(participantId: string, actorId: string, paid: boolean) {
  try {
    logger.info('ops 상금 지급 마킹', { component: COMPONENT, participantId, paid });
    return await opsParticipantRepository.setPrizePaid(participantId, actorId, paid);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw handleServiceError(error, {
      operation: '상금 지급 마킹',
      component: COMPONENT,
      context: { participantId },
    });
  }
}
