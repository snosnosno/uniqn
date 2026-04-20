# 고객센터 최신화 구현 계획 (2026-04-21)

> 브랜치: `master` | 스코프: FAQ 수정 + 빈 상태/에러 개선 + 첨부파일 UI
> 연관 WIP: `InquiryResponseForm.tsx` (null 방어, +5/-4) — 본 작업과 함께 커밋 예정

## 1. 배경과 목적

고객센터는 기본 CRUD는 안정화됐으나 (1) FAQ에 실제 동작과 **상충되는 문구**("탈퇴 시 복구 불가능")가 있고, (2) `report` 카테고리는 있는데 FAQ가 없으며, (3) 빈 상태가 온보딩 가치 없이 밋밋하고, (4) DB 스키마의 `attachments` JSONB 컬럼은 있는데 UI가 없어 스크린샷 첨부를 못 받는 문제가 있다.

**목표**: 사용자가 "QR 안 찍혀요" 같은 문의에 이미지 3장까지 첨부할 수 있게 하고, FAQ 내용이 실제 앱 동작과 일치하게 만들고, 빈 상태/에러가 다음 행동을 안내한다.

## 2. 스코프 (확정)

| #   | 항목                                                | 파일 수      | 난이도 |
| --- | --------------------------------------------------- | ------------ | ------ |
| A   | FAQ 회원탈퇴 문구 수정 + 신고 FAQ 1개 추가          | 1            | S      |
| B   | my-inquiries 빈 상태 CTA + inquiry/[id] 에러 재시도 | 2            | S      |
| C   | 첨부파일 UI (이미지 3장/5MB)                        | 6+1migration | M      |

**NOT in scope** (TODOS.md로 연기 또는 영구 보류):

- FAQ 동적화 (Supabase `faqs` 테이블) — FAQ 변경 빈도 낮음, YAGNI
- 관리자 대시보드 (모든 문의 검색/필터링) — 별도 admin 프로젝트
- 카테고리 확장 — 현재 6개로 충분, `report` 카테고리와 reports 시스템 중복 문제는 별건
- FAQ 빈 상태 개선 — 현재 8개 고정, 빈 상태 거의 발생 안 함
- 첨부파일 옵션 B (PDF 포함) — 실사용 95%는 스크린샷

## 3. 기존 자산 매핑

| 요구               | 이미 존재하는 것                                       |
| ------------------ | ------------------------------------------------------ |
| 이미지 선택        | `expo-image-picker ~55.0.18` 이미 설치됨               |
| 이미지 표시        | `expo-image` (프로젝트 표준)                           |
| Storage 클라이언트 | `@/lib/supabase` (`supabase.storage.from()`)           |
| 사용 예            | `src/services/auth/storageService.ts` (avatar/profile) |
| DB 컬럼            | `inquiries.attachments` JSONB (마이그레이션 불필요)    |
| 빈 상태 컴포넌트   | `@/components/ui/EmptyState`                           |
| 에러 처리          | `AppError` + `handleServiceError`                      |
| 토스트             | `toast.success()` / `toast.error()`                    |
| 로거               | `logger.info()`                                        |
| 다크모드           | `useThemeStore` + NativeWind `dark:`                   |
| Haptics            | `@/utils/haptics` (200ms throttle 내장)                |
| 스토리지 RLS 패턴  | auth 버킷 정책 참고 가능                               |

**추가 설치 불필요**.

## 4. 아키텍처 (레이어 순서대로)

### 4.1 Layer 1: Supabase Storage 버킷 + RLS (MCP `apply_migration`)

**버킷**: `inquiry-attachments` (private)

**파일 경로 규칙**: `{user_id}/{inquiry_id}/{timestamp}-{random}.{ext}`

- 사용자별 최상위 폴더 → RLS 단순화
- inquiry별 서브폴더 → 삭제/조회 용이
- random suffix → 동일 timestamp 충돌 방지

**RLS 정책 (4개)**:

```sql
-- INSERT: 본인 폴더에만 업로드
CREATE POLICY "inquiry_attachments_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'inquiry-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT: 본인 파일 또는 admin
CREATE POLICY "inquiry_attachments_select_own_or_admin"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'inquiry-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    )
  );

-- DELETE: 본인 파일만 (문의 삭제 시 cascade용, admin은 별도)
CREATE POLICY "inquiry_attachments_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'inquiry-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE: 없음 (첨부는 불변)
```

