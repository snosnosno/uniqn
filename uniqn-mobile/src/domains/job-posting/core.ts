import type {
  CardDateRequirement,
  CardRole,
  CardTimeSlot,
  JobPosting,
  JobRoleStats,
  PostingDateGroup,
  PostingSalaryRow,
  PostingSettlementContext,
  RoleRequirement,
  SalaryInfo,
} from '@/types';
import type { DateSpecificRequirement, TimeSlot } from '@/types/jobPosting/dateRequirement';
import type { RoleWithCount } from '@/types/postingConfig';
import { FIXED_TIME_MARKER, TBA_TIME_MARKER } from '@/types/assignment';
import { getRegionLabel } from '@/constants/regions';
import { getRoleDisplayName } from '@/types/unified';
import { groupRequirementsToDateRanges } from '@/utils/date';
import { formatNumber, formatSalary } from '@/utils/formatters';

export function getPostingRoleKey(role: { role?: string; customRole?: string }): string {
  if (role.role === 'other' && role.customRole) {
    return `other:${role.customRole}`;
  }

  return role.role ?? '';
}

export function getPostingLocationLabels(posting: JobPosting): {
  shortLabel: string;
  fullLabel: string;
  regionLabel?: string;
} {
  const name = posting.location?.name || '';
  // 주소 검색 도입(B1) 이후 detailedAddress 는 층/호 조각이라 fullLabel 은 '라운더스 홀덤펍 3층'
  // 꼴이 된다. 도로명주소(district)를 여기 넣지 않는 것은 **의도** — fullLabel 은 카드 제목·공유
  // 메시지 한 줄에 쓰이고, 전체 주소는 별도 주소 줄(InfoTab)·지도 링크가 담당한다.
  const detailed = posting.location?.detailedAddress || '';
  // 구조화 지역(region slug) → 표시 라벨(예: '서울 강남구' → '강남구'). 미설정/미지정 slug 는 undefined.
  const regionLabel = getRegionLabel(posting.location?.region);

  return {
    shortLabel: name,
    fullLabel: `${name}${detailed ? ` ${detailed}` : ''}`.trim(),
    ...(regionLabel ? { regionLabel } : {}),
  };
}

export function getPostingTaxLabel(posting: JobPosting): string | undefined {
  const taxSettings = posting.compensation.taxSettings;

  if (!taxSettings || taxSettings.type === 'none') {
    return undefined;
  }

  return taxSettings.type === 'rate'
    ? `세금 ${taxSettings.value}%`
    : `세금 ${formatNumber(taxSettings.value)}원`;
}

function toRoleRequirement(role: {
  role?: string;
  customRole?: string;
  count: number;
}): RoleRequirement {
  return {
    role: (role.role ?? 'dealer') as RoleRequirement['role'],
    customRole: role.customRole,
    count: role.count,
    // SP3: schedule role.filled(dead counter) 제거 — 충원은 표시 시점 hydrate 가 덮어씀
    filled: 0,
  };
}

function toCardRole(
  role: {
    id?: string;
    role?: string;
    customRole?: string;
    count?: number;
    headcount?: number;
  },
  salary?: SalaryInfo
): CardRole {
  return {
    id: role.id,
    role: role.role ?? 'dealer',
    customRole: role.customRole,
    count: role.count ?? role.headcount ?? 0,
    // SP3: schedule role.filled 제거 — 충원은 표시 시점 hydrate 가 덮어씀
    filled: 0,
    salary,
  };
}

function toCardTimeSlot(slot: {
  id?: string;
  startTime?: string;
  isTimeToBeAnnounced?: boolean;
  tentativeDescription?: string;
  roles: {
    id?: string;
    role?: string;
    customRole?: string;
    count?: number;
    headcount?: number;
    filled?: number;
    salary?: SalaryInfo;
  }[];
}): CardTimeSlot {
  return {
    id: slot.id,
    startTime: slot.startTime || '',
    isTimeToBeAnnounced: slot.isTimeToBeAnnounced ?? false,
    tentativeDescription: slot.tentativeDescription,
    roles: slot.roles.map((role) => toCardRole(role, role.salary)),
  };
}

export function getPostingRoleStats(posting: JobPosting): JobRoleStats[] {
  const totals = new Map<string, JobRoleStats>();

  posting.schedule.requirements.forEach((requirement) => {
    requirement.timeSlots.forEach((slot) => {
      slot.roles.forEach((role) => {
        const key = getPostingRoleKey(role);
        const existing = totals.get(key);
        const catalogEntry = posting.roleCatalog.find((entry) => getPostingRoleKey(entry) === key);

        if (existing) {
          totals.set(key, {
            ...existing,
            count: existing.count + role.count,
            // SP3: schedule role.filled 누적 제거 — 충원은 표시 시점 hydrate 가 덮어씀(0 유지)
            filled: 0,
          });
          return;
        }

        totals.set(key, {
          ...toRoleRequirement(role),
          salary: catalogEntry?.salary,
        });
      });
    });
  });

  return Array.from(totals.values());
}

export function getPostingDefaultSalary(posting: JobPosting): SalaryInfo | undefined {
  return (
    posting.compensation.defaultSalary ?? posting.roleCatalog.find((role) => role.salary)?.salary
  );
}

