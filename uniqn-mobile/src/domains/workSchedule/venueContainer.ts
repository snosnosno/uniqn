/**
 * venueContainer — 운영처 컨테이너 경량 타입 + 파서
 *
 * 컨테이너(status='container')는 rigid 한 JobPosting(JobPostingDocumentV3)으로 표현하지 않는다.
 * 컨테이너의 schedule(softTargets 보유)·빈 location/compensation 은 jobPostingDocumentSchema 의
 * strict 필수와 충돌해 parseJobPostingDocument 에서 null 증발한다(적대 리뷰 HIGH). 그래서 그리드는
 * 이 경량 VenueContainer 로만 컨테이너를 읽는다(전용 read 경로, 증발 회피).
 */
import { z } from 'zod';
import type { PostingRoleCatalogEntry } from '@/types';
import { getSoftTargets } from './softTargets';
import { getRoleSalaries } from './roleSalaries';

export interface VenueContainer {
  /** 컨테이너 공고 id (= venue 식별자) */
  id: string;
  /** 운영처명 (job_postings.title) */
  name: string;
  workspaceId: string;
  ownerId: string | null;
  /** 컨테이너 자기참조(= id). 비정상 데이터 방어로 nullable */
  venueId: string | null;
  /** 'dated' | 'fixed' (schedule.kind) */
  kind: string;
  /** 날짜별 목표인원 (schedule.softTargets), YYYY-MM-DD 키 */
  softTargets: Record<string, number>;
  /** 역할별 단가표 (schedule.roleSalaries) — JIT 급여 설계 §A */
  roleSalaries: PostingRoleCatalogEntry[];
}

const rawRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  workspace_id: z.string(),
  owner_id: z.string().nullable().optional(),
  venue_id: z.string().nullable().optional(),
  schedule: z.unknown().optional(),
  status: z.string().optional(),
});

/** 컨테이너 raw 행(snake_case 선택 컬럼)을 VenueContainer 로 파싱. 비정상이면 null. */
export function parseVenueContainer(row: unknown): VenueContainer | null {
  const result = rawRowSchema.safeParse(row);
  if (!result.success) return null;
  const r = result.data;
  const schedule = (r.schedule ?? {}) as { kind?: string };
  return {
    id: r.id,
    name: r.title,
    workspaceId: r.workspace_id,
    ownerId: r.owner_id ?? null,
    venueId: r.venue_id ?? null,
    kind: typeof schedule.kind === 'string' ? schedule.kind : 'dated',
    softTargets: getSoftTargets(r.schedule as never),
    roleSalaries: getRoleSalaries(r.schedule),
  };
}

export function parseVenueContainers(rows: unknown[]): VenueContainer[] {
  return rows.map(parseVenueContainer).filter((v): v is VenueContainer => v !== null);
}

/** 컨테이너 read 경로가 select 할 컬럼 목록(SSOT). */
export const VENUE_CONTAINER_COLUMNS =
  'id, title, workspace_id, owner_id, venue_id, schedule, status';