**주의**: `app_metadata.role` 사용 (MEMORY.md 주의사항 — `auth.jwt() ->> 'role'` 아님).

**용량 제한** (버킷 설정):

- `file_size_limit`: 5_242_880 (5MB)
- `allowed_mime_types`: `['image/jpeg', 'image/png', 'image/webp']`

### 4.2 Layer 2: Types / Schema (`src/types/inquiry.ts`, `src/schemas/`)

**`InquiryAttachment` 타입**:

```ts
export interface InquiryAttachment {
  path: string; // user_id/inquiry_id/timestamp-random.ext
  size: number; // bytes
  mime: string; // image/jpeg | image/png | image/webp
  uploadedAt: string; // ISO string (MEMORY.md: timestampSchema ISO 통일)
  width?: number;
  height?: number;
}
```

**`createInquirySchema` 확장**: attachments 필드는 클라이언트에서 업로드 후 추가되므로 생성 스키마에는 포함 X. 대신 `attachInquiryFilesSchema` 신설:

```ts
export const attachInquiryFilesSchema = z.object({
  inquiryId: z.string().uuid(),
  files: z
    .array(
      z.object({
        uri: z.string().url(),
        size: z.number().max(5 * 1024 * 1024, '파일 크기는 5MB 이하여야 합니다'),
        mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
        width: z.number().optional(),
        height: z.number().optional(),
      })
    )
    .max(3, '최대 3장까지 첨부 가능합니다'),
});
```

**FAQ 수정** (`src/types/inquiry.ts` 219~289):

```diff
-    id: 'faq-account-2',
-    category: 'account',
-    question: '회원 탈퇴는 어떻게 하나요?',
-    answer:
-      '프로필 > 설정 > 계정 삭제에서 탈퇴할 수 있습니다. 탈퇴 시 모든 데이터가 삭제되며 복구가 불가능합니다.',
-    order: 2,
+    id: 'faq-account-2',
+    category: 'account',
+    question: '회원 탈퇴는 어떻게 하나요?',
+    answer:
+      '프로필 > 설정 > 계정 삭제에서 탈퇴 신청을 할 수 있습니다. 신청 후 30일간의 유예 기간이 있으며, 이 기간 내에는 로그인하여 탈퇴를 철회할 수 있습니다. 30일이 지나면 모든 데이터가 완전히 삭제되며 복구가 불가능합니다.',
+    order: 2,
```

**신고 FAQ 추가** (결제 FAQ 뒤, 기술 FAQ 앞):

```ts
// 신고 문의
{
  id: 'faq-report-1',
  category: 'report',
  question: '신고는 어떻게 처리되나요?',
  answer:
    '접수된 신고는 관리자가 검토 후 운영 정책에 따라 조치됩니다. 처리 결과는 앱 내 알림으로 안내드립니다. 허위 또는 악의적인 신고로 확인될 경우 신고자에게 제재가 있을 수 있으니 신중하게 신고해주세요.',
  order: 1,
},
```

### 4.3 Layer 3: Repository (`src/repositories/inquiryRepository.ts`)

신규 메서드:

```ts
async uploadAttachments(
  userId: string,
  inquiryId: string,
  files: LocalFile[]
): Promise<InquiryAttachment[]>
```

**업로드 흐름**:

1. 각 파일을 `supabase.storage.from('inquiry-attachments').upload(path, blob)` 순차 호출
2. 모두 성공 → InquiryAttachment[] 반환
3. **실패 시 rollback**: 이미 업로드된 파일들 `remove()` 호출, 에러 throw
4. `inquiries.attachments` JSONB 업데이트는 **service 레이어**에서 트랜잭션처럼 처리

**왜 순차?** 네트워크 큐잉 단순화, 실패 파일 특정 용이. 3장이라 직렬 충분.

### 4.4 Layer 4: Service (`src/services/inquiryService.ts`)

**신규 메서드**: `attachFilesToInquiry(inquiryId: string, files: LocalFile[])`

