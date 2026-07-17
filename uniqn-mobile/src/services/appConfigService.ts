/**
 * UNIQN Mobile — 앱 설정(app_config) 읽기 서비스
 *
 * @description Supabase app_config 테이블의 원격 기능 플래그를 읽는 경량 read 경로.
 * 정규화/검증은 호출부(도메인 순수 파서)에 위임하고, 여기서는 raw value 만 반환한다.
 * 읽기 패턴은 versionService.getRemoteVersionConfig 와 동일(app_config select).
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';

/** app_config 의 주간 그리드 플래그 키(SSOT). */
const WEEKLY_GRID_FLAG_KEY = 'weekly_grid_enabled';

/** app_config 의 ops 허브 진입 표면 플래그 키(SSOT). */
const OPS_HUB_FLAG_KEY = 'ops_hub_enabled';

/**
 * 주간 그리드 원격 플래그 raw value 조회.
 *
 * @returns app_config.weekly_grid_enabled 의 value(모양 불명, unknown). 행 부재·오류 시 null.
 *          boolean 정규화는 도메인 파서(parseWeeklyGridFlag)가 담당한다.
 */
export async function getWeeklyGridFlagRaw(): Promise<unknown> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', WEEKLY_GRID_FLAG_KEY)
      .maybeSingle();

    if (error) {
      logger.warn('주간 그리드 플래그 조회 실패, fallback 적용', {
        component: 'appConfigService',
        code: error.code,
      });
      return null;
    }

    // data 가 없으면(행 부재) null → 호출부에서 fallback 흡수
    return data?.value ?? null;
  } catch (error) {
    logger.warn('주간 그리드 플래그 로드 예외, fallback 적용', {
      component: 'appConfigService',
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * ops 허브 진입 표면 원격 플래그 raw value 조회.
 *
 * @returns app_config.ops_hub_enabled 의 value(모양 불명, unknown). 행 부재·오류 시 null.
 *          boolean 정규화는 도메인 파서(parseOpsHubFlag)가 담당한다.
 */
export async function getOpsHubFlagRaw(): Promise<unknown> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', OPS_HUB_FLAG_KEY)
      .maybeSingle();

    if (error) {
      logger.warn('ops 허브 플래그 조회 실패, fallback 적용', {
        component: 'appConfigService',
        code: error.code,
      });
      return null;
    }

    // data 가 없으면(행 부재) null → 호출부에서 fallback 흡수
    return data?.value ?? null;
  } catch (error) {
    logger.warn('ops 허브 플래그 로드 예외, fallback 적용', {
      component: 'appConfigService',
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
