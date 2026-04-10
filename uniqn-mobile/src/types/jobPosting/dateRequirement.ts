import { generateId } from '@/utils/generateId';
import { getTodayString, toDateString, type SerializedTimestamp } from '@/utils/date';
import type { SalaryInfo } from '../jobPosting';
import type { StaffRole } from '../role';

export interface RoleRequirement {
  id?: string;
  role?: StaffRole | 'other';
  customRole?: string;
  headcount?: number;
  salary?: SalaryInfo;
  filled?: number;
}

export interface TimeSlot {
  id?: string;
  startTime?: string;
  isTimeToBeAnnounced?: boolean;
  tentativeDescription?: string;
  roles: RoleRequirement[];
}

export interface DateSpecificRequirement {
  date: string | Date | SerializedTimestamp;
  timeSlots: TimeSlot[];
  isGrouped?: boolean;
}

export interface DateConstraint {
  maxDates: number;
  label: string;
}

export function getDateString(dateInput: string | Date | SerializedTimestamp): string {
  return toDateString(dateInput);
}

export function getDateFromRequirement(requirement: DateSpecificRequirement): string {
  return getDateString(requirement.date);
}

export function sortTimeSlots(timeSlots: TimeSlot[]): TimeSlot[] {
  return [...timeSlots].sort((a, b) => {
    if (a.isTimeToBeAnnounced && !b.isTimeToBeAnnounced) return 1;
    if (!a.isTimeToBeAnnounced && b.isTimeToBeAnnounced) return -1;
    if (a.isTimeToBeAnnounced && b.isTimeToBeAnnounced) return 0;

    const timeA = a.startTime ?? '99:99';
    const timeB = b.startTime ?? '99:99';
    return timeA.localeCompare(timeB);
  });
}

export function sortDateRequirements(
  requirements: DateSpecificRequirement[]
): DateSpecificRequirement[] {
  const today = getTodayString();

  return [...requirements]
    .map((requirement) => ({
      ...requirement,
      timeSlots: sortTimeSlots(requirement.timeSlots),
    }))
    .sort((a, b) => {
      const dateA = getDateFromRequirement(a);
      const dateB = getDateFromRequirement(b);

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      const aIsFuture = dateA >= today;
      const bIsFuture = dateB >= today;

      if (aIsFuture && !bIsFuture) return -1;
      if (!aIsFuture && bIsFuture) return 1;

      if (aIsFuture && bIsFuture) {
        return dateA.localeCompare(dateB);
      }

      return dateB.localeCompare(dateA);
    });
}

export function createDefaultTimeSlot(): TimeSlot {
  return {
    id: generateId(),
    startTime: '09:00',
    isTimeToBeAnnounced: false,
    roles: [createDefaultRole()],
  };
}

export function createDefaultRole(): RoleRequirement {
  return {
    id: generateId(),
    role: 'dealer',
    headcount: 1,
  };
}