흐름:

1. `userId` = `authService.getCurrentUserId()`
2. Zod 검증 (`attachInquiryFilesSchema`)
3. 기존 `attachments` 읽기 → 3개 제한 재검증 (동시성)
4. `repository.uploadAttachments()` 호출 → `InquiryAttachment[]` 획득
5. `repository.updateAttachments(inquiryId, [...existing, ...new])` 호출
6. 업데이트 실패 시 → Storage 파일 삭제 (rollback)
7. 성공: `logger.info('inquiry.attachments.uploaded', { inquiryId, count })`

**`createInquiry` 변경**: 기존 시그니처 유지. 첨부파일은 생성 후 별도 호출로 붙인다 (UI가 상태를 관리).

### 4.5 Layer 5: Hook (`src/hooks/useInquiry.ts`)

신규:

```ts
export function useAttachInquiryFiles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ inquiryId, files }: AttachInput) =>
      inquiryService.attachFilesToInquiry(inquiryId, files),
    onSuccess: (_, { inquiryId }) => {
      queryClient.invalidateQueries({ queryKey: ['inquiry', inquiryId] });
      queryClient.invalidateQueries({ queryKey: ['inquiries', 'mine'] });
    },
  });
}

export function useInquiryAttachmentUrl(path: string | undefined) {
  return useQuery({
    queryKey: ['inquiry-attachment-url', path],
    queryFn: () => inquiryService.getSignedUrl(path!),
    enabled: !!path,
    staleTime: 1000 * 60 * 50, // signed URL 기본 1시간 유효
  });
}
```

### 4.6 Layer 6: Components

#### 4.6.1 `src/components/support/InquiryAttachmentPicker.tsx` (신규)

**책임**: 이미지 선택 / 프리뷰 / 개별 삭제 / 3장 제한 / 용량 체크

**UI 스펙** (Impeccable 룰 준수):

```
[ + 이미지 추가 (0/3) ]   ← 룰 11: 구체 동사 라벨
──────────────────────────
[썸미1 x] [썸미2 x] [썸미3 x]  ← 80x80 썸네일, 우상단 x 버튼
  hitSlop 10 (룰 5: 44px 터치)
```

- 이미지 선택: `ImagePicker.launchImageLibraryAsync({ mediaTypes: 'Images', quality: 0.8, allowsMultipleSelection: true, selectionLimit: 3 - current.length })`
- 선택 후 각 파일에 대해:
  - 용량 체크 → 초과 시 `toast.error('이미지는 5MB 이하만 첨부 가능합니다')`
  - MIME 체크 → `image/jpeg`, `image/png`, `image/webp` 허용
- 썸네일: `expo-image` + `contentFit="cover"` + `transition={200}` (룰 18)
- 삭제 버튼: 결정적 순간 → `triggerHaptic('Light')` (룰 17)
- 다크모드 대응 필수

#### 4.6.2 `src/components/support/InquiryAttachmentGallery.tsx` (신규)

**책임**: 조회 화면에서 첨부 이미지 표시 + 풀스크린 프리뷰

- 썸네일 그리드 (최대 3장, 80x80)
- 탭 시 풀스크린 모달 (기존 `ImageViewer` 있으면 재사용, 없으면 간단한 Modal)
- Signed URL은 `useInquiryAttachmentUrl(path)` hook에서 조회
- Blurhash placeholder (룰 18) — 저장 시 선계산된 blurhash가 있으면 사용, 없으면 surface-overlay fallback

#### 4.6.3 `src/components/support/InquiryForm.tsx` (수정)

- `attachments: LocalFile[]` 상태 추가
- `InquiryAttachmentPicker` 삽입 (내용 입력 필드 아래)
- `onSubmit({ ..., attachments })` 시그니처 확장 검토 — **혹은** InquiryForm은 기존 텍스트만 제출하고, 스크린이 생성 후 attachments mutation 호출 (레이어 분리 선호)

**선택**: 폼은 데이터 입력에만 집중, 스크린이 생성→첨부 순서 오케스트레이션. 이유: 부분 실패 처리 단순화.

### 4.7 Layer 7: Screens

