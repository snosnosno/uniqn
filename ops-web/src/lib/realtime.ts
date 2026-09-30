/**
 * 읽기 전용 realtime 구독 — 콜백은 캐시 무효화만(CLAUDE.md 아키텍처 예외, 모바일 createRealtimeSubscription 과 같은 계약).
 *
 * 웹 전용 보강(설계 §5):
 * - 같은 (테이블, 필터)는 채널 하나를 공유한다(refcount) — 탭 여러 개가 같은 데이터를 봐도 소켓 구독은 1개.
 * - CHANNEL_ERROR·TIMED_OUT 뒤 다시 SUBSCRIBED 되면 **놓친 변경이 있을 수 있으니** onResync 를 부른다.
 * - 토큰 갱신은 supabase-js 가 realtime `accessToken` 콜백으로 heartbeat 마다 넘긴다(별도 setAuth 불필요).
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { logger } from './logger';
import { supabase } from './supabase';

type Listener = { onChange: () => void; onResync: () => void };

interface Entry {
  channel: RealtimeChannel;
  listeners: Set<Listener>;
  hadError: boolean;
}

const registry = new Map<string, Entry>();

export function channelNameFor(table: string, filter: string): string {
  return `ops-web:${table}:${filter}`;
}

export function subscribeTable(
  table: string,
  filter: string,
  onChange: () => void,
  onResync: () => void = onChange
): () => void {
  const name = channelNameFor(table, filter);
  const listener: Listener = { onChange, onResync };
  const existing = registry.get(name);
  if (existing) {
    existing.listeners.add(listener);
    return () => release(name, listener);
  }

  const entry: Entry = {
    channel: supabase.channel(name),
    listeners: new Set([listener]),
    hadError: false,
  };
  registry.set(name, entry);
  entry.channel
    .on('postgres_changes', { event: '*', schema: 'public', table, filter }, () => {
      entry.listeners.forEach((l) => l.onChange());
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (entry.hadError) {
          entry.hadError = false;
          logger.info('realtime 복구 — 재동기화', { table, filter });
          entry.listeners.forEach((l) => l.onResync());
          recomputeConnected();
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        entry.hadError = true;
        logger.warn('realtime 채널 오류(자동 재시도)', { table, filter, status });
        recomputeConnected();
      }
    });
  return () => release(name, listener);
}

function release(name: string, listener: Listener): void {
  const entry = registry.get(name);
  if (!entry) return;
  entry.listeners.delete(listener);
  if (entry.listeners.size === 0) {
    registry.delete(name);
    void supabase.removeChannel(entry.channel);
    recomputeConnected();
  }
}

// ─── 연결 상태(클럭 스트립 "실시간 연결 / 재연결 중") ─────────────────────────────

const statusListeners = new Set<() => void>();
let connected = true;

function recomputeConnected(): void {
  const online = typeof navigator === 'undefined' || navigator.onLine !== false;
  const next = online && [...registry.values()].every((e) => !e.hadError);
  if (next !== connected) {
    connected = next;
    statusListeners.forEach((l) => l());
  }
}

export function isRealtimeConnected(): boolean {
  return connected;
}

export function subscribeRealtimeStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', recomputeConnected);
  window.addEventListener('offline', recomputeConnected);
}
