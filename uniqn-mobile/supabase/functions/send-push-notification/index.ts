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
}

// 수신자별 알림 설정 조회. push_enabled(설정 화면 '푸시 알림' 토글) 또는 enabled(전체
// 알림)가 false 면 푸시 발송에서 제외한다. 설정 행이 없으면 기본 허용.
// (카테고리별/방해금지 시간대 세분화 게이트는 후속 PR — 우선 마스터 토글을 실효화.)
async function fetchPushSettingsByUsers(
  client: SupabaseClient,
  userIds: string[]
): Promise<Map<string, PushSettingsRow>> {
  if (userIds.length === 0) return new Map();

  const { data, error } = await client
    .from('notification_settings')
    .select('user_id, enabled, push_enabled')
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

async function sendPushes(expo: Expo, messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  const chunks = expo.chunkPushNotifications(messages);
  const tickets: ExpoPushTicket[] = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (err) {
      console.error('sendPushNotificationsAsync chunk failed', err);
      // chunk 단위 실패 시 해당 chunk만 스킵, 나머지 계속
    }
  }

  return tickets;
}

async function handleTickets(
  client: SupabaseClient,
  messages: ExpoPushMessage[],
  tickets: ExpoPushTicket[]
): Promise<void> {
  for (let i = 0; i < tickets.length; i++) {
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
    for (const notification of notifications) {
      // 사용자가 푸시 알림을 끈 경우 발송 제외 (설정 토글 실효화)
      if (isPushDisabledByPreference(pushSettingsByUser.get(notification.recipient_id))) {
        skippedByPreference++;
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
        }),
        { status: 200, headers: responseHeaders }
      );
    }

    const tickets = await sendPushes(expo, messages);
    await handleTickets(client, messages, tickets);

    const successCount = tickets.filter((t) => t.status === 'ok').length;
    const errorCount = tickets.filter((t) => t.status === 'error').length;

    return new Response(
      JSON.stringify({
        sent: messages.length,
        success: successCount,
        errors: errorCount,
        notifications: notifications.length,
        recipients: recipientIds.length,
        skippedByPreference,
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
