/**
 * 공고 묶음(다건) 외부 공유 텍스트 빌더
 *
 * @description 여러 공고를 한 번에 카톡·SNS 로 보낼 때 쓰는 압축 본문을 만든다.
 *   단일 공유(jobShareMessage.buildJobShareText)는 날짜별로 역할을 전부 분해하지만,
 *   그 형식을 N배 하면 10건에서 메시지가 수백 줄이 되어 읽히지 않는다. 여기서는 공고당
 *   4~5줄(제목·일정·인원·급여·링크)로 압축하고, 다일 공고는 "첫날 외 N일" 로 접는다.
 *
 *   파생 모델(buildPostingFacts → projectPostingSurface → buildPostingScheduleModel)은
 *   단일 공유와 동일하게 재사용해 화면·단일공유·묶음공유 세 표면의 숫자가 어긋나지 않게 한다.
 */

import { buildPostingFacts } from '@/domains/job-posting/facts';
import { projectPostingSurface } from '@/domains/job-posting/projections';
import {
  buildPostingCompensationModel,
  buildPostingScheduleModel,
  type PostingRoleDisplayModel,
  type PostingScheduleModel,
} from '@/components/jobs/shared/postingSurfaceModel';
import type { JobPosting, PostingDetailViewModel } from '@/types';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { aggregateRoles, buildSalaryLine } from '@/utils/jobShareMessage';

// ============================================================================
// Constants
// ============================================================================

/** 한 번에 묶어 공유할 수 있는 공고 수 상한. UI 선택 단계에서도 동일 상수를 쓴다. */
export const MAX_BULK_SHARE_COUNT = 10;

/**
 * 공유 본문 총 길이 상한(자). 초과분은 잘라내고 "외 N건" 으로 안내한다.
 * 카톡 텍스트 전송은 상한이 넉넉하지만, 그 이상은 사람이 읽지 않는다.
 */
const MAX_SHARE_TEXT_LENGTH = 4000;

/** 일정 라인에 그대로 나열할 최대 날짜 수. 초과하면 "첫날 외 N일" 로 접는다. */
const MAX_INLINE_DATE_LABELS = 2;

// ============================================================================
// Types
// ============================================================================

export interface BulkShareItem {
  /** 공고 제목 */
  title: string;
  /** 근무지 라벨. 제목과 같으면 빈 문자열(중복 노출 방지). */
  location: string;
  /** 📅 뒤에 올 압축 일정 라벨 (예: '7/29(화) 18:00' · '7/29(화) 외 4일') */
  scheduleLabel: string;
  /** 🙋 뒤에 올 전체 역할 합산 (예: '딜러 2/6명, 플로어 0/2명') */
  roleLine: string;
  /** 💰 뒤에 올 급여 라벨 */
  salary: string;
  /** 공고 링크 */
  url: string;
}

// ============================================================================
// 일정 압축
// ============================================================================

/**
 * 스케줄 모델 → 한 줄 일정 라벨 + 전체 역할 합산.
 *
 * 단일 공유가 쓰는 buildScheduleBlocks 는 날짜×시간대마다 한 블록을 만든다(상세형).
 * 묶음 공유는 그 블록을 그대로 쓸 수 없어(다일 공고 1건이 10줄) 여기서 따로 접는다.
 * "외 N일" 의 N 은 블록 수가 아니라 **날짜 수** 여야 하므로 sections 를 직접 센다.
 */
export function summarizeSchedule(schedule: PostingScheduleModel): {
  scheduleLabel: string;
  roleLine: string;
} {
  if (schedule.variant === 'fixed') {
    const label = [schedule.fixed.daysLabel, schedule.fixed.timeLabel]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(' ');
    return { scheduleLabel: label, roleLine: aggregateRoles(schedule.fixed.roles).line };
  }

  if (schedule.variant === 'dated') {
    const allRoles: PostingRoleDisplayModel[] = [];
    const dateLabels: string[] = [];

    schedule.sections.forEach((section) => {
      section.timeSlots.forEach((slot) => allRoles.push(...slot.roles));

      // 시간대가 하나뿐인 날짜만 시간을 함께 노출한다. 여러 시간대를 한 줄에 붙이면
      // 압축 효과가 사라지므로 '시간대 N개' 로 대체한다.
      const times = section.timeSlots
        .map((slot) => slot.timeLabel?.trim())
        .filter((label): label is string => Boolean(label));
      const suffix =
        times.length === 1 ? times[0] : times.length > 1 ? `시간대 ${times.length}개` : '';
      dateLabels.push([section.label, suffix].filter(Boolean).join(' ').trim());
    });

    const roleLine = aggregateRoles(allRoles).line;

    if (dateLabels.length === 0) {
      return { scheduleLabel: '', roleLine };
    }
    if (dateLabels.length <= MAX_INLINE_DATE_LABELS) {
      return { scheduleLabel: dateLabels.join(', '), roleLine };
    }
    return {
      scheduleLabel: `${dateLabels[0]} 외 ${dateLabels.length - 1}일`,
      roleLine,
    };
  }

  const label = [schedule.dateLabel, schedule.timeLabel]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  return { scheduleLabel: label, roleLine: '' };
}

// ============================================================================
// 항목 조립
// ============================================================================

/**
 * 근무지 라인이 제목과 사실상 같은지. 어느 한쪽이 다른 쪽으로 시작하면 중복으로 본다.
 * (제목 '강남 홀덤펍' + 근무지 '강남 홀덤펍 역삼동 123-4' → 중복)
 */
export function isRedundantLocation(location: string, title: string): boolean {
  const loc = location.trim();
  const t = title.trim();
  if (!loc || !t) return false;
  return loc.startsWith(t) || t.startsWith(loc);
}

