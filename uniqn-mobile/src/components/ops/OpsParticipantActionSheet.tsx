/** 참가자 액션시트(L5·L6). 참가 행(seat 없음)·테이블 좌석(seat 있음) 공용. 탈락은 하단 격리. */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SheetModal, SelectBottomSheet } from '@/components/ui';
import { ChipCountSheet } from './ChipCountSheet';
import { confirmAction } from '@/utils/confirmAction';
import { showAlert } from '@/utils/showAlert';
import { formatNumber as fmt } from '@/utils/formatters/currency';
import {
  useAddRebuy,
  useAddAddon,
  useBustParticipant,
  useReenterParticipant,
  useUndoBust,
  useFreeSeat,
} from '@/hooks/ops';
import type { OpsBustResult, OpsParticipant, OpsSeat, OpsTournament } from '@/types/ops';

interface OpsParticipantActionSheetProps {
  tournament: OpsTournament;
  participant: OpsParticipant | null; // null = 닫힘
  seat?: OpsSeat | null; // 좌석 컨텍스트 — TablesTab 진입 시만 전달
  onClose: () => void;
  onRequestMove?: (seat: OpsSeat) => void; // TablesTab 진입 시: 시트 닫고 기존 moveMode 재사용
  onOpenPayouts?: () => void; // ITM bust 후 상금 화면 링크(옵션)
  /**
   * 바운티 탈락자 지정 피커(eliminator picker) 후보 로스터.
   * 브리프 골격 props 엔 없지만 "생략 금지" 게이트#1(바운티 eliminator picker 이관)이
   * 후보 목록을 요구하므로 옵션 prop 으로 주입. 비바운티 경로는 참조하지 않음(기본 []).
   */
  participants?: OpsParticipant[];
}

