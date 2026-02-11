/**
 * @file cloudflareKV.ts
 * @description Cloudflare Workers KV REST API 헬퍼
 *
 * OG 메타태그 캐시 데이터를 Cloudflare KV에 저장/삭제.
 * Node 22 native fetch 사용 (node-fetch 불필요).
 *
 * 필요한 환경변수:
 * - CF_ACCOUNT_ID: Cloudflare 계정 ID
 * - CF_KV_NAMESPACE_ID: KV namespace ID
 * - CF_API_TOKEN: KV 쓰기 권한 API 토큰
 */

import * as logger from 'firebase-functions/logger';

const FETCH_TIMEOUT_MS = 10_000;
const KV_TTL_SECONDS = 30 * 24 * 60 * 60; // 30일 (자동 정리용 안전망)

interface KVConfig {
  accountId: string;
  namespaceId: string;
  apiToken: string;
}

function getConfig(): KVConfig {
  const accountId = process.env.CF_ACCOUNT_ID;
  const namespaceId = process.env.CF_KV_NAMESPACE_ID;
  const apiToken = process.env.CF_API_TOKEN;

  if (!accountId || !namespaceId || !apiToken) {
    throw new Error(
      'Cloudflare KV 환경변수 누락: CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID, CF_API_TOKEN 필요'
    );
  }

  return { accountId, namespaceId, apiToken };
}

function buildKVUrl(config: KVConfig, key: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/storage/kv/namespaces/${config.namespaceId}/values/${encodeURIComponent(key)}`;
}

/**
 * KV에 JSON 데이터 저장 (30일 TTL 자동 갱신)
 */
export async function kvPut(key: string, value: object): Promise<void> {
  const config = getConfig();
  const url = `${buildKVUrl(config, key)}?expiration_ttl=${KV_TTL_SECONDS}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(value),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`KV PUT 실패: ${res.status} ${body}`);
    }

    logger.debug('KV PUT 성공', { key });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * KV에서 데이터 삭제
 */
export async function kvDelete(key: string): Promise<void> {
  const config = getConfig();
  const url = buildKVUrl(config, key);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
      },
      signal: controller.signal,
    });

    // 404는 정상 (이미 삭제됨)
    if (!res.ok && res.status !== 404) {
      const body = await res.text().catch(() => '');
      throw new Error(`KV DELETE 실패: ${res.status} ${body}`);
    }

    logger.debug('KV DELETE 성공', { key });
  } finally {
    clearTimeout(timer);
  }
}
