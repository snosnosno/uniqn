/**
 * Firebase Admin 호환 stub (T-W4-5)
 *
 * firebase-admin 패키지 의존성을 제거하면서 기존 spec 파일의 import 경로를 유지.
 * 각 spec 파일의 seedDocument/deleteDocument 호출은 Wave 5에서 Supabase 기반으로 재작성 예정.
 *
 * TODO(T-W5): 각 spec 파일을 Supabase pre-seeded 데이터를 사용하도록 마이그레이션
 */

export async function seedDocument(
  _collection: string,
  _id: string,
  _data: Record<string, unknown>
): Promise<void> {
  console.warn(
    '[firebase-admin stub] seedDocument: Supabase 마이그레이션 미완료. ' +
      '해당 테스트는 Wave 5에서 재작성 예정.'
  );
}

export async function deleteDocument(_collection: string, _id: string): Promise<void> {
  console.warn(
    '[firebase-admin stub] deleteDocument: Supabase 마이그레이션 미완료. ' +
      '해당 테스트는 Wave 5에서 재작성 예정.'
  );
}
