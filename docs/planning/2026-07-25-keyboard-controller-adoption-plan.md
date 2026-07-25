# react-native-keyboard-controller 도입 계획 (2026-07-25)

> 상태: **설계 확정 대기 — 코드 미작성**
> HARD-GATE 대상(네이티브 의존성 + 3+ 파일). 승인 없이 착수 금지.
> 선행 이슈: #302 Android 키보드 모달 가림 (머지 완료, 잔여 MEDIUM 1건)

## 1. 결론

**도입 권장. 단 EAS 새 빌드 사이클에 묶어서만.**
OTA로 전달 불가한 네이티브 모듈이므로, 단독으로 진행하면 기존 빌드가 깨진다.

## 2. 왜 지금 후보로 올라왔나

#302에서 `ModalKeyboardAvoider`(의존성 0)로 30/32 표면을 해소했으나 두 가지가 남았다.

1. **잔여 MEDIUM** — `Modal position='center'` 카드는 `paddingBottom: insets.bottom`이
   없어 3버튼 내비게이션 기기에서 내비바 폭(24~48dp)만큼 과소 보정될 수 있다.
   `endCoordinates.height`가 IME−navbar 상쇄를 포함하는 성질은 bottom 시트에만 성립.
2. **애니메이션 비동기** — 현재 구현은 `keyboardDidShow`(= 키보드 표시 **완료** 후)
   시점에 `setState`로 패딩을 즉시 점프시킨다. 키보드가 올라오는 250~300ms 동안
   콘텐츠는 정지해 있다가 끝에서 한 번에 튄다. v3 룰 8(모션)·룰 32(인셋) 관점에서
   품질 상한이 낮다.

## 3. 기술 검증 결과 (2026-07-25 실측)

| 항목 | 결과 | 근거 |
|---|---|---|
| 버전 | 1.22.2 (2026-07-20 릴리스) | `npm view` |
| 유지보수 | 활발 (1.22.0/1/2가 7월에만 3회) | GitHub releases |
| peer `reanimated` | `>=3.0.0` — 우리 4.2.1 ✅ | package.json |
| New Architecture | `codegenConfig` 존재 = Fabric/TurboModule 대응 ✅ | package.json:184 |
| Expo config plugin | **없음** (`app.plugin.js` 부재) → autolinking | 패키지 tarball 실측 |
| **RN Modal 대응** | **✅ 전용 네이티브 처리 존재** | `android/src/main/java/com/reactnativekeyboardcontroller/modal/ModalAttachedWatcher.kt` |

### RN Modal 대응이 결정적 근거

`ModalAttachedWatcher.kt`는 `MODAL_SHOW_EVENT`를 가로채 `ReactModalHostView.dialog.window`의
`decorView.rootView`에 `WindowInsetsAnimationCallback`과 `OnApplyWindowInsetsListener`를
직접 부착한다. **우리가 #302에서 규명한 실패 경로(다이얼로그가 별도 윈도우라 루트의
adjustResize/KAV가 무력화됨)를 그대로 겨냥한 구현**이다. Android 12 미만에서 이벤트가
메인 윈도우로 오는 경우까지 분기 처리되어 있다(`areEventsComingFromOwnWindow`).

## 4. 영향 범위 (실측 인벤토리)

| 대상 | 파일 수 | 비고 |
|---|---|---|
| `ModalKeyboardAvoider` 소비처 | 3 | `SheetModal.tsx`, `Modal.tsx`, `OpsRegisterParticipantSheet.tsx` |
| `react-native-keyboard-aware-scroll-view` 소비처 | 3 | `SignupForm.tsx`, `BoardPostEditor.tsx`, `profile-setup.tsx` (+테스트 2) |
| `KeyboardAvoidingView` 직접 사용 | 17 | 화면 레벨(로그인/비번변경/프로필/리뷰작성 등) — **1단계에서는 건드리지 않음** |
| 루트 배선 | 1 | `app/_layout.tsx`에 `KeyboardProvider` 추가 |

`react-native-keyboard-aware-scroll-view@0.9.5`는 장기 미유지보수 패키지 —
keyboard-controller의 `KeyboardAwareScrollView`로 대체하면 **의존성 순증이 아니라 교체**가 된다.