#### `app/(app)/support/create-inquiry.tsx` (수정) — 전체 롤백 방침

```tsx
const createMutation = useCreateInquiry();
const attachMutation = useAttachInquiryFiles();
const deleteMutation = useDeleteInquiry(); // 신규 필요 (rollback 용)

const handleSubmit = async (data, attachments) => {
  // 1. 문의 생성
  const inquiry = await createMutation.mutateAsync(data);

  // 2. 첨부가 없으면 바로 성공
  if (attachments.length === 0) {
    toast.success('문의가 접수되었어요');
    router.push(`/(app)/support/inquiry/${inquiry.id}`);
    return;
  }

  // 3. 첨부 업로드 시도
  try {
    await attachMutation.mutateAsync({ inquiryId: inquiry.id, files: attachments });
    toast.success('문의가 접수되었어요');
    router.push(`/(app)/support/inquiry/${inquiry.id}`);
  } catch (error) {
    // 4. 전체 롤백 — 문의도 삭제
    logger.warn('inquiry.attach.failed.rollback', { inquiryId: inquiry.id });
    try {
      await deleteMutation.mutateAsync(inquiry.id);
    } catch (rollbackError) {
      // 롤백 실패 — 고아 문의 남음. 로깅만 하고 사용자는 모름
      logger.error('inquiry.rollback.failed', { inquiryId: inquiry.id, rollbackError });
    }
    // 사용자에게는 명확한 실패 메시지 + 폼 상태 유지 (재시도 가능)
    toast.error('이미지 업로드에 실패했어요. 네트워크를 확인하고 다시 시도해주세요.');
    // router.push 안 함 → 사용자는 작성 중이던 폼에 그대로 머무름
  }
};
```

**폼 상태 유지**: 실패 시 사용자가 타이핑한 내용·선택한 이미지는 화면에 그대로 남아 있어야 한다. `handleSubmit`은 성공 시에만 `router.push` 호출.

#### `app/(app)/support/my-inquiries.tsx` (수정) — 빈 상태 CTA (룰 9)

```diff
- <EmptyState title="문의 내역이 없습니다" description="아직 문의하신 내역이 없습니다" />
+ <EmptyState
+   title="아직 문의한 내역이 없어요"
+   description="궁금한 점이 있으시면 언제든 문의해주세요. 영업일 기준 1~2일 내에 답변드립니다."
+   action={
+     <Button onPress={() => router.push('/(app)/support/create-inquiry')}>
+       1:1 문의하기
+     </Button>
+   }
+ />
```

#### `app/(app)/support/inquiry/[id].tsx` (수정) — 에러 재시도 (룰 10)

```diff
- <Text className="text-content-muted font-sans">문의를 찾을 수 없습니다</Text>
+ <View className="items-center gap-3 py-12">
+   <Text className="text-h4 text-content-primary">문의를 불러오지 못했어요</Text>
+   <Text className="text-body text-content-secondary text-center">
+     일시적인 네트워크 문제일 수 있어요. 잠시 후 다시 시도해주세요.
+   </Text>
+   <View className="flex-row gap-3 mt-2">
+     <Button variant="outline" onPress={() => router.back()}>목록으로</Button>
+     <Button onPress={() => refetch()}>다시 시도</Button>
+   </View>
+ </View>
```

또한: 상세 화면에 `InquiryAttachmentGallery` 삽입 (내용 텍스트 아래).

## 5. 다이어그램 — 데이터 플로우

```
사용자                InquiryForm              Screen                 Service              Repository            Supabase
  |                       |                      |                      |                     |                      |
  |--이미지 선택---------->|                      |                      |                     |                      |
  |                       |--로컬 files 배열------|                      |                     |                      |
  |--"문의하기" 탭--------->|                      |                      |                     |                      |
  |                       |--onSubmit(data, files)>|                     |                     |                      |
  |                       |                      |--createInquiry(data)->|                     |                      |
  |                       |                      |                      |---insert inquiry----|--------------------->|
  |                       |                      |<--inquiry.id--------|                     |                      |
  |                       |                      |--attachFiles(id, files)>|                  |                      |
  |                       |                      |                      |--upload each--------|---PUT bucket-------->|
  |                       |                      |                      |                     |<---path---(3회 반복)-|
  |                       |                      |                      |--updateAttachments->|---UPDATE jsonb------>|
  |                       |                      |<--success-----------|                     |                      |
  |<--toast + 상세 이동----|                      |                      |                     |                      |
```

