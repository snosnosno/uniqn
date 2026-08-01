/**
 * PlaceSheet — 장소 선택 시트 (주문서 기본정보)
 *
 * @description 인라인 4단 모드(list → new → postcode → region). 지역 선택은 SheetModal 내부에
 * 공유 2패널 RegionTaxonomyBrowser(#254 필터와 동일 본문) 를, 주소 검색은 우편번호 위젯을
 * 인라인 렌더 — 어느 쪽도 RN Modal 을 열지 않는다(중첩 Modal iOS 터치먹통 #186/#243 회피,
 * 브리프 CRITICAL C1). 단일선택: 픽 즉시 확정·복귀. 그룹전체 슬롯 미지정 = 권역 선택 불가(필수
 * 계약). 지역은 확인 게이트 필수(2026-07-15) — 스키마 제출 게이트가 최후 방어.
 * value/onChange 는 OrderSheetFormValues(z.input) 기준 — 장소는 null 허용, 확정값은 non-null.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { ChevronLeftIcon, PlusIcon } from '@/components/icons';
import { getRegionLabel, getRegionOption } from '@/constants/regions';
import { RegionTaxonomyBrowser } from '@/components/region/RegionTaxonomyBrowser';
import { PostcodeSearch } from '@/components/address/PostcodeSearch';
import {
  pickPrimaryAddress,
  resolveRegionSlug,
  type PostcodeResult,
} from '@/utils/address/postcodeAddress';
import { useThemeStore } from '@/stores/themeStore';
import { SECONDARY_PALETTE } from '@/constants/colors';
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';

/** 폼 경계(z.input)의 장소 non-null 형태 — PostingLocation 이 아니라 폼 스키마 기준 */
export type OrderSheetLocation = NonNullable<OrderSheetFormValues['location']>;

export interface PlaceSheetProps {
  visible: boolean;
  value: OrderSheetLocation | null;
  /** 최근 장소(부모가 템플릿 location + 현재값으로 계산, 중복 제거) — Task 9 전까지 빈 배열 */
  recentLocations: OrderSheetLocation[];
  onConfirm: (next: OrderSheetLocation) => void;
  onClose: () => void;
}

/** 넓은 화면에서 인라인 패널이 과하게 길어지지 않게 하는 상한 */
const INLINE_PANEL_MAX_HEIGHT = 520;
/**
 * SheetModal 크롬(헤더 + 본문 패딩) 몫 — 인라인 패널 높이에서 미리 뺀다.
 * 시트 카드는 뷰포트의 95% 를 넘지 않는데, 패널만 0.6H 를 잡으면 저높이 뷰포트에서
 * 크롬과 합쳐 그 예산을 넘겨 하단이 잘린다(RegionFilterSheet 와 동일 계열, 2026-07-25).
 */
const SHEET_CHROME_HEIGHT = 120;
/** 이 아래로는 2-패널 탐색·주소 목록이 의미를 잃는다 — 그래도 잘리는 것보다는 낫다 */
const INLINE_PANEL_MIN_HEIGHT = 200;

type Mode = 'list' | 'new' | 'postcode' | 'region';