## 5. 단계 계획

### Phase 0 — 게이트 (착수 전)
- [ ] EAS 빌드 사이클 일정 확정 (이 변경은 OTA 불가)
- [ ] Android 실기기 확보 (3버튼 내비 기기 포함 — 잔여 MEDIUM 재현 조건)

### Phase 1 — 최소 배선 + 근원 컨테이너 교체
1. `npm i react-native-keyboard-controller`
2. `app/_layout.tsx` 최상위에 `<KeyboardProvider>` 배치
3. `ModalKeyboardAvoider.tsx` 내부 구현만 keyboard-controller의 `KeyboardAvoidingView`로 교체
   — **공개 API(`ModalKeyboardAvoider` 컴포넌트명·props)는 유지**하여 소비처 3곳 무수정
4. `Modal position='center'` 잔여 MEDIUM이 자연 해소되는지 실기기 확인
5. 기존 테스트 `ModalKeyboardAvoider.test.tsx` 갱신 (라이브러리 jest mock 제공됨: `package/jest`)

### Phase 2 — keyboard-aware-scroll-view 교체
- 3개 소비처를 keyboard-controller `KeyboardAwareScrollView`로 이관
- `react-native-keyboard-aware-scroll-view` 제거

### Phase 3 (선택) — 폴리시
- `KeyboardToolbar`: 주문서 11종 시트의 다음/이전/완료 내비게이션
- `KeyboardStickyView`: 하단 CTA가 키보드 위에 고정

## 6. 리스크

| 리스크 | 심각도 | 완화 |
|---|---|---|
| **OTA 불가** — 기존 빌드에 네이티브 모듈 부재 → JS가 없는 모듈 호출 시 크래시 | 🔴 HIGH | 반드시 EAS 빌드와 동시 출시. 단독 OTA 금지. (선례: `pitfall_eas_build_stale_users_identity`) |
| 웹 빌드(CF Pages) 동작 | 🟡 MEDIUM | 웹에서 no-op/폴백 확인 필수 — `Platform.OS === 'web'` 가드 유지 검토 |
| edge-to-edge + `statusBarTranslucent` 상호작용 | 🟡 MEDIUM | Phase 1에서 실기기 실측이 유일한 검증 수단 |
| 이중 패딩 (라이브러리 + 기존 `paddingBottom`) | 🟡 MEDIUM | 교체 시 기존 수동 패딩 **제거**. 메모리 경고: "블라인드 적용 금지" |
| 앱 크기 증가 | 🟢 LOW | keyboard-aware-scroll-view 제거로 일부 상쇄 |

## 7. 검증 계획 (증거 기준)

| 주장 | 필요 증거 |
|---|---|
| 모달 키보드 회피 정상 | Android 실기기에서 **TitleSheet 재현 시나리오** 통과 스크린샷/영상 |
| center 모달 MEDIUM 해소 | **3버튼 내비 기기**에서 TemplateModal 하단 여백 실측 |
| 회귀 없음 | 전체 Jest 통과 + `npm run quality` 0에러 |
| 웹 무해 | 웹 빌드에서 로그인·비번변경 폼 키보드 동작 확인 |
| iOS 회귀 없음 | iOS 실기기에서 시트 3종 확인 |

**Red-Green**: Phase 1 적용 전후를 같은 기기·같은 화면에서 촬영해 비교. 적용 전
영상이 문제를 보여주지 못하면 그 시나리오는 검증 대상이 아니다.

## 8. 하지 않을 것

- 17개 화면 레벨 `KeyboardAvoidingView` 일괄 교체 — 현재 정상 동작 중. 문제 없는 것을 바꾸지 않는다.
- config plugin 작성 — 불필요(autolinking).
- Phase 1 검증 전 Phase 2·3 착수.

## 참조
- 원인 분석: 메모리 `android-keyboard-modal-audit`
- 현재 구현: `src/components/ui/ModalKeyboardAvoider.tsx`
- 라이브러리: https://github.com/kirillzyusko/react-native-keyboard-controller
