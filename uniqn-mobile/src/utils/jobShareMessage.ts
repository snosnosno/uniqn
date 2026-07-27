/**
 * 공고 외부 공유 텍스트 빌더
 *
 * @description 카톡·SNS 공유 본문에 근무 일정·역할·인원·급여를 함께 표시한다.
 *   공고 상세 화면과 동일한 파생 모델(buildPostingFacts → projectPostingSurface →
 *   buildPostingScheduleModel / buildPostingCompensationModel)을 재사용해 화면과
 *   문자열이 일치하도록 한다. OG 미리보기에 의존하지 않는 자급식 공유 메시지.
 */

import { buildPostingFacts } from '@/domains/job-posting/facts';
import { projectPostingSurface } from '@/domains/job-posting/projections';
import {
  buildPostingCompensationModel,
  buildPostingScheduleModel,
  type PostingCompensationModel,
  type PostingRoleDisplayModel,
} from '@/components/jobs/shared/postingSurfaceModel';
import type { JobPosting, PostingDetailViewModel } from '@/types';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';

type ScheduleModel = ReturnType<typeof buildPostingScheduleModel>;

export interface JobShareScheduleBlock {
  /** 📅 뒤에 올 날짜(+시간) 라벨 */
  dateLabel: string;
  /** 🙋 뒤에 올 해당 날짜/시간대의 역할 현황. 비면 라인 생략. */
  roleLine: string;
}

/**
 * 역할 배열을 라벨별 확정/총원으로 누적 집계. "라벨 확정/총원명" 형식.
 * 라벨 등장 순서를 유지한다.
 */
export function aggregateRoles(roles: PostingRoleDisplayModel[]): { header: string; line: string } {
  const order: string[] = [];
  const totals = new Map<string, { filled: number; count: number }>();
  for (const role of roles) {
    const acc = totals.get(role.label);
    if (acc) {
      acc.filled += role.filled;
      acc.count += role.count;
    } else {
      totals.set(role.label, { filled: role.filled, count: role.count });
      order.push(role.label);
    }
  }

  return {
    header: order.join(' '),
    line: order
      .map((label) => {
        const { filled, count } = totals.get(label)!;
        return `${label} ${filled}/${count}명`;
      })
      .join(', '),
  };
}

/**
 * 날짜/시간대별 근무 블록. 각 블록은 "날짜+시간 라벨"과 "그 시간대의 역할 현황"을 짝지어,
 * 공유 메시지가 공고 상세 카드(PostingScheduleContent)처럼 날짜별로 역할을 분해해 보여주도록 한다.
 * header 는 전체 역할 종류(헤더 '모집' 표기용) — 모든 블록 역할 라벨의 집합.
 */
export function buildScheduleBlocks(schedule: ScheduleModel): {
  blocks: JobShareScheduleBlock[];
  header: string;
} {
  if (schedule.variant === 'fixed') {
    const { header, line } = aggregateRoles(schedule.fixed.roles);
    const time = schedule.fixed.timeLabel?.trim();
    const dateLabel = [schedule.fixed.daysLabel, time].filter(Boolean).join(' ').trim();
    return { blocks: [{ dateLabel, roleLine: line }], header };
  }

  if (schedule.variant === 'dated') {
    const blocks: JobShareScheduleBlock[] = [];
    const allRoles: PostingRoleDisplayModel[] = [];
    schedule.sections.forEach((section) =>
      section.timeSlots.forEach((slot) => {
        allRoles.push(...slot.roles);
        const time = slot.timeLabel?.trim();
        const dateLabel = [section.label, time].filter(Boolean).join(' ').trim();
        blocks.push({ dateLabel, roleLine: aggregateRoles(slot.roles).line });
      })
    );
    return { blocks, header: aggregateRoles(allRoles).header };
  }

  // legacy
  const dateLabel = [schedule.dateLabel, schedule.timeLabel]
    .filter((v) => Boolean(v?.trim()))
    .join(' ')
    .trim();
  return { blocks: dateLabel ? [{ dateLabel, roleLine: '' }] : [], header: '' };
}

/**
 * 급여 라인 (역할별 급여면 행 나열, 단일이면 대표 금액).
 * 묶음 공유(bulkJobShareMessage)도 같은 규칙을 써야 단일/묶음 급여 표기가 갈라지지 않는다.
 */
