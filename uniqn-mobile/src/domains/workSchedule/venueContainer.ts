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

/**
 * 지점 장소 정보 (job_postings.location jsonb).
 * 키 집합은 postingLocationSchema(schemas/jobPosting.schema.ts)·update_venue_container RPC 의
 * 화이트리스트와 동일하다. 전부 선택 — 지점은 장소를 안 적어도 만들 수 있다.
 * ⚠️ S1 범위에서 UI 가 채우는 것은 `name`(장소명)뿐이다. 주소(district/detailedAddress)는
 *    주소검색 컴포넌트가 머지된 뒤 얹는다 — 자유 텍스트 주소 입력을 만들지 말 것.
 */
export interface VenueContainerLocation {
  name?: string;
  district?: string;
  region?: string;
  detailedAddress?: string;
}

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
  /** 장소 정보. 미설정이면 null (DB 는 NOT NULL 이라 빈 객체 `{}` 로 들어온다) */
  location: VenueContainerLocation | null;
  /** 지점 대표 연락처 (job_postings.contact_phone) */
  contactPhone: string | null;
  /** 지점 소개 (job_postings.description) */
  description: string | null;
}

const locationSchema = z
  .object({
    name: z.string().optional(),
    district: z.string().optional(),
    region: z.string().optional(),
    detailedAddress: z.string().optional(),
  })
  // strict 가 아니다 — 미래에 서버가 키를 추가해도 여기서 read 가 증발하면 안 된다(#194 클래스).
  .passthrough();

const rawRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  workspace_id: z.string(),
  owner_id: z.string().nullable().optional(),
  venue_id: z.string().nullable().optional(),
  schedule: z.unknown().optional(),
  status: z.string().optional(),
  location: z.unknown().optional(),
  contact_phone: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

/** location jsonb → VenueContainerLocation. 빈 객체·비객체·파싱 실패는 전부 null. */
export function parseVenueContainerLocation(raw: unknown): VenueContainerLocation | null {
  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const result = locationSchema.safeParse(raw);
  if (!result.success) return null;
  const { name, district, region, detailedAddress } = result.data;
  const value: VenueContainerLocation = {};
  if (name) value.name = name;
  if (district) value.district = district;
  if (region) value.region = region;
  if (detailedAddress) value.detailedAddress = detailedAddress;
  // DB 기본값이 '{}' 라 "미설정"이 빈 객체로 온다 — 소비처가 truthy 검사만 해도 되도록 null 화.
  return Object.keys(value).length > 0 ? value : null;
}

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
    location: parseVenueContainerLocation(r.location),
    contactPhone: r.contact_phone ?? null,
    description: r.description ?? null,
  };
}

export function parseVenueContainers(rows: unknown[]): VenueContainer[] {
  return rows.map(parseVenueContainer).filter((v): v is VenueContainer => v !== null);
}

/**
 * 컨테이너 read 경로가 select 할 컬럼 목록(SSOT).
 * ⚠️ VenueContainer 에 필드를 추가하면 여기에도 컬럼을 넣어야 한다 — 한쪽만 고치면
 *    값이 저장돼 있어도 애초에 읽히지 않아 "저장은 됐는데 안 보인다"가 된다(#194 클래스).
 */
export const VENUE_CONTAINER_COLUMNS =
  'id, title, workspace_id, owner_id, venue_id, schedule, status, location, contact_phone, description';
