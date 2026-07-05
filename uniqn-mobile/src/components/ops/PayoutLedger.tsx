/**
 * ops 1f — 페이아웃 대장(스펙 §7.1 B): 구조(useOpsPrizes) + 실지급(useOpsParticipants) 클라 조인.
 * 🔨H20: fp NOT NULL 전원 노출(prize NULL 미지급 포함 — 최초부여 진입점). corrected=amber.
 * 바운티 대회면 KO 적립 섹션. 행 탭(participantId 있는 전부) → PrizeCorrectSheet.
 */
import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useOpsPrizes, useOpsParticipants } from '@/hooks/ops';
import type { OpsTournament } from '@/types/ops';
import { buildLedgerRows, fmtKrw } from './payoutRows';
import { PrizeCorrectSheet } from './PrizeCorrectSheet';

type CorrectTarget = { id: string; name: string; prizeAmount: number | null } | null;

export function PayoutLedger({ tournament }: { tournament: OpsTournament }) {
  const { prizes, isLoading: prizesLoading } = useOpsPrizes(tournament.id);
  const { participants, isLoading: partsLoading } = useOpsParticipants(tournament.id);
  const [target, setTarget] = useState<CorrectTarget>(null);

  const ledgerRows = buildLedgerRows(prizes, participants);
  const bountyCost = tournament.bountyCost ?? null;
  const bountyRows = bountyCost !== null ? participants.filter((p) => p.knockouts > 0) : [];
  const bountyTotal = bountyRows.reduce((s, p) => s + p.knockouts * (bountyCost ?? 0), 0);

  if (prizesLoading || partsLoading) {
    return (
      <View className="items-center py-10">
        <ActivityIndicator accessibilityRole="progressbar" accessibilityLabel="로딩 중" />
      </View>
    );
  }

  return (
    <View className="gap-2 px-4 py-4">
      <Text className="text-sm font-sans-semibold text-content-primary dark:text-off-white">
        페이아웃 대장
      </Text>

      {ledgerRows.length === 0 ? (
        <Text className="py-8 text-center text-sm text-secondary-500 dark:text-secondary-400">
          아직 지급 내역이 없어요. 상금 구조를 만들거나 참가자가 확정되면 표시돼요.
        </Text>
      ) : (
        ledgerRows.map((row) => (
          <Pressable
            key={`${row.rank}-${row.participantId ?? 'none'}`}
            onPress={() =>
              row.participantId &&
              setTarget({
                id: row.participantId,
                name: row.winnerName ?? '무명',
                prizeAmount: row.paidAmount,
              })
            }
            disabled={!row.participantId}
            accessibilityRole="button"
            className={`min-h-[44px] flex-row items-center justify-between rounded-md border px-3 py-2 ${row.corrected ? 'border-amber-500 dark:border-amber-400' : 'border-gray-200 dark:border-gray-700'} ${row.participantId ? 'active:opacity-70' : ''}`}
          >
            <Text
              className={`flex-1 text-sm ${row.corrected ? 'text-amber-600 dark:text-amber-400' : 'text-content-primary'}`}
            >
              {row.rank}위 · {row.winnerName ?? '미확정'}
            </Text>
            <Text className="text-xs text-secondary-500 dark:text-secondary-400">
              구조 {row.structureAmount !== null ? fmtKrw(row.structureAmount) : '—'} · 실지급{' '}
              {row.paidAmount !== null ? fmtKrw(row.paidAmount) : '—'}
            </Text>
          </Pressable>
        ))
      )}

      {/* 바운티 적립 섹션 */}
      {bountyCost !== null && (
        <View className="mt-3 gap-2">
          <View className="h-px bg-gray-200 dark:bg-gray-700" />
          <Text className="text-sm font-sans-semibold text-content-primary dark:text-off-white">
            바운티 적립 (건당 {fmtKrw(bountyCost)}원)
          </Text>
          {bountyRows.length === 0 ? (
            <Text className="text-sm text-secondary-500 dark:text-secondary-400">
              아직 녹아웃 적립이 없어요.
            </Text>
          ) : (
            <>
              {bountyRows.map((p) => (
                <View key={p.id} className="min-h-[44px] flex-row items-center justify-between">
                  <Text className="text-sm text-content-primary dark:text-off-white">{p.name}</Text>
                  <Text className="text-xs text-secondary-500 dark:text-secondary-400">
                    KO {p.knockouts} · 적립 {fmtKrw(p.knockouts * bountyCost)}원
                  </Text>
                </View>
              ))}
              <View className="flex-row justify-between border-t border-gray-200 pt-2 dark:border-gray-700">
                <Text className="text-sm font-sans-semibold text-content-primary dark:text-off-white">
                  합계
                </Text>
                <Text className="text-sm font-sans-semibold text-content-primary dark:text-off-white">
                  {fmtKrw(bountyTotal)}원
                </Text>
              </View>
            </>
          )}
        </View>
      )}

      <PrizeCorrectSheet
        visible={target !== null}
        onClose={() => setTarget(null)}
        participant={target}
        tournamentId={tournament.id}
      />
    </View>
  );
}

export default PayoutLedger;