## 6. 리스크 & 완화

| #    | 리스크                                         | 발생 시 영향                             | 완화                                                                                                  |
| ---- | ---------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| R1   | **RLS 정책 실수 → 타인 첨부 조회**             | 프라이버시 침해                          | Storage 정책 작성 후 **다른 계정 JWT로 cross-user SELECT 수동 테스트 필수**                           |
| R2   | 업로드 부분 실패 (3개 중 2개)                  | 성공 파일이 DB에 안 들어갔으니 고아 파일 | **전체 롤백 정책**: 실패 시 이미 업로드된 파일 `remove()` + 문의 DELETE                               |
| R3   | createInquiry 성공 / attach 실패               | 텍스트만 저장된 상태                     | **전체 롤백** — 문의 삭제 후 폼 상태 유지, 사용자 재시도. 롤백 실패 시 고아 문의 남지만 로깅으로 추적 |
| R3.1 | 롤백 DELETE 자체 실패                          | 고아 문의 DB 잔존                        | `logger.error`로 추적, admin이 주기적 정리 또는 사용자가 my-inquiries에서 수동 삭제                   |
| R3.2 | `useDeleteInquiry` hook 미존재                 | 구현 필요                                | Repository/Service/Hook 레이어에 `deleteInquiry(id)` 추가 (본인 문의 + status=open 만 허용)           |
| R4   | `allowed_mime_types` 미설정 → 이상 파일 업로드 | Storage 비용·악성 파일                   | 버킷 옵션 강제 + 클라이언트 MIME 체크 이중 방어                                                       |
| R5   | signed URL 만료 (1시간)                        | 상세 화면에서 이미지 깨짐                | `staleTime: 50분` → 자동 refetch                                                                      |
| R6   | blurhash 선계산 미포함                         | 로딩 시 빈 박스                          | Phase 1은 surface-overlay fallback만. blurhash는 별도 티켓(룰 18 완전 적용은 향후)                    |
| R7   | RLS `app_metadata` 잘못된 경로 사용            | admin이 조회 못함                        | `(auth.jwt() -> 'app_metadata' ->> 'role')` 명시 (MEMORY.md 주의사항 준수)                            |
| R8   | 파일명에 PII 노출                              | 경로가 스크린샷에 찍힘                   | timestamp + random 사용, 원본 파일명 미사용                                                           |
| R9   | `expo-image-picker` 권한 거부                  | 선택 불가                                | `requestMediaLibraryPermissionsAsync()` 체크 + 거부 시 "설정에서 사진 접근 허용해주세요" 토스트       |
| R10  | 대용량 이미지 메모리                           | OOM 크래시                               | `quality: 0.8` + 5MB 클라이언트 체크                                                                  |

## 7. 테스트 계획

### 7.1 단위 테스트 (Jest)

| 파일                                        | 케이스                                                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `__tests__/schemas/inquiry.test.ts`         | `attachInquiryFilesSchema` — 4장 거부, 6MB 거부, text/plain 거부, 정상 3장 통과                 |
| `__tests__/services/inquiryService.test.ts` | `attachFilesToInquiry` — 모두 성공 / 2개 성공 1개 실패 / DB 업데이트 실패 시 rollback 호출 확인 |
| `__tests__/types/inquiry.test.ts`           | FAQ_DATA에 `faq-report-1` 존재, `faq-account-2`가 "30일" 포함 확인                              |

### 7.2 수동 QA (실기기)

**A. FAQ**

- [ ] `/support/faq` 진입 → 신고 카테고리 선택 → "신고는 어떻게 처리되나요?" 노출
- [ ] 계정 카테고리 "회원 탈퇴" → 30일 유예 기간 문구 노출
- [ ] 나머지 6개 FAQ 변경 없음 확인

**B. 빈 상태**