export function OpsParticipantActionSheet({
  tournament,
  participant,
  seat,
  onClose,
  onRequestMove,
  onOpenPayouts,
  participants = [],
}: OpsParticipantActionSheetProps) {
  const tournamentId = tournament.id;

  // 바운티 대회 여부 — bountyCost 설정 시 탈락자 지정 피커 진입(현행 PlayersTab.tsx:31 이관).
  const isBountyTournament = tournament.bountyCost !== null && tournament.bountyCost !== undefined;

  const rebuyMut = useAddRebuy(tournamentId);
  const addonMut = useAddAddon(tournamentId);
  const bustMut = useBustParticipant(tournamentId);
  const reenterMut = useReenterParticipant(tournamentId);
  const undoMut = useUndoBust(tournamentId);
  const freeMut = useFreeSeat(tournamentId);

  // 바운티 대회에서 "누가 눌렀나요?" 피커 대상(=탈락 처리할 참가자). null 이면 미표시.
  const [eliminatorPickerFor, setEliminatorPickerFor] = useState<OpsParticipant | null>(null);
  // 결함①: 칩 카운트 입력 시트. SheetModal 중첩 함정 회피를 위해 부모 시트를 숨기고 띄운다(아래 visible).
  const [chipSheetOpen, setChipSheetOpen] = useState(false);

  if (!participant) return null;
  const p = participant;

  // 칩 정정 대상 = active(착석) + checked_in(대기). 대기 참가자도 등록 시 starting_chips 를 받고
  // 칩드래프트 재배치 풀(RedrawModal)에 포함되므로 정정 경로가 필요하다. busted 는 제외.
  const canEditChips = p.status === 'active' || p.status === 'checked_in';

  // bust 성공 후 우승/ITM/일반 종료 분기 안내 — 현행 PlayersTab.tsx:49-62 문구 그대로 이관(H1 동작 등가).
  const handleBustSuccess = (r: OpsBustResult) => {
    // RPC 계약: winnerFinalized=true면 v_active2=1 조건 동일로 winner 항상 non-null.
    if (r.winnerFinalized && r.winner) {
      showAlert(
        '우승 확정',
        `1위 · 상금 ${r.winner.prizeAmount !== null ? fmt(r.winner.prizeAmount) : '미설정'}`
      );
    } else {
      showAlert(
        r.prizeAmount !== null ? 'ITM 종료' : '탈락 처리 완료',
        `${r.finishPosition}위${r.prizeAmount !== null ? ` · 상금 ${fmt(r.prizeAmount)}` : ''}`
      );
    }
  };

  // 탈락 버튼 — 비-바운티는 확인 다이얼로그, 바운티는 탈락자 지정 피커 진입(현행 handleBustPress 이관).
  const handleBust = () => {
    if (!isBountyTournament) {
      confirmAction({
        title: '탈락 처리',
        message: `${p.name} 님을 탈락 처리할까요?`,
        confirmText: '탈락 처리',
        destructive: true,
        onConfirm: () => {
          bustMut.mutate({ participantId: p.id }, { onSuccess: handleBustSuccess }); // H1: 객체 vars
          onClose();
        },
      });
      return;
    }
    setEliminatorPickerFor(p);
  };

  // destructive=파괴적 액션(좌석 비우기 등) — 탈락 처리와 동일한 error 테두리·텍스트로 구분.
  const ActionBtn = ({
    label,
    onPress,
    destructive,
  }: {
    label: string;
    onPress: () => void;
    destructive?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`min-h-[44px] flex-1 items-center justify-center rounded-md active:opacity-70 ${
        destructive
          ? 'border border-error-500 dark:border-error-400'
          : 'bg-gray-100 dark:bg-gray-800'
      }`}
    >
      <Text
        className={`text-sm ${
          destructive
            ? 'font-sans-semibold text-error-600 dark:text-error-400'
            : 'text-content-primary'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );

  // ActionBtn 선언 이후에 만든다(JSX 는 즉시 평가되므로 위에서 참조하면 TDZ).
  const chipCountRow = (
    <View className="flex-row">
      <ActionBtn label="칩 카운트" onPress={() => setChipSheetOpen(true)} />
    </View>
  );

  return (
    <>
      <SheetModal
        // 네이티브에서 SheetModal=RNModal(OS 별도 윈도우)이라, 피커(=@gorhom BottomSheetModal,
        // 앱 루트 호스트)가 열린 채로 두면 피커가 이 모달 뒤로 가려져 바운티 탈락이 데드엔드가 된다.
        // 피커가 열리는 동안 시트를 숨기고(visible=false), 피커 onClose 리셋 시 자연 복귀시킨다.
        visible={!!participant && eliminatorPickerFor === null && !chipSheetOpen}
        onClose={onClose}
        title={`#${p.entryNumber ?? ''} ${p.name}`}
      >
        <View className="gap-2 p-2">
          {p.status === 'active' && (
            <>
              <View className="flex-row gap-2">
                <ActionBtn
                  label="리바이"
                  onPress={() => {
                    rebuyMut.mutate(p.id);
                    onClose();
                  }}
                />
                <ActionBtn
                  label="애드온"
                  onPress={() => {
                    addonMut.mutate(p.id);
                    onClose();
                  }}
                />
              </View>
              {/* 좌석 액션 — 좌석 컨텍스트(seat)가 있을 때만(C1). 참가 행 진입 시 자동 숨김 */}
              {seat && (
                <View className="flex-row gap-2">
                  <ActionBtn
                    label="자리 이동"
                    onPress={() => {
                      onClose();
                      onRequestMove?.(seat); // C2: 기존 moveMode 재사용
                    }}
                  />
                  <ActionBtn
                    label="좌석 비우기"
                    destructive
                    onPress={() => {
                      freeMut.mutate(seat.id); // C1: seatId — participantId 아님
                      onClose();
                    }}
                  />
                </View>
              )}
              {chipCountRow}
              {/* 파괴적 액션 격리 구역(L6) */}
              <View className="mt-2 border-t border-gray-200 pt-2 dark:border-gray-700">
                <Pressable
                  onPress={handleBust}
                  accessibilityRole="button"
                  className="min-h-[44px] items-center justify-center rounded-md border border-error-500 active:opacity-70 dark:border-error-400"
                >
                  <Text className="font-sans-semibold text-error-600 dark:text-error-400">
                    탈락 처리
                  </Text>
                </Pressable>
              </View>
            </>
          )}
          {/* 대기(checked_in) 참가자 — 기존에는 액션이 하나도 없어 시트가 비어 있었다. */}
          {p.status === 'checked_in' && chipCountRow}
          {p.status === 'busted' && (
            <View className="flex-row gap-2">
              <ActionBtn
                label="재진입"
                onPress={() => {
                  reenterMut.mutate(p.id);
                  onClose();
                }}
              />
              {/* H8: 완료 대회에서는 탈락취소 숨김 — 현행 PlayersTab.tsx:237 게이트 이관 */}
              {tournament.status === 'active' && (
                <ActionBtn
                  label="탈락 취소"
                  onPress={() =>
                    confirmAction({
                      title: '탈락 취소',
                      message: `${p.name} 님의 탈락을 취소할까요?\n칩과 좌석이 복원됩니다.`,
                      confirmText: '탈락 취소',
                      destructive: true,
                      onConfirm: () => {
                        undoMut.mutate(p.id);
                        onClose();
                      },
                    })
                  }
                />
              )}
            </View>
          )}
          {p.status === 'busted' &&
            p.prizeAmount !== null &&
            p.prizeAmount !== undefined &&
            onOpenPayouts && (
              <Pressable
                onPress={() => {
                  onClose();
                  onOpenPayouts();
                }}
                accessibilityRole="button"
                className="mt-1 items-center rounded-md border border-gold py-2 active:opacity-70"
              >
                <Text className="text-sm font-sans-semibold text-gold">상금 화면 보기 →</Text>
              </Pressable>
            )}
        </View>
      </SheetModal>

      {/*
        결함① 칩 카운트 시트. SheetModal 중첩 함정(위 visible 주석)과 같은 이유로 부모 시트를
        숨긴 채 띄운다. 닫기·저장 모두 부모까지 닫아 참가자 목록으로 복귀시킨다 — 이 시트의
        다른 액션들도 동일하게 실행 즉시 onClose() 한다(칩카운트 라운드에서 다음 참가자로 이동).
      */}
      {canEditChips && (
        <ChipCountSheet
          visible={chipSheetOpen}
          onClose={() => {
            setChipSheetOpen(false);
            onClose();
          }}
          participant={{
            id: p.id,
            name: p.name,
            entryNumber: p.entryNumber ?? null,
            chips: p.chips,
          }}
          tournamentId={tournamentId}
        />
      )}

      {/*
        바운티 탈락자 지정 피커(현행 PlayersTab.tsx:288-324 문구·인자 그대로 이관 — 생략 금지 게이트#1).
        비바운티 대회에서는 아예 마운트하지 않아(SelectBottomSheet=@gorhom 실물이 provider 없이 렌더
        불가) 비바운티 테스트가 이 시트를 건드리지 않는다.
      */}
      {isBountyTournament && (
        <SelectBottomSheet
          visible={eliminatorPickerFor !== null}
          onClose={() => setEliminatorPickerFor(null)}
          title={`${eliminatorPickerFor?.name ?? ''} 님을 누가 눌렀나요?`}
          snapPoints={['60%', '90%']}
          scrollable
          options={[
            // 🔨H3: 기본 이탈 경로를 최상단(항상 가시)
            { label: '지정 안 함', value: '' },
            ...participants
              .filter((cand) => cand.status === 'active' && cand.id !== eliminatorPickerFor?.id)
              .map((cand) => ({ label: `#${cand.entryNumber} ${cand.name}`, value: cand.id })),
          ]}
          onSelect={(value) => {
            const target = eliminatorPickerFor;
            if (!target) return;
            setEliminatorPickerFor(null);
            const eliminatorId = value === '' ? null : value;
            const eliminatorName =
              eliminatorId === null
                ? '지정 안 함'
                : (participants.find((cand) => cand.id === eliminatorId)?.name ?? '');
            // 🔨H4: 스펙 §7.2 "선택 → 확인 → bust" 확인 단계 — 즉시 mutate 금지(비가역 우승확정 대비).
            confirmAction({
              title: '탈락 처리',
              message: `${target.name} 님 탈락 · KO: ${eliminatorName}`,
              confirmText: '탈락 처리',
              destructive: true,
              onConfirm: () => {
                bustMut.mutate(
                  { participantId: target.id, eliminatorId },
                  { onSuccess: handleBustSuccess }
                );
                onClose();
              },
            });
          }}
        />
      )}
    </>
  );
}
