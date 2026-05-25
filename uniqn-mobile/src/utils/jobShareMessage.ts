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
  type PostingRoleDisplayModel,
} from '@/components/jobs/shared/postingSurfaceModel';
import type { JobPosting, PostingDetailViewModel } from '@/types';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';

type ScheduleModel = ReturnType<typeof buildPostingScheduleModel>;

function roleText(role: Pick<PostingRoleDisplayModel, 'label' | 'count'>): string {
  return `${role.label} ${role.count}명`;
}

/**
 * 날짜+시간 라인들 (variant 별). 빈 문자열만 제거하고 '미정'(시간 미정) 등
 * 상세 화면이 노출하는 라벨은 그대로 유지 — 공유 텍스트가 화면과 일치하도록.
 */
export function buildDateLines(schedule: ScheduleModel): string[] {
  if (schedule.variant === 'fixed') {
    const time = schedule.fixed.timeLabel?.trim();
    return [[schedule.fixed.daysLabel, time].filter(Boolean).join(' ').trim()].filter(Boolean);
  }

  if (schedule.variant === 'dated') {
    return schedule.sections
      .map((section) => {
        const times = Array.from(
          new Set(
            section.timeSlots
              .map((slot) => slot.timeLabel?.trim())
              .filter((t): t is string => Boolean(t))
          )
        );
        const timePart = times.length > 0 ? ` ${times.join(', ')}` : '';
        return `${section.label}${timePart}`.trim();
      })
      .filter(Boolean);
  }

  // legacy
  const line = [schedule.dateLabel, schedule.timeLabel]
    .filter((v) => Boolean(v?.trim()))
    .join(' ')
    .trim();
  return line ? [line] : [];
}

/** 역할+인원 집계 라인 (중복 라벨/카운트는 1회). */
export function buildRoleLine(schedule: ScheduleModel): { header: string; line: string } {
  const roles: PostingRoleDisplayModel[] = [];

  if (schedule.variant === 'fixed') {
    roles.push(...schedule.fixed.roles);
  } else if (schedule.variant === 'dated') {
    schedule.sections.forEach((section) =>
      section.timeSlots.forEach((slot) => roles.push(...slot.roles))
    );
  }

  // 동일 "라벨 N명" 은 한 번만 (다중 날짜 동일 역할 중복 제거)
  const seen = new Set<string>();
  const uniqueRoleTexts: string[] = [];
  const uniqueLabels: string[] = [];
  for (const role of roles) {
    const text = roleText(role);
    if (!seen.has(text)) {
      seen.add(text);
      uniqueRoleTexts.push(text);
    }
    if (!uniqueLabels.includes(role.label)) {
      uniqueLabels.push(role.label);
    }
  }

  return {
    header: uniqueLabels.join(' '),
    line: uniqueRoleTexts.join(', '),
  };
}

/** 급여 라인 (역할별 급여면 행 나열, 단일이면 대표 금액). */
function buildSalaryLine(detail: PostingDetailViewModel): string {
  const comp = buildPostingCompensationModel(detail, { display: 'detail' });
  if (!comp.useSameSalary && comp.rows.length > 0) {
    return comp.rows.map((row) => `${row.roleLabel} ${row.text}`).join(', ');
  }
  return comp.primaryText && !comp.isPartial ? comp.primaryText : '';
}

export interface JobShareParts {
  title: string;
  location: string;
  dateLines: string[];
  roleHeader: string;
  roleLine: string;
  salary: string;
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
  parts.dateLines.filter(Boolean).forEach((d) => body.push(`📅 ${d}`));
  if (parts.roleLine) {
    body.push(`🙋 ${parts.roleLine} 모집`);
  }
  if (parts.salary) {
    body.push(`💰 ${parts.salary}`);
  }

  const bodyBlock = body.length > 0 ? `\n\n${body.join('\n')}` : '';
  return `${headerLine}${bodyBlock}\n\n👉 지원하기\n${parts.url}`;
}

/**
 * 공고 공유 본문 생성 (이모지형). 공고 상세 화면과 동일 파생 모델 재사용.
 */
export function buildJobShareText(job: JobPosting, url: string): string {
  try {
    const facts = buildPostingFacts(job);
    const detail = projectPostingSurface(facts, {
      audience: 'public',
      surface: 'detail',
    }) as PostingDetailViewModel;

    const schedule = buildPostingScheduleModel(detail);
    const { header, line: roleLine } = buildRoleLine(schedule);

    return composeJobShareText({
      title: detail.title?.trim() || '공고',
      location: detail.locationLabel?.trim() || '',
      dateLines: buildDateLines(schedule),
      roleHeader: header,
      roleLine,
      salary: buildSalaryLine(detail),
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

export default buildJobShareText;
