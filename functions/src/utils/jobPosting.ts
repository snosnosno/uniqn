export interface JobPostingLocation {
  name?: string;
  district?: string;
  detailedAddress?: string;
  region?: string;
}

export type JobPostingLocationInput = JobPostingLocation | string | null | undefined;

export interface JobPostingRoleCatalogEntry {
  role?: string;
  customRole?: string;
}

export interface JobPostingSearchIndexSource {
  title?: string;
  description?: string;
  location?: JobPostingLocationInput;
  roleCatalog?: JobPostingRoleCatalogEntry[];
}

export const JOB_POSTING_NOTIFICATION_FIELDS = [
  "title",
  "location",
  "workDate",
  "workDates",
  "schedule",
  "compensation",
  "roleCatalog",
  "postingType",
  "status",
] as const;

function normalizeText(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function tokenize(value: string | null | undefined): string[] {
  return normalizeText(value)
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

export function formatJobPostingLocation(location: JobPostingLocationInput): string {
  if (typeof location === "string") {
    return normalizeText(location);
  }

  if (!location) {
    return "";
  }

  const parts = [location.name, location.district, location.region]
    .map((part) => normalizeText(part))
    .filter((part) => part.length > 0);

  return Array.from(new Set(parts)).join(" ");
}

export function getJobPostingDistrict(location: JobPostingLocationInput): string {
  if (!location || typeof location === "string") {
    return "";
  }

  return normalizeText(location.district);
}

function getRoleSearchTokens(roleCatalog: JobPostingRoleCatalogEntry[] = []): string[] {
  return roleCatalog.flatMap((entry) => {
    const customRoleTokens = tokenize(entry.customRole);
    const roleTokens = entry.role && entry.role !== "other" ? tokenize(entry.role) : [];
    return [...roleTokens, ...customRoleTokens];
  });
}

export function buildJobPostingSearchIndex(source: JobPostingSearchIndexSource): string[] {
  const locationText = formatJobPostingLocation(source.location);
  const tokens = [
    ...tokenize(source.title),
    ...tokenize(source.description),
    ...tokenize(locationText),
    ...getRoleSearchTokens(source.roleCatalog),
  ];

  return Array.from(new Set(tokens));
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  return `{${sortedKeys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function getChangedJobPostingNotificationFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  return JOB_POSTING_NOTIFICATION_FIELDS.filter(
    (field) => stableStringify(before[field]) !== stableStringify(after[field]),
  );
}

