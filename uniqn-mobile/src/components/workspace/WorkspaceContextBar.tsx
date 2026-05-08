/**
 * UNIQN Mobile - WorkspaceContextBar
 *
 * @description 다중 워크스페이스 사용자에게만 표시되는 컨텍스트 바.
 *              TabHeader/StackHeader 바로 아래에 배치하여 "지금 어느 워크스페이스를
 *              보고 있는지" 시각적 단서를 제공.
 *              (Phase 1B — workspace collaboration)
 *
 *              workspaces.length <= 1 이면 자동으로 렌더하지 않아 1개 사용자에게는
 *              UI 노이즈가 없다.
 * @version 1.0.0
 */

import { View } from 'react-native';
import { useActiveWorkspace } from '@/hooks/workspace/useActiveWorkspace';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

interface WorkspaceContextBarProps {
  /** 활성 워크스페이스 변경 시 호출. 화면 데이터 invalidate 등에 사용. */
  onChange?: (workspaceId: string) => void;
}

export function WorkspaceContextBar({ onChange }: WorkspaceContextBarProps) {
  const { workspaces } = useActiveWorkspace();

  if (workspaces.length <= 1) return null;

  return (
    <View className="border-b border-secondary-200 bg-white px-2 py-1 dark:border-surface-overlay dark:bg-surface">
      <WorkspaceSwitcher onChange={onChange} />
    </View>
  );
}

export default WorkspaceContextBar;