- [ ] 문의 없는 계정으로 `my-inquiries` 진입 → 제목/설명/CTA 노출 → CTA 탭 → `create-inquiry` 이동
- [ ] inquiry 상세 URL에 없는 UUID 넣어 진입 → "다시 시도" + "목록으로" 버튼 노출

**C. 첨부파일**

- [ ] 권한 없는 상태 → 이미지 추가 탭 → 권한 요청 다이얼로그
- [ ] 권한 거부 → 적절한 토스트
- [ ] 1장 선택 → 썸네일 표시 → "2/3" 카운터
- [ ] 3장 선택 → "이미지 추가" 버튼 비활성화
- [ ] 6MB 이미지 선택 → 에러 토스트
- [ ] 삭제 버튼(x) 탭 → Light haptic + 프리뷰 제거
- [ ] 문의 작성 제출 → 로딩 → 성공 토스트 → 상세 이동 → 첨부 이미지 3장 표시
- [ ] **롤백 시나리오**: Storage RLS를 임시로 끊고 업로드 실패 유발 → 에러 토스트 + 폼 유지 + my-inquiries에 해당 문의 없음 확인 (전체 롤백 성공)
- [ ] 롤백 중 DELETE도 실패하는 극단 케이스 → `logger.error` 로그 + 사용자에게는 여전히 에러 토스트만
- [ ] 다른 계정 로그인 → 상세 URL 직접 접근 시도 → 접근 불가 (404 또는 unauthorized)
- [ ] 오프라인에서 제출 → 텍스트 저장은 실패, 적절한 에러
- [ ] 다크모드 + 라이트모드 모두 확인

**D. 연관 리그레션**

- [ ] 기존 문의 (첨부 없는) 조회 시 빈 gallery가 공백으로 안보이게 (attachments 빈 배열/null 방어)
- [ ] `InquiryResponseForm.tsx` WIP 수정과 충돌 없이 동작

### 7.3 Red-Green 검증 (회원탈퇴 FAQ)

1. Test: `FAQ_DATA.find(f => f.id === 'faq-account-2').answer` includes `'30일'` → expect true
2. Revert FAQ change → test FAIL
3. Restore → test PASS

## 8. 단계별 구현 순서

| #   | 단계                                       | 파일                                                        | TDD 가능          | 소요 |
| --- | ------------------------------------------ | ----------------------------------------------------------- | ----------------- | ---- |
| 1   | FAQ 수정 + 신고 FAQ 추가 + 단위 테스트     | `src/types/inquiry.ts`, `__tests__/types/inquiry.test.ts`   | ✅                | 15분 |
| 2   | 빈 상태 CTA + 에러 재시도                  | `my-inquiries.tsx`, `inquiry/[id].tsx`                      | ⚠️ 수동 QA 위주   | 25분 |
| 3   | Storage 버킷 + RLS (MCP `apply_migration`) | 마이그레이션 1개                                            | ❌ 수동 검증      | 30분 |
| 4   | 스키마 + 타입 정의                         | `src/types/inquiry.ts`, `src/schemas/inquiry.ts`            | ✅                | 15분 |
| 5   | Repository upload/rollback + deleteInquiry | `inquiryRepository.ts`                                      | ✅ (mocking 가능) | 40분 |
| 6   | Service + hook (attach + delete)           | `inquiryService.ts`, `useInquiry.ts`                        | ✅                | 40분 |
| 7   | AttachmentPicker + Gallery 컴포넌트        | 2개 신규                                                    | ⚠️ 스냅샷 + 수동  | 60분 |
| 8   | 폼/스크린 통합                             | `InquiryForm.tsx`, `create-inquiry.tsx`, `inquiry/[id].tsx` | ❌ 수동 QA        | 30분 |
| 9   | 수동 QA 7.2 전체 + 리그레션                | -                                                           | -                 | 45분 |
| 10  | 커밋 (InquiryResponseForm WIP 포함)        | git                                                         | -                 | 10분 |

**예상 총 소요 (CC)**: ~4시간. 인간 팀이면 1.5~2일.

## 9. 검증 체크리스트 (완료 조건)

