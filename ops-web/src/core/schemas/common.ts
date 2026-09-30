// ⚠️ 자동 생성 파일 — 직접 수정 금지. 정본: uniqn-mobile/src/schemas/common.ts
// 갱신: node scripts/sync-ops-core.mjs (설계 docs/planning/2026-09-27-ops-web-design.md §3.2)
import { z } from 'zod';

export const UUID_LIKE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const uuidLikeSchema = z
  .string()
  .refine((v) => UUID_LIKE_RE.test(v), 'UUID 형식이 아니에요.');
