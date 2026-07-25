/**
 * 공개뷰 익명 신고 시트 (S1 B2 — D7 스펙).
 * 진입: 공개뷰 최하단 캡션급 링크(상시 버튼 금지) → 익명 폼(사유 3종 + 선택 상세).
 * 접수 후 재신고는 서버 rate limit(대회당 시간당 5건) + 로컬 "접수됨" 상태로 억제.
 * 공개 라우트(무계정) — authStore 비의존, 다크 고정 표면 대응(다크 톤 우선).
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ModalKeyboardAvoider } from '@/components/ui/ModalKeyboardAvoider';
import { opsReportService } from '@/services/ops';
import { OPS_REPORT_REASON_LABELS, type OpsReportReason } from '@/types/ops';
import { isAppError } from '@/errors';
import { logger } from '@/utils/logger';

const REASONS: OpsReportReason[] = ['gambling', 'illegal_gambling', 'other'];
const DETAILS_MAX = 500;

interface Props {
  visible: boolean;
  onClose: () => void;
  tokenKind: 'monitor' | 'player';
  token: string;
}

export function PublicReportSheet({ visible, onClose, tokenKind, token }: Props) {
  const [reason, setReason] = useState<OpsReportReason>('gambling');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await opsReportService.submitReport({
        tokenKind,
        token,
        reason,
        // trim 한 값으로 검사했으면 전송도 trim 한 값이어야 한다 — 원문을 보내면
        // 앞뒤 공백이 그대로 저장되고 DETAILS_MAX 절단 위치도 어긋난다(2026-07-25).
        details: details.trim() ? details.trim().slice(0, DETAILS_MAX) : null,
      });
      setDone(true);
    } catch (error) {
      logger.warn('공개뷰 신고 실패', { tokenKind });
      setErrorMsg(
        isAppError(error) ? error.userMessage : '신고 접수에 실패했어요. 잠시 후 다시 시도해주세요.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* 저높이 뷰포트·키보드 오픈 시 카드가 화면 밖으로 밀리지 않도록
          높이 상한(85%) + 내부 스크롤 + IME 인셋 보정을 건다(2026-07-25).
          statusBarTranslucent 는 ModalKeyboardAvoider 의 전제 — 비-translucent 모달은
          시스템 ADJUST_RESIZE 가 살아있어 IME 인셋을 또 더하면 이중 보정이 된다. */}
      <ModalKeyboardAvoider>
        <Pressable
          className="flex-1 items-center justify-center bg-black/60 px-6"
          onPress={onClose}
          accessibilityLabel="신고 창 닫기"
        >
          <Pressable
            className="w-full max-w-[420px] overflow-hidden rounded-2xl bg-gray-800 p-5"
            style={{ maxHeight: '85%' }}
            onPress={(e) => e.stopPropagation()}
          >
            {done ? (
              <View className="items-center gap-3 py-4">
                <Text className="text-lg font-sans-bold text-off-white">신고가 접수됐어요</Text>
                <Text className="text-center text-sm text-secondary-400">
                  운영팀이 확인 후 필요한 조치를 취할게요.
                </Text>
                <Pressable
                  onPress={onClose}
                  hitSlop={12}
                  className="mt-2 rounded-lg bg-gray-700 px-6 py-3"
                  accessibilityRole="button"
                >
                  <Text className="text-sm font-sans-semibold text-off-white">닫기</Text>
                </Pressable>
              </View>
            ) : (
              <View className="gap-4" style={{ flexShrink: 1 }}>
                {/* 폼 본문만 스크롤 — 취소/신고 버튼은 카드 하단에 항상 남는다 */}
                <ScrollView
                  style={{ flexGrow: 0, flexShrink: 1 }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <View className="gap-4">
                    <View className="gap-1">
                      <Text className="text-lg font-sans-bold text-off-white">문제 신고</Text>
                      <Text className="text-xs text-secondary-400">
                        익명으로 접수돼요. 필요 시에만 상세 내용을 남겨주세요.
                      </Text>
                    </View>

                    <View className="gap-2">
                      {REASONS.map((r) => {
                        const selected = reason === r;
                        return (
                          <Pressable
                            key={r}
                            onPress={() => setReason(r)}
                            hitSlop={8}
                            accessibilityRole="radio"
                            accessibilityState={{ selected }}
                            className={`flex-row items-center gap-3 rounded-lg border px-4 py-3 ${
                              selected ? 'border-primary-400 bg-gray-700' : 'border-gray-600'
                            }`}
                          >
                            <View
                              className={`h-4 w-4 rounded-full border-2 ${
                                selected
                                  ? 'border-primary-400 bg-primary-400'
                                  : 'border-secondary-400'
                              }`}
                            />
                            <Text className="text-sm font-sans-medium text-off-white">
                              {OPS_REPORT_REASON_LABELS[r]}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <TextInput
                      value={details}
                      onChangeText={setDetails}
                      placeholder="상세 내용 (선택)"
                      placeholderTextColor="#9ca3af"
                      multiline
                      maxLength={DETAILS_MAX}
                      className="min-h-[72px] rounded-lg border border-gray-600 px-3 py-2 text-sm text-off-white"
                      accessibilityLabel="신고 상세 내용"
                    />

                    {errorMsg ? <Text className="text-xs text-error-400">{errorMsg}</Text> : null}
                  </View>
                </ScrollView>

                {/* 구분선 — 본문이 스크롤될 때 "위에 더 있음"을 알리는 경계.
                    다크 고정 표면이라 divider 토큰 대신 카드 내 gray-600 톤을 쓴다. */}
                <View className="flex-row gap-2 border-t border-gray-600 pt-3">
                  <Pressable
                    onPress={onClose}
                    hitSlop={8}
                    className="flex-1 items-center rounded-lg bg-gray-700 py-3"
                    accessibilityRole="button"
                  >
                    <Text className="text-sm font-sans-semibold text-secondary-300">취소</Text>
                  </Pressable>
                  <Pressable
                    onPress={submit}
                    disabled={submitting}
                    hitSlop={8}
                    className="flex-1 items-center rounded-lg bg-error-500 py-3"
                    accessibilityRole="button"
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text className="text-sm font-sans-semibold text-white">신고하기</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </Pressable>
        </Pressable>
      </ModalKeyboardAvoider>
    </Modal>
  );
}

/** 최하단 캡션급 신고 링크(D7 — 상시 버튼 금지·터치 44px hitSlop 확보). */
export function ReportFooterLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
      accessibilityRole="button"
      accessibilityLabel="이 대회 신고하기"
      className="min-h-[44px] items-center justify-center self-center"
    >
      <Text className="text-xs text-secondary-500 underline">문제가 있나요? 신고</Text>
    </Pressable>
  );
}