export function PlaceSheet({
  visible,
  value,
  recentLocations,
  onConfirm,
  onClose,
}: PlaceSheetProps) {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const { height: windowHeight } = useWindowDimensions();
  // 최초 오픈 플리커 방지: 최근 장소 유무에 따라 lazy init(effect 는 재오픈 동기화 담당)
  const [mode, setMode] = useState<Mode>(() => (recentLocations.length > 0 ? 'list' : 'new'));
  const [draft, setDraft] = useState<OrderSheetLocation>({ name: '' });
  /** 주소 검색 실패 안내(스크립트 로드 실패 등) — 조용히 아무 일도 안 일어난 것처럼 두지 않는다 */
  const [postcodeError, setPostcodeError] = useState<string | null>(null);
  /** 주소는 찾았는데 지역 자동선택이 실패한 상태 — 왜 수동 선택으로 왔는지 알려주기 위함 */
  const [regionAutoFailed, setRegionAutoFailed] = useState(false);
  /** 우편번호 DB 밖(해외·미등록 건물)·스크립트 실패용 도피구 */
  const [manualAddress, setManualAddress] = useState(false);

  // 재오픈 시 초기 모드/드래프트 동기화 — visible false→true 상승 에지에서만 수행한다.
  // ⚠️ recentLocations.length 는 rising-edge 시점에만 읽는다(상승 에지 가드): 시트가 열려 있는 동안
  // 실데이터 쿼리 해소로 recentLocations 가 0→N 전이해도 편집 중인 draft/mode 를 리셋하지 않는다
  // (Task 9 실데이터 배선이 처음 도달 가능케 한 편집 텍스트 유실 레이스 — 리뷰 Important).
  const prevVisibleRef = useRef(false);
  useEffect(() => {
    const rising = visible && !prevVisibleRef.current;
    prevVisibleRef.current = visible;
    if (rising) {
      setMode(recentLocations.length > 0 ? 'list' : 'new');
      setDraft(value ?? { name: '' });
      setPostcodeError(null);
      setRegionAutoFailed(false);
      setManualAddress(false);
    }
  }, [visible, value, recentLocations.length]);

  /**
   * 우편번호 위젯 결과 반영.
   *
   * 🔴 `address` 만 갱신하면 안 된다 — canonical 직렬화가 `district ?? address` 로 붕괴시키고
   * (serialization.ts:157, draftAdapter.ts:59·78·97 총 4곳 전부 district 우선), 기존 공고를
   * 편집할 때 draft 에는 이전 저장값에서 복원된 district 가 들어 있다. district 를 그대로 두면
   * **새로 검색한 도로명주소가 저장 시 조용히 사라진다.** 둘 다 같은 값으로 덮는다.
   */
  const handlePostcodeComplete = (result: PostcodeResult) => {
    const address = pickPrimaryAddress(result);
    const region = resolveRegionSlug(result);
    setDraft((d) => ({ ...d, address, district: address, region }));
    setPostcodeError(null);
    // 자동선택 실패를 조용히 통과시키면 사용자는 확인 버튼이 왜 안 눌리는지 모른 채 막힌다
    // (region 은 제출 필수 게이트). 이전 주소의 region 은 지운 채 수동 선택으로 보낸다.
    setRegionAutoFailed(!region);
    setMode(region ? 'new' : 'region');
  };

  const placeholderColor = isDarkMode ? SECONDARY_PALETTE[500] : SECONDARY_PALETTE[400];
  const nameTrimmed = draft.name.trim();
  const confirmDisabled = nameTrimmed.length === 0 || !draft.region; // 지역 필수(2026-07-15)
  // 브라우저는 flex-1 — SheetModal 인라인이라 명시 높이로 bound(실기기 그라운딩 대상).
  // 시트 카드 95% 예산에서 크롬을 뺀 값을 넘지 않게 조인다 — 넘으면 리스트 하단이 잘린다.
  const inlinePanelHeight = Math.max(
    INLINE_PANEL_MIN_HEIGHT,
    Math.min(
      Math.round(windowHeight * 0.6),
      INLINE_PANEL_MAX_HEIGHT,
      Math.round(windowHeight * 0.95) - SHEET_CHROME_HEIGHT
    )
  );

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title={
        mode === 'region' ? '지역 선택' : mode === 'postcode' ? '주소 검색' : '어디서 일하나요?'
      }
      footer={
        mode === 'new' ? (
          <View className="gap-2">
            {confirmDisabled ? (
              <Text className="text-center text-xs text-content-muted font-sans">
                장소명과 지역을 입력하면 확인할 수 있어요
              </Text>
            ) : null}
            <Button
              onPress={() => {
                // name 은 trim, 나머지 텍스트는 trim 후 빈 문자열이면 undefined
                // (canonical 왕복 '' / undefined 혼재 방지)
                onConfirm({
                  ...draft,
                  name: nameTrimmed,
                  address: draft.address?.trim() || undefined,
                  district: draft.district?.trim() || undefined,
                  detailedAddress: draft.detailedAddress?.trim() || undefined,
                });
                onClose();
              }}
              disabled={confirmDisabled}
            >
              확인
            </Button>
          </View>
        ) : undefined
      }
    >
      {mode === 'list' && (
        <View className="gap-2">
          {recentLocations.map((loc) => (
            <Pressable
              key={`${loc.name}:${loc.address ?? ''}`}
              onPress={() => {
                // 하위호환: region 없는 저장 장소는 조용히 통과시키지 않고 지역 완성 유도
                if (!loc.region) {
                  setDraft({ ...loc });
                  setMode('region');
                  return;
                }
                onConfirm(loc);
                onClose();
              }}
              className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 min-h-[44px] justify-center active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel={`장소 ${loc.name} 선택`}
            >
              <Text className="text-sm font-sans-medium text-content-primary">{loc.name}</Text>
              {loc.address ? (
                <Text className="text-xs text-content-muted font-sans">{loc.address}</Text>
              ) : null}
              {!loc.region ? (
                <Text className="text-xs text-content-muted font-sans">
                  지역 미지정 — 탭해서 지역을 골라주세요
                </Text>
              ) : null}
            </Pressable>
          ))}
          <Pressable
            onPress={() => setMode('new')}
            className="flex-row items-center justify-center gap-1 rounded-xl border border-dashed border-secondary-300 dark:border-surface-overlay px-4 py-3 min-h-[44px] active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="새 장소 입력"
          >
            <PlusIcon size={16} />
            <Text className="text-sm text-content-secondary font-sans">새 장소 입력</Text>
          </Pressable>
        </View>
      )}

      {mode === 'new' && (
        <View className="gap-2">
          {recentLocations.length > 0 && (
            <Pressable
              onPress={() => setMode('list')}
              className="flex-row items-center gap-1 min-h-[44px] justify-center active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel="최근 장소 목록으로 돌아가기"
            >
              <ChevronLeftIcon size={16} />
              <Text className="text-xs text-content-secondary font-sans">최근 장소에서 선택</Text>
            </Pressable>
          )}
          <TextInput
            value={draft.name}
            onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
            maxLength={50}
            placeholder="장소명 (예: 라운더스 홀덤펍)"
            placeholderTextColor={placeholderColor}
            testID="order-sheet-place-name"
            className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 text-content-primary font-sans"
          />
          {/* 주소는 검색으로 채운다 — 직접 타이핑은 오탈자·비정규 표기를 만들고 지역 자동선택도
              못 하게 한다. 다만 국내 우편번호 DB 밖(해외 공고·미등록 건물)이나 스크립트 로드
              실패에서 주소 입력 수단이 통째로 사라지면 안 되므로 직접 입력 도피구를 남긴다. */}
          {manualAddress ? (
            <TextInput
              value={draft.address ?? ''}
              onChangeText={(address) => setDraft((d) => ({ ...d, address, district: address }))}
              maxLength={200}
              placeholder="주소 직접 입력"
              placeholderTextColor={placeholderColor}
              testID="order-sheet-place-address-manual"
              className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 text-content-primary font-sans"
            />
          ) : (
            <Pressable
              onPress={() => {
                setPostcodeError(null);
                setMode('postcode');
              }}
              className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 min-h-[44px] justify-center active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel={draft.address ? `주소 ${draft.address}. 다시 검색` : '주소 검색'}
              testID="order-sheet-place-address-search"
            >
              <Text
                className={
                  draft.address
                    ? 'text-sm text-content-primary font-sans'
                    : 'text-sm text-content-muted font-sans'
                }
              >
                {draft.address ?? '주소 검색'}
              </Text>
              {draft.address ? (
                <Text className="text-xs text-content-muted font-sans">탭해서 다시 검색</Text>
              ) : null}
            </Pressable>
          )}

          {/* `status-*` 토큰은 이 레포에 없다 — 레포 관행은 error-600/dark:error-400.
              실패 안내는 "조용히 통과 금지" 설계의 유일한 사용자 피드백 채널이라
              색이 안 먹으면(다크에서 검정) 사실상 사라진다 */}
          {postcodeError ? (
            <Text className="text-xs text-error-600 dark:text-error-400 font-sans">
              {postcodeError}
            </Text>
          ) : null}

          <Pressable
            onPress={() => {
              // 정상 동작하는 수동 입력 아래에 직전 실패 문구를 남겨두지 않는다
              setPostcodeError(null);
              setManualAddress((v) => !v);
            }}
            className="min-h-[44px] justify-center active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel={
              manualAddress ? '주소 검색으로 입력' : '주소를 못 찾겠다면 직접 입력'
            }
          >
            <Text className="text-xs text-content-secondary font-sans">
              {manualAddress ? '주소 검색으로 입력' : '주소를 못 찾겠다면 직접 입력'}
            </Text>
          </Pressable>

          {/* 주소가 정해진 뒤에 상세주소를 묻는다 — 층/호만 덩그러니 남는 데이터를 막는다.
              단 **이미 값이 있으면 주소가 비어도 계속 보여준다**. 조건을 `draft.address` 하나로
              두면 ①주소를 지운 사용자에게 상세주소가 숨겨진 채 그대로 제출되고(막으려던 바로 그 형태)
              ②상세주소만 있고 주소가 없는 레거시 공고를 편집할 때 그 값이 화면에서 사라진다. */}
          {draft.address || draft.detailedAddress ? (
            <TextInput
              value={draft.detailedAddress ?? ''}
              onChangeText={(detailedAddress) => setDraft((d) => ({ ...d, detailedAddress }))}
              maxLength={200}
              placeholder="상세주소 (예: 3층 302호)"
              placeholderTextColor={placeholderColor}
              testID="order-sheet-place-detailed-address"
              className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 text-content-primary font-sans"
            />
          ) : null}

          <Pressable
            onPress={() => setMode('region')}
            className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 min-h-[44px] justify-center active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="지역 선택"
          >
            <Text className="text-sm text-content-primary font-sans">
              {draft.region ? `지역: ${getRegionLabel(draft.region) ?? draft.region}` : '지역 선택'}
            </Text>
          </Pressable>
        </View>
      )}

      {mode === 'postcode' && (
        <View className="gap-2">
          {/* dead-end 방지 — 선택 없이 새 입력으로 복귀 */}
          <Pressable
            onPress={() => setMode('new')}
            className="flex-row items-center gap-1 min-h-[44px] justify-center active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="주소 검색 취소하고 돌아가기"
          >
            <ChevronLeftIcon size={16} />
            <Text className="text-xs text-content-secondary font-sans">뒤로</Text>
          </Pressable>
          {/* 우편번호 위젯도 RN Modal 없이 인라인 — 지역 브라우저와 같은 높이 예산(#186/#243) */}
          <PostcodeSearch
            height={inlinePanelHeight}
            onComplete={handlePostcodeComplete}
            onError={(message) => {
              setPostcodeError(message);
              // 실패를 검색 화면에 가둬두면 사용자가 빠져나갈 길을 못 찾는다 — 도피구가 있는
              // 입력 화면으로 되돌린다
              setManualAddress(true);
              setMode('new');
            }}
          />
        </View>
      )}

      {mode === 'region' && (
        <View className="gap-2" style={{ height: inlinePanelHeight }}>
          {/* 지역 모드 dead-end 방지 — 선택 없이 새 입력으로 복귀 */}
          <Pressable
            onPress={() => {
              // 안내문은 이 진입에 대한 것이다 — 나가면 지운다(안 지우면 이후 사용자가 스스로
              // '지역 선택'을 눌러 들어가도 "자동으로 찾지 못했어요"가 계속 뜬다)
              setRegionAutoFailed(false);
              setMode('new');
            }}
            className="flex-row items-center gap-1 min-h-[44px] justify-center active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="지역 선택 취소하고 돌아가기"
          >
            <ChevronLeftIcon size={16} />
            <Text className="text-xs text-content-secondary font-sans">뒤로</Text>
          </Pressable>
          {/* 자동선택 실패를 조용히 넘기지 않는다 — region 은 제출 필수 게이트라
              왜 여기로 왔는지 모르면 확인 버튼이 안 눌리는 이유도 알 수 없다 */}
          {regionAutoFailed ? (
            <Text className="text-xs text-content-secondary font-sans px-1">
              주소에서 지역을 자동으로 찾지 못했어요. 직접 골라주세요.
            </Text>
          ) : null}
          {/* 필터와 동일 2패널 택소노미(#254) — 단일선택: 픽 즉시 확정·복귀. 그룹전체 슬롯
              미지정 = 권역 선택 불가(필수 계약). 중첩 Modal 금지 — 인라인 렌더(#186/#243) */}
          <RegionTaxonomyBrowser
            selectionMode="single"
            isSelected={(slug) => draft.region === slug}
            onPickSlug={(slug) => {
              setDraft((d) => ({ ...d, region: slug }));
              setRegionAutoFailed(false);
              setMode('new');
            }}
            initialGroup={draft.region ? getRegionOption(draft.region)?.group : undefined}
            searchInputTestID="order-sheet-region-search"
          />
        </View>
      )}
    </SheetModal>
  );
}