/**
 * 공고 1건 → 묶음 공유 항목. 파생 실패 시에도 공유가 끊기면 안 되므로
 * 제목·링크만 담은 최소 항목으로 degrade 한다(단일 공유와 동일 정책).
 */
export function buildBulkShareItem(
  job: JobPosting,
  url: string,
  filledCounts?: Map<string, number>
): BulkShareItem {
  const fallbackTitle = job?.title?.trim() || '공고';

  try {
    const facts = buildPostingFacts(job);
    const detail = projectPostingSurface(facts, {
      audience: 'public',
      surface: 'detail',
    }) as PostingDetailViewModel;

    const schedule = buildPostingScheduleModel(detail, filledCounts);
    const { scheduleLabel, roleLine } = summarizeSchedule(schedule);
    const comp = buildPostingCompensationModel(detail, { display: 'card' });

    const title = detail.title?.trim() || fallbackTitle;
    const location = detail.locationLabel?.trim() ?? '';

    return {
      title,
      // 제목과 근무지가 겹치면 라인을 접는다. 단일 공유는 완전 일치만 걸러내지만
      // locationLabel 은 상세주소를 덧붙이므로("강남 홀덤펍 역삼동 123-4") 제목이
      // 운영처명 그대로인 흔한 공고에서 매번 중복 노출된다 — 묶음에서는 N줄 낭비라 접두로 판정.
      location: location && !isRedundantLocation(location, title) ? location : '',
      scheduleLabel,
      roleLine,
      salary: buildSalaryLine(comp),
      url,
    };
  } catch (error) {
    logger.warn('묶음 공유 항목 생성 실패 — 최소 항목 fallback', { jobId: job?.id });
    void toError(error);
    return { title: fallbackTitle, location: '', scheduleLabel: '', roleLine: '', salary: '', url };
  }
}

/** 항목 1건의 본문 블록. 값이 없는 라인은 통째로 생략한다. */
function composeItemBlock(item: BulkShareItem, index: number): string {
  const lines = [`${index + 1}. ${item.title}`];
  if (item.location) lines.push(`📍 ${item.location}`);
  if (item.scheduleLabel) lines.push(`📅 ${item.scheduleLabel}`);
  if (item.roleLine) lines.push(`🙋 ${item.roleLine}`);
  if (item.salary) lines.push(`💰 ${item.salary}`);
  lines.push(`👉 ${item.url}`);
  return lines.join('\n');
}

/**
 * 항목 배열 → 최종 공유 본문(순수 함수).
 *
 * 길이 상한을 넘기면 넘긴 항목부터 잘라내고 "외 N건" 안내를 붙인다.
 * 최소 1건은 항상 포함한다(상한이 아무리 작아도 빈 메시지를 보내지 않는다).
 */
export function composeBulkJobShareText(
  items: BulkShareItem[],
  options?: { maxChars?: number }
): string {
  const maxChars = options?.maxChars ?? MAX_SHARE_TEXT_LENGTH;
  const header = `[UNIQN] 공고 ${items.length}건 모집`;

  const included: string[] = [];
  let length = header.length;

  items.forEach((item, index) => {
    const block = composeItemBlock(item, index);
    const projected = length + block.length + 2; // '\n\n'
    if (included.length > 0 && projected > maxChars) {
      return;
    }
    included.push(block);
    length = projected;
  });

  const omitted = items.length - included.length;
  const tail = omitted > 0 ? `\n\n…외 ${omitted}건은 앱에서 확인해주세요` : '';

  return `${header}\n\n${included.join('\n\n')}${tail}`;
}

// ============================================================================
// 정렬
// ============================================================================

/** 공고의 가장 이른 근무일(YYYY-MM-DD). 없으면 빈 문자열. */
function earliestWorkDate(job: JobPosting): string {
  const dates = [
    ...(job.schedule?.kind === 'dated' ? (job.schedule.allDates ?? []) : []),
    ...(job.workDates ?? []),
    ...(job.workDate ? [job.workDate] : []),
  ].filter(Boolean);
  return dates.length > 0 ? dates.slice().sort()[0] : '';
}

/**
 * 공유 순서 = 근무일 오름차순, 동일 날짜는 제목 사전순.
 * 선택한 순서(탭 순서)를 그대로 쓰면 대회 D-7 묶음에서 날짜가 뒤섞여 읽기 어렵다.
 * 날짜 없는 공고(고정 공고 등)는 뒤로 보낸다.
 */
export function sortJobsForBulkShare(jobs: JobPosting[]): JobPosting[] {
  return jobs.slice().sort((a, b) => {
    const dateA = earliestWorkDate(a);
    const dateB = earliestWorkDate(b);
    if (dateA !== dateB) {
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA < dateB ? -1 : 1;
    }
    return (a.title ?? '').localeCompare(b.title ?? '', 'ko');
  });
}

// ============================================================================
// 진입점
// ============================================================================

/**
 * 공고 묶음 공유 본문 생성.
 *
 * @param jobs      공유할 공고들 (호출부에서 canShareJob 통과분만 넘긴다)
 * @param urlOf     공고 id → 외부 공유 URL
 * @param filledFor (선택) 공고 id → 해당 공고의 `date__slot__role` 확정 인원 맵.
 *                  미주입 시 🙋 라인이 0/N 으로 degrade 한다(단일 공유와 동일).
 */
export function buildBulkJobShareText(
  jobs: JobPosting[],
  urlOf: (jobId: string) => string,
  filledFor?: (jobId: string) => Map<string, number> | undefined,
  options?: { maxChars?: number }
): string {
  const items = sortJobsForBulkShare(jobs).map((job) =>
    buildBulkShareItem(job, urlOf(job.id), filledFor?.(job.id))
  );
  return composeBulkJobShareText(items, options);
}
