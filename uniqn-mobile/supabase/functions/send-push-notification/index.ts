// =============================================================================
// send-push-notification Edge Function
// =============================================================================
// 목적: notifications 테이블 INSERT 시 DB trigger가 pg_net으로 이 함수를 호출.
//       수신자의 fcm_tokens를 조회하고 Expo Push API로 푸시를 발송.
//       만료 토큰(DeviceNotRegistered)은 자동으로 fcm_tokens에서 삭제.
//
// 호출 방식:
//   - 자동: notifications INSERT trigger (on_notification_created_send_push)
//   - 수동: curl -X POST <function_url> \
//           -H "Authorization: Bearer <service_role_key>" \
//           -d '{"notificationIds":["<uuid>"]}'
//
// 인증: service_role 키 필수 (trigger 또는 admin 호출)
// =============================================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'npm:expo-server-sdk@3.14.0';
import { TYPE_CATEGORY_MAP } from './typeCategoryMap.ts';

// 이 함수는 trigger / admin 전용 — 브라우저 호출 차단
const responseHeaders = {
  'Content-Type': 'application/json',
};

interface RequestBody {
  notificationIds: string[];
}

interface NotificationRow {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  priority: string | null;
  link: string | null;
}

interface FcmTokenRow {
  user_id: string;
  token: string;
  type: 'expo' | 'fcm';
  platform: 'ios' | 'android';
}

async function fetchNotifications(
  client: SupabaseClient,
  ids: string[]
): Promise<NotificationRow[]> {
  const { data, error } = await client
    .from('notifications')
    .select('id, recipient_id, type, title, body, data, priority, link')
    .in('id', ids);

  if (error) throw new Error(`notifications fetch failed: ${error.message}`);
  return (data ?? []) as NotificationRow[];
}

async function fetchTokensByUsers(
  client: SupabaseClient,
  userIds: string[]
): Promise<Map<string, FcmTokenRow[]>> {
  if (userIds.length === 0) return new Map();

  const { data, error } = await client
    .from('fcm_tokens')
    .select('user_id, token, type, platform')
    .in('user_id', userIds);

  if (error) throw new Error(`fcm_tokens fetch failed: ${error.message}`);

  const map = new Map<string, FcmTokenRow[]>();
  for (const row of (data ?? []) as FcmTokenRow[]) {
    const existing = map.get(row.user_id) ?? [];
    existing.push(row);
    map.set(row.user_id, existing);
  }
  return map;
}

interface PushSettingsRow {
  user_id: string;
  enabled: boolean | null;
  push_enabled: boolean | null;
  categories: Record<string, unknown> | null;
}

// 수신자별 알림 설정 조회. push_enabled(설정 화면 '푸시 알림' 토글) 또는 enabled(전체
// 알림)가 false 면 푸시 발송에서 제외한다. 설정 행이 없으면 기본 허용.
// 카테고리 게이트는 isPushDisabledByCategory 참조(방해금지 시간대는 후속 PR).
async function fetchPushSettingsByUsers(
  client: SupabaseClient,
  userIds: string[]
): Promise<Map<string, PushSettingsRow>> {
  if (userIds.length === 0) return new Map();

  const { data, error } = await client
    .from('notification_settings')
    .select('user_id, enabled, push_enabled, categories')
    .in('user_id', userIds);

  if (error) throw new Error(`notification_settings fetch failed: ${error.message}`);

  const map = new Map<string, PushSettingsRow>();
  for (const row of (data ?? []) as PushSettingsRow[]) {
    map.set(row.user_id, row);
  }
  return map;
}

function isPushDisabledByPreference(settings: PushSettingsRow | undefined): boolean {
  if (!settings) return false; // 설정 없음 = 기본 허용
  return settings.enabled === false || settings.push_enabled === false;
}

// 카테고리별 게이트 — fail-open 원칙: 설정/매핑/형태가 불완전하면 발송한다.
// 이 함수는 전체 푸시의 단일 게이트라 fail-closed 버그는 전 알림 중단 사고가 된다.
// jsonb 내부 키는 클라 저장 형태인 camelCase(pushEnabled)가 표준이나, 방어적으로
// snake_case(push_enabled)도 수용한다(prod 실측 2026-07-11: camelCase 확인).
function isPushDisabledByCategory(
  settings: PushSettingsRow | undefined,
  notificationType: string
): boolean {
  const categories = settings?.categories;
  if (!categories || typeof categories !== 'object') return false;

  const category = TYPE_CATEGORY_MAP[notificationType];
  if (!category) return false; // 미매핑 타입 = 기본 허용

  const categorySetting = (categories as Record<string, unknown>)[category];
  if (!categorySetting || typeof categorySetting !== 'object') return false;

  const { enabled, pushEnabled, push_enabled } = categorySetting as Record<string, unknown>;
  return enabled === false || pushEnabled === false || push_enabled === false;
}

