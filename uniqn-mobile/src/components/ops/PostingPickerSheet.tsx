/**
 * ops 1e — 내 관리 공고 선택 시트.
 * 대회↔공고 연결(신규 연결/변경)에 사용하는 공용 피커. 소스는 useMyJobPostings()
 * (`enabled: !!user && !!activeWorkspace?.id` — 활성 워크스페이스 스코프)라
 * 워크스페이스가 없거나 관리 중인 공고가 없으면 비활성 안내 옵션만 노출한다
 * (DealerPickerSheet 의 "로스터 없음" 폴백과 동형 — 스코프 제약을 소비측이 흡수).
 * Task 9(대회 생성 폼 공고 picker)도 이 컴포넌트를 재사용 대상으로 삼는다(적대검증 F5 — 소유 태스크 고정).
 */
import { useMemo } from 'react';
import { SelectBottomSheet } from '@/components/ui';
import { useMyJobPostings } from '@/hooks/useJobManagement';

const NONE_VALUE = '__none';

export interface PostingPickerSheetProps {
  visible: boolean;
  onSelect: (postingId: string) => void;
  onClose: () => void;
}

export function PostingPickerSheet({ visible, onSelect, onClose }: PostingPickerSheetProps) {
  const { data: postings } = useMyJobPostings();

  const options = useMemo(() => {
    const list = postings ?? [];
    if (list.length === 0) {
      return [{ label: '관리 중인 공고가 없습니다', value: NONE_VALUE, disabled: true }];
    }
    return list.map((p) => ({ label: p.title, value: p.id }));
  }, [postings]);

  return (
    <SelectBottomSheet
      visible={visible}
      onClose={onClose}
      title="공고 선택"
      options={options}
      snapPoints={['60%', '90%']}
      scrollable
      onSelect={(value) => {
        if (value === NONE_VALUE) return;
        onSelect(value);
      }}
    />
  );
}

export default PostingPickerSheet;
