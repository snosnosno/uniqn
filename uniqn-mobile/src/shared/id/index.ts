/**
 * UNIQN Mobile - ID 정규화 모듈
 *
 * @module shared/id
 */

export {
  IdNormalizer,
  normalizeJobId,
  normalizeUserId,
  extractUnifiedIds,
  generateApplicationId,
  parseApplicationId,
} from './IdNormalizer';

export type { JobIdDocument, UserIdDocument, ParsedApplicationId } from './IdNormalizer';
