/**
 * @file onJobPostingOGSync.ts
 * @description 공고 변경 시 Cloudflare KV에 OG 메타태그 데이터 동기화
 *
 * 트리거 조건:
 * - jobPostings 컬렉션 문서 생성/수정/삭제 감지 (onWrite)
 *
 * 처리 내용:
 * - 삭제 또는 비활성 → KV 삭제
 * - OG 관련 필드 변경 + active 상태 → KV에 포맷된 OG 데이터 저장
 * - viewCount, applicationCount 등 무관한 변경 → 무시
 */

import * as functions from 'firebase-functions/v1';
import * as logger from 'firebase-functions/logger';
import { kvPut, kvDelete } from '../utils/cloudflareKV';
import { STATUS } from '../constants/status';

// --- OG 관련 필드 (이 필드만 변경 시 KV 업데이트) ---

const OG_RELEVANT_FIELDS = [
  'title', 'status', 'location', 'workDate', 'timeSlot',
  'roles', 'defaultSalary', 'postingType', 'dateSpecificRequirements',
  'fixedConfig', 'tournamentConfig', 'urgentConfig',
] as const;

// --- 상수 ---

const SALARY_TYPE_LABELS: Record<string, string> = {
  hourly: '시급',
  daily: '일급',
  monthly: '월급',
  other: '협의',
};

const ROLE_LABELS: Record<string, string> = {
  dealer: '딜러',
  floor: '플로어',
  serving: '서빙',
  manager: '매니저',
  chiprunner: '칩러너',
  supervisor: '슈퍼바이저',
  staff: '스태프',
  other: '기타',
};

const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];

const WEB_DOMAIN = 'https://uniqn.app';
const OG_DEFAULT_IMAGE = `${WEB_DOMAIN}/og-default.png`;

// --- 포맷 유틸 ---

function formatShortDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + 'T00:00:00+09:00');
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = WEEKDAYS_KO[date.getDay()];
    return `${month}/${day}(${weekday})`;
  } catch {
    return dateStr;
  }
}

function formatOGSalary(salary?: { type: string; amount: number }): string {
  if (!salary || !salary.amount) return '급여 협의';
  const typeLabel = SALARY_TYPE_LABELS[salary.type] || salary.type;
  return `${typeLabel} ${salary.amount.toLocaleString('ko-KR')}원`;
}

function formatOGSchedule(data: Record<string, any>): string {
  // v2: dateSpecificRequirements 우선
  if (data.dateSpecificRequirements?.length > 0) {
    const first = data.dateSpecificRequirements[0];
    const dateStr = formatShortDate(first.date);
    const timeStr = first.startTime && first.endTime
      ? `${first.startTime}~${first.endTime}`
      : '';

    if (data.dateSpecificRequirements.length > 1) {
      const extra = data.dateSpecificRequirements.length - 1;
      return timeStr ? `${dateStr} ${timeStr} 외 ${extra}일` : `${dateStr} 외 ${extra}일`;
    }
    return timeStr ? `${dateStr} ${timeStr}` : dateStr;
  }

  // v1 fallback: workDate + timeSlot
  if (data.workDate && data.timeSlot) {
    const timeSlot = data.timeSlot.replace(' - ', '~').replace(' ~ ', '~');
    return `${formatShortDate(data.workDate)} ${timeSlot}`;
  }

  if (data.workDate) {
    return formatShortDate(data.workDate);
  }

  return '';
}

function formatOGRoles(roles?: Array<{ role: string; count: number }>): string {
  if (!roles?.length) return '';
  return roles
    .map(r => `${ROLE_LABELS[r.role] || r.role} ${r.count}명`)
    .join(', ');
}

// --- OG description 조합 (공고 타입별) ---

function buildOGDescription(data: Record<string, any>): string {
  const postingType = data.postingType || 'regular';
  const parts: string[] = [];

  if (postingType === 'tournament') {
    parts.push('대회');
  } else {
    const salary = formatOGSalary(data.defaultSalary);
    parts.push(salary);
  }

  if (postingType === 'fixed') {
    // 기간제: 주당 일수 표시
    const daysPerWeek = data.daysPerWeek || data.fixedConfig?.daysPerWeek;
    if (daysPerWeek) {
      parts.push(`주 ${daysPerWeek}일`);
    }
  } else {
    // 일반/대회/긴급: 날짜+시간
    const schedule = formatOGSchedule(data);
    if (schedule) parts.push(schedule);
  }

  const roles = formatOGRoles(data.roles);
  if (roles) parts.push(roles);

  return parts.join(' · ');
}

// --- OG title ---

function buildOGTitle(data: Record<string, any>): string {
  const locationName = data.location?.name || data.location?.region || '';
  const title = data.title || '';

  if (locationName) {
    return `[${locationName}] ${title}`;
  }
  return title || 'UNIQN 공고';
}

// --- 변경 감지 ---

/**
 * 키 순서에 영향받지 않는 deep comparison (JSON.stringify 순서 문제 방지)
 */
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const sorted = Object.keys(value as Record<string, unknown>).sort();
  return `{${sorted.map(k => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(',')}}`;
}

function hasOGRelevantChange(
  before: Record<string, any>,
  after: Record<string, any>
): boolean {
  return OG_RELEVANT_FIELDS.some(
    field => stableStringify(before[field]) !== stableStringify(after[field])
  );
}

// --- 메인 트리거 ---

export const onJobPostingOGSync = functions
  .region('asia-northeast3')
  .firestore.document('jobPostings/{jobId}')
  .onWrite(async (change, context) => {
    const jobId = context.params.jobId;
    const after = change.after.exists ? change.after.data()! : null;
    const before = change.before.exists ? change.before.data()! : null;

    // 조기 반환: 수정인데 OG 관련 필드가 안 바뀐 경우 (가장 빈번한 케이스)
    // viewCount, applicationCount 등 무관한 업데이트에서 KV 호출 없이 즉시 반환
    if (before && after && !hasOGRelevantChange(before, after)) {
      return;
    }

    try {
      const kvKey = `og:jobs:${jobId}`;

      // 1. 삭제됨
      if (!after) {
        logger.info('공고 삭제 → KV 삭제', { jobId });
        await kvDelete(kvKey);
        return;
      }

      // 2. 비활성 상태 → KV 삭제
      if (after.status !== STATUS.JOB_POSTING.ACTIVE) {
        if (before?.status === STATUS.JOB_POSTING.ACTIVE) {
          logger.info('공고 비활성화 → KV 삭제', { jobId, status: after.status });
          await kvDelete(kvKey);
        }
        return;
      }

      // 3. active 상태 + OG 관련 필드 변경 → KV에 OG 데이터 저장
      const ogData = {
        title: buildOGTitle(after),
        description: buildOGDescription(after),
        url: `${WEB_DOMAIN}/jobs/${jobId}`,
        image: OG_DEFAULT_IMAGE,
      };

      logger.info('공고 OG 데이터 KV 저장', { jobId, ogData });
      await kvPut(kvKey, ogData);

    } catch (error) {
      // KV 동기화 실패는 critical하지 않으므로 에러를 던지지 않음
      logger.error('OG KV 동기화 실패', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  });