async function removeInvalidToken(client: SupabaseClient, token: string): Promise<void> {
  const { error } = await client.from('fcm_tokens').delete().eq('token', token);
  if (error) {
    console.error('remove invalid token failed', error.message);
  }
}

function buildMessage(
  notification: NotificationRow,
  tokenRow: FcmTokenRow
): ExpoPushMessage | null {
  if (tokenRow.type !== 'expo') {
    // 현재 Phase 1은 Expo Push만 지원. type='fcm' 토큰 채널은 후속 PR에서 추가.
    console.warn(`skip non-expo token (user=${tokenRow.user_id}, type=${tokenRow.type})`);
    return null;
  }
  if (!Expo.isExpoPushToken(tokenRow.token)) {
    console.warn(`invalid expo push token format (user=${tokenRow.user_id})`);
    return null;
  }

  const priority = notification.priority === 'high' ? 'high' : 'default';

  return {
    to: tokenRow.token,
    sound: 'default',
    title: notification.title,
    body: notification.body,
    data: {
      ...(notification.data ?? {}),
      notificationId: notification.id,
      type: notification.type,
      link: notification.link ?? null,
    },
    priority,
    channelId: 'default',
  };
}

// push-02: 발송 재시도 정책. Expo API 는 일시적 5xx·네트워크 단절을 낸다.
// 종전에는 chunk 예외를 콘솔에만 남기고 통째로 버렸다 — 그 chunk 의 사용자는 조용히 누락됐다.
const SEND_MAX_ATTEMPTS = 3;
const SEND_BASE_DELAY_MS = 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 🔑 반환 배열은 messages 와 **같은 길이·같은 순서**다(실패한 자리는 null).
 *
 * 종전 구현은 성공한 chunk 의 ticket 만 push 해서, chunk 하나가 실패하면 그 뒤 인덱스가
 * 통째로 밀렸다. handleTickets 가 tickets[i] 를 messages[i] 와 짝지으므로
 * **DeviceNotRegistered 일 때 엉뚱한 사용자의 토큰을 지우는** 상태였다.
 */