```
[ ] npm run quality 통과 (tsc + eslint + prettier)
[ ] npm test 통과 (신규 테스트 포함)
[ ] 수동 QA 7.2 A/B/C/D 전부 체크
[ ] cross-user Storage 조회 시도 거부 확인 (R1)
[ ] admin 계정으로 조회 가능 확인 (R7)
[ ] 다크모드 + 라이트모드 스크린샷 (이전/이후)
[ ] InquiryResponseForm.tsx WIP null 방어 정상 동작
[ ] 커밋 메시지: feat(support): 고객센터 FAQ 최신화 + 빈 상태 CTA + 이미지 첨부
```

## 10. TODOS.md 추가 (연기 항목)

```md
- [ ] FAQ 동적화 (Supabase `faqs` 테이블) — 빈도 낮으므로 3개월 관찰 후 결정
- [ ] 관리자 전용 문의 검색/필터 대시보드
- [ ] 첨부파일 blurhash 선계산 (업로드 시 32x32 축소 → blurhash npm)
- [ ] 첨부파일 PDF 지원 (옵션 B로 확장 필요 시)
- [ ] `report` 카테고리와 reports 시스템 중복 정리 방향 결정
```

## 11. 결정 로그

| #    | 결정                                | 이유                                                         | 원칙                    |
| ---- | ----------------------------------- | ------------------------------------------------------------ | ----------------------- |
| D1   | 첨부는 이미지만                     | 실사용 95% 스크린샷, PDF는 생기면 추가                       | P3 pragmatic            |
| D2   | 3장/5MB 상한                        | 1:1 문의 성격상 충분, 악용 방지                              | P5 explicit             |
| D3   | createInquiry와 attach 분리         | 오케스트레이션 유연성, 롤백 가능                             | P5 explicit             |
| D3.1 | **첨부 실패 시 전체 롤백** (atomic) | 고아 파일/혼란스런 부분 성공 방지, 사용자 명확한 재시도 경로 | 사용자 결정 (T1 대안)   |
| D4   | 순차 업로드                         | 3장이라 병렬 이득 미미, 디버깅 쉬움                          | P3 pragmatic            |
| D5   | FAQ 동적화 안 함                    | 변경 빈도 낮음, YAGNI                                        | P4 DRY                  |
| D6   | 신고 FAQ 보수 버전                  | 우회법 학습 방지                                             | 사용자 결정             |
| D7   | Storage path = user_id 최상위       | RLS 단순화                                                   | P5 explicit             |
| D8   | signed URL staleTime 50분           | 1시간 TTL - 10분 여유                                        | P3 pragmatic            |
| D9   | blurhash Phase 2로 분리             | 현 스코프 폭발 방지                                          | P2 boil lake but scoped |
| D10  | InquiryResponseForm WIP 함께 커밋   | 논리적 연관성, 작은 변경                                     | P3 pragmatic            |

## 12. Impeccable 룰 적용 요약

| 룰                    | 적용 위치                                                  |
| --------------------- | ---------------------------------------------------------- |
| v1 #5 터치 44px       | AttachmentPicker 삭제 버튼 `hitSlop={10}` + 24px 시각 크기 |
| v1 #9 빈 상태 온보딩  | my-inquiries + inquiry 에러 케이스                         |
| v1 #10 에러 공식      | inquiry/[id].tsx 재시도 ("무엇 + 왜 + 어떻게")             |
| v1 #11 구체 동사      | "1:1 문의하기", "다시 시도", "이미지 추가"                 |
| v2 #17 Haptics        | 첨부 삭제 Light, 문의 성공 Success                         |
| v2 #18 blurhash       | Phase 1은 surface-overlay fallback (완전 적용은 후속)      |
| v2 #20 Keyboard       | 기존 `KeyboardAvoidingView` 유지                           |
| v2 #21 Pressed 역방향 | Button 컴포넌트 기본 동작 유지                             |
| v2 #26 Truncation     | 첨부 파일명 표시 안 함 → 이슈 무관                         |

---

## 승인 게이트

이 계획으로 진행할지 사용자 결정 필요. 승인 시 단계 1부터 순서대로 실행.

- **A) 승인** — 단계 1부터 진행
- **B) 부분 승인** — 특정 단계만 (예: A+B만, C는 다음 스프린트)
- **C) 수정** — 계획 자체 재검토
- **D) 거절** — 다른 접근