export function getPostingSalaryRows(posting: JobPosting): PostingSalaryRow[] {
  const rows = (posting.roleCatalog ?? [])
    .filter((role) => role.salary)
    .map((role) => {
      const roleKey = role.role === 'other' && role.customRole ? role.customRole : role.role;
      const roleLabel = getRoleDisplayName(role.role, role.customRole);

      return {
        key: `${roleKey}-${role.salary?.type}-${role.salary?.amount}`,
        role: role.role,
        customRole: role.customRole,
        roleLabel,
        salary: role.salary!,
        text:
          role.salary?.type === 'other'
            ? '협의'
            : formatSalary(role.salary?.type || 'hourly', role.salary?.amount || 0),
      };
    });

  const unique = new Map<string, PostingSalaryRow>();
  rows.forEach((row) => {
    if (!unique.has(row.key)) {
      unique.set(row.key, row);
    }
  });

  return Array.from(unique.values());
}

export function getPostingDateRequirements(posting: JobPosting): CardDateRequirement[] {
  if (posting.schedule.kind !== 'dated') {
    return [];
  }

  return posting.schedule.requirements.map((requirement) => ({
    // kind !== 'dated' 가드를 통과한 dated requirement만 도달 — date는 항상 string, null 런타임 미발생
    date: requirement.date ?? '',
    isGrouped: requirement.isGrouped,
    timeSlots: requirement.timeSlots.map((slot) => ({
      id: slot.id,
      startTime: slot.startTime || '',
      isTimeToBeAnnounced: slot.isTimeToBeAnnounced ?? false,
      tentativeDescription: slot.tentativeDescription,
      roles: slot.roles.map((role) => {
        const catalogEntry = posting.roleCatalog.find(
          (entry) => getPostingRoleKey(entry) === getPostingRoleKey(role)
        );

        return toCardRole(role, catalogEntry?.salary);
      }),
    })),
  }));
}

export function createPostingLegacyDateRequirements(
  posting: JobPosting
): DateSpecificRequirement[] {
  if (posting.schedule.kind !== 'dated') {
    return [];
  }

  return posting.schedule.requirements.map((requirement) => ({
    // kind !== 'dated' 가드를 통과한 dated requirement만 도달 — date는 항상 string, null 런타임 미발생
    date: requirement.date ?? '',
    isGrouped: requirement.isGrouped,
    timeSlots: requirement.timeSlots.map((slot) => ({
      id: slot.id,
      startTime: slot.startTime,
      isTimeToBeAnnounced: slot.isTimeToBeAnnounced,
      tentativeDescription: slot.tentativeDescription,
      roles: slot.roles.map((role) => ({
        id: role.id,
        role: role.role,
        customRole: role.customRole,
        headcount: role.count,
        // SP3: schedule role.filled(dead counter) 제거
      })),
    })),
  }));
}

export function getPostingDateGroups(posting: JobPosting): PostingDateGroup[] {
  return groupRequirementsToDateRanges(createPostingLegacyDateRequirements(posting)).map(
    (group) => ({
      id: group.id,
      startDate: group.startDate,
      endDate: group.endDate,
      timeSlots: group.timeSlots.map((slot: TimeSlot) =>
        toCardTimeSlot({
          id: slot.id,
          startTime: slot.startTime,
          isTimeToBeAnnounced: slot.isTimeToBeAnnounced,
          tentativeDescription: slot.tentativeDescription,
          roles: slot.roles.map((role) => ({
            id: role.id,
            role: role.role,
            customRole: role.customRole,
            headcount: role.headcount,
            filled: role.filled ?? 0,
            salary: role.salary,
          })),
        })
      ),
    })
  );
}

export function getPostingLegacyTimeSlot(posting: JobPosting): string {
  if (posting.schedule.kind === 'fixed') {
    return posting.schedule.startTime ? `${posting.schedule.startTime}~` : FIXED_TIME_MARKER;
  }

  const firstSlot = posting.schedule.requirements[0]?.timeSlots[0];
  if (!firstSlot) {
    return '';
  }

  if (firstSlot.isTimeToBeAnnounced) {
    return TBA_TIME_MARKER;
  }

  return firstSlot.startTime || '';
}

export function getPostingRequiredRolesWithCount(posting: JobPosting): RoleWithCount[] | undefined {
  if (posting.schedule.kind !== 'fixed') {
    return undefined;
  }

  // SP1 불변식: fixed schedule은 requirements 1개 · timeSlots 1개 (zod superRefine 강제)
  const roles = posting.schedule.requirements[0]?.timeSlots[0]?.roles ?? [];
  return roles.map((role) => ({
    role: role.role ?? 'dealer',
    name: role.customRole,
    count: role.count,
    // SP3: schedule role.filled(dead counter) 제거 — RoleWithCount.filled 는 optional
  }));
}

export function getPostingSettlementContext(posting: JobPosting): PostingSettlementContext {
  return {
    roles: getPostingRoleStats(posting),
    defaultSalary: getPostingDefaultSalary(posting),
    allowances: posting.compensation.allowances,
    taxSettings: posting.compensation.taxSettings,
  };
}