async function sendPushes(
  expo: Expo,
  messages: ExpoPushMessage[]
): Promise<(ExpoPushTicket | null)[]> {
  const chunks = expo.chunkPushNotifications(messages);
  const tickets: (ExpoPushTicket | null)[] = [];

  for (const chunk of chunks) {
    let sent: ExpoPushTicket[] | null = null;

    for (let attempt = 1; attempt <= SEND_MAX_ATTEMPTS; attempt++) {
      try {
        sent = await expo.sendPushNotificationsAsync(chunk);
        break;
      } catch (err) {
        const isLast = attempt === SEND_MAX_ATTEMPTS;
        console.error(
          `sendPushNotificationsAsync chunk failed (attempt ${attempt}/${SEND_MAX_ATTEMPTS})`,
          err
        );
        if (isLast) break;
        // 지수 백오프. Expo 는 과부하 시 429/503 을 내므로 즉시 재시도는 상황을 악화시킨다.
        await sleep(SEND_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }

    if (sent && sent.length === chunk.length) {
      tickets.push(...sent);
    } else {
      // 실패했거나 길이가 어긋난 응답 — 정렬을 보존하기 위해 자리만 채운다.
      if (sent && sent.length !== chunk.length) {
        console.error(`ticket length mismatch: expected ${chunk.length}, got ${sent.length}`);
      }
      tickets.push(...new Array(chunk.length).fill(null));
    }
  }

  return tickets;
}

/**
 * push-02: ticket 을 DB 에 적재한다. ticket ok 는 "Expo 가 접수했다"일 뿐 전달 보증이 아니라서,
 * receipt 를 나중에 회수하려면 ticket id 를 어딘가 남겨야 한다(종전에는 어디에도 없었다).
 *
 * ⚠️ 실패해도 발송은 성공으로 본다 — 관측이 발송을 막으면 안 된다.
 *    (마이그 20260809150000 이 prod 에 적용되기 전 배포되는 창에서도 안전해야 한다.)
 */
async function persistTickets(
  client: SupabaseClient,
  messages: ExpoPushMessage[],
  tickets: (ExpoPushTicket | null)[]
): Promise<void> {
  const rows = messages.flatMap((message, i) => {
    const ticket = tickets[i];
    if (!ticket) return [];
    const token = Array.isArray(message.to) ? message.to[0] : message.to;
    if (typeof token !== 'string') return [];
    const data = (message.data ?? {}) as Record<string, unknown>;
    const notificationId = typeof data.notificationId === 'string' ? data.notificationId : null;
    if (!notificationId) return [];

    return [
      {
        notification_id: notificationId,
        token,
        expo_ticket_id: ticket.status === 'ok' ? ticket.id : null,
        status: ticket.status,
        error_code: ticket.status === 'error' ? (ticket.details?.error ?? null) : null,
        error_message: ticket.status === 'error' ? (ticket.message ?? null) : null,
      },
    ];
  });

  if (rows.length === 0) return;

  const { error } = await client.from('push_tickets').insert(rows);
  if (error) {
    console.error('push_tickets insert failed (발송에는 영향 없음)', error.message);
  }
}

async function handleTickets(
  client: SupabaseClient,
  messages: ExpoPushMessage[],
  tickets: (ExpoPushTicket | null)[]
): Promise<void> {
  for (let i = 0; i < messages.length; i++) {
    const ticket = tickets[i];
    const message = messages[i];
    if (!ticket || !message) continue;

    if (ticket.status === 'error') {
      const errorCode = ticket.details?.error;
      if (errorCode === 'DeviceNotRegistered' || errorCode === 'InvalidCredentials') {
        const token = Array.isArray(message.to) ? message.to[0] : message.to;
        if (typeof token === 'string') {
          await removeInvalidToken(client, token);
          console.warn(`removed invalid token: ${token.substring(0, 20)}... (${errorCode})`);
        }
      } else {
        console.error(`push send error (${errorCode}): ${ticket.message}`);
      }
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: responseHeaders,
    });
  }

  // service_role 키만 호출 허용 (anon 차단)
  const expectedAuth = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`;
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || authHeader !== expectedAuth) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: responseHeaders,
    });
  }

  try {
    const payload = (await req.json()) as RequestBody;

    if (
      !payload.notificationIds ||
      !Array.isArray(payload.notificationIds) ||
      payload.notificationIds.length === 0
    ) {
      return new Response(JSON.stringify({ error: 'notificationIds (non-empty array) required' }), {
        status: 400,
        headers: responseHeaders,
      });
    }

    const client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const expo = new Expo();

    const notifications = await fetchNotifications(client, payload.notificationIds);

    if (notifications.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no notifications found' }), {
        status: 200,
        headers: responseHeaders,
      });
    }

    const recipientIds = [...new Set(notifications.map((n) => n.recipient_id))];
    const tokensByUser = await fetchTokensByUsers(client, recipientIds);
    const pushSettingsByUser = await fetchPushSettingsByUsers(client, recipientIds);

    const messages: ExpoPushMessage[] = [];
    let skippedByPreference = 0;
    let skippedByCategory = 0;
    for (const notification of notifications) {
      const recipientSettings = pushSettingsByUser.get(notification.recipient_id);
      // 사용자가 푸시 알림을 끈 경우 발송 제외 (설정 토글 실효화)
      if (isPushDisabledByPreference(recipientSettings)) {
        skippedByPreference++;
        continue;
      }
      // 카테고리 토글이 꺼진 경우 발송 제외 (설정 화면 카테고리 토글 실효화)
      if (isPushDisabledByCategory(recipientSettings, notification.type)) {
        skippedByCategory++;
        continue;
      }
      const tokens = tokensByUser.get(notification.recipient_id) ?? [];
      for (const tokenRow of tokens) {
        const msg = buildMessage(notification, tokenRow);
        if (msg) messages.push(msg);
      }
    }

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({
          sent: 0,
          reason: 'no valid tokens',
          notifications: notifications.length,
          recipients: recipientIds.length,
          skippedByPreference,
          skippedByCategory,
        }),
        { status: 200, headers: responseHeaders }
      );
    }

    const tickets = await sendPushes(expo, messages);
    await persistTickets(client, messages, tickets);
    await handleTickets(client, messages, tickets);

    const successCount = tickets.filter((t) => t?.status === 'ok').length;
    const errorCount = tickets.filter((t) => t?.status === 'error').length;
    // 재시도까지 실패해 ticket 자체를 못 받은 건 — 종전에는 성공/실패 어디에도 안 잡혔다.
    const undeliveredCount = tickets.filter((t) => t === null).length;

    return new Response(
      JSON.stringify({
        sent: messages.length,
        success: successCount,
        errors: errorCount,
        undelivered: undeliveredCount,
        notifications: notifications.length,
        recipients: recipientIds.length,
        skippedByPreference,
        skippedByCategory,
      }),
      { status: 200, headers: responseHeaders }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('send-push-notification error', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: responseHeaders,
    });
  }
});