export function buildSalaryLine(comp: PostingCompensationModel): string {
  if (!comp.useSameSalary && comp.rows.length > 0) {
    return comp.rows.map((row) => `${row.roleLabel} ${row.text}`).join(', ');
  }
  return comp.primaryText && !comp.isPartial ? comp.primaryText : '';
}

export interface JobShareParts {
  title: string;
  location: string;
  /** 날짜/시간대별 근무 블록 (날짜 라벨 + 그 시간대 역할). 날짜별로 분해 표시. */
  scheduleBlocks: JobShareScheduleBlock[];
  /** 전체 역할 종류 (헤더 '모집' 표기용) */
  roleHeader: string;
  salary: string;
  /** 복리후생 라벨 (예: ['보장 8시간', '식사제공', '교통비 10,000원']). 비면 라인 생략. */
  allowanceLabels?: string[];
  /** 세금 라벨 (예: '세금 3.3%'). 비면 라인 생략. */
  taxLabel?: string;
  url: string;
}

/**
 * 파생된 조각들로 이모지형 공유 본문을 조립하는 순수 함수.
 * url 은 본문 마지막 1회만 포함 → 메시지/별도 url 중복 공유 방지.
 */
export function composeJobShareText(parts: JobShareParts): string {
  const title = parts.title.trim() || '공고';
  const headerLine = parts.roleHeader
    ? `[UNIQN] ${title} ${parts.roleHeader} 모집`
    : `[UNIQN] ${title}`;

  const body: string[] = [];
  // 제목과 근무지가 같으면 위치 라인 생략 (중복 방지)
  const location = parts.location.trim();
  if (location && location !== title) {
    body.push(`📍 ${location}`);
  }
  // 날짜/시간대별로 "📅 날짜 → 🙋 그 시간대 역할" 을 짝지어 노출 (공고 상세 카드와 동일한 날짜별 분해).
  parts.scheduleBlocks.forEach((block) => {
    const date = block.dateLabel.trim();
    if (date) {
      body.push(`📅 ${date}`);
    }
    const role = block.roleLine.trim();
    if (role) {
      // 실시간 현황(확정/총원)을 그대로 노출 — '모집' 표기는 헤더에만 둔다.
      body.push(`🙋 ${role}`);
    }
  });
  if (parts.salary) {
    body.push(`💰 ${parts.salary}`);
  }
  const allowances = (parts.allowanceLabels ?? []).filter(Boolean);
  if (allowances.length > 0) {
    body.push(`🎁 ${allowances.join(' · ')}`);
  }
  const taxLabel = parts.taxLabel?.trim();
  if (taxLabel) {
    body.push(`🧾 ${taxLabel}`);
  }

  const bodyBlock = body.length > 0 ? `\n\n${body.join('\n')}` : '';
  return `${headerLine}${bodyBlock}\n\n👉 지원하기\n${parts.url}`;
}

/**
 * 공고 공유 본문 생성 (이모지형). 공고 상세 화면과 동일 파생 모델 재사용.
 *
 * @param filledCounts (선택) `date__slot__role` 키의 실시간 확정 인원 맵.
 *   주입 시 🙋 라인이 "확정/총원" 으로 표시된다. 미주입 시 0/N 으로 fallback.
 */
export function buildJobShareText(
  job: JobPosting,
  url: string,
  filledCounts?: Map<string, number>
): string {
  try {
    const facts = buildPostingFacts(job);
    const detail = projectPostingSurface(facts, {
      audience: 'public',
      surface: 'detail',
    }) as PostingDetailViewModel;

    const schedule = buildPostingScheduleModel(detail, filledCounts);
    const { blocks, header } = buildScheduleBlocks(schedule);
    const comp = buildPostingCompensationModel(detail, { display: 'detail' });

    return composeJobShareText({
      title: detail.title?.trim() || '공고',
      location: detail.locationLabel?.trim() || '',
      scheduleBlocks: blocks,
      roleHeader: header,
      salary: buildSalaryLine(comp),
      allowanceLabels: comp.allowanceLabels,
      taxLabel: comp.taxLabel,
      url,
    });
  } catch (error) {
    // 파생 실패 시에도 공유는 동작해야 한다 — 최소 본문으로 fallback
    logger.warn('공유 본문 생성 실패 — 최소 본문 fallback', { jobId: job?.id });
    void toError(error);
    const title = job?.title?.trim() || '공고';
    return `[UNIQN] ${title}\n\n👉 지원하기\n${url}`;
  }
}
