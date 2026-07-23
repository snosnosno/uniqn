/** 클럭 제어 시트(L1). 기존 ClockControl 을 SheetModal 로 감싼다. */
import { SheetModal } from '@/components/ui';
import { ClockControl } from './ClockControl';

interface OpsClockControlSheetProps {
  tournamentId: string;
  visible: boolean;
  onClose: () => void;
  onNavigateToLevels: () => void;
}

export function OpsClockControlSheet({
  tournamentId,
  visible,
  onClose,
  onNavigateToLevels,
}: OpsClockControlSheetProps) {
  return (
    <SheetModal visible={visible} onClose={onClose} title="클럭 제어">
      <ClockControl
        tournamentId={tournamentId}
        onNavigateToLevels={() => {
          onClose();
          onNavigateToLevels();
        }}
      />
    </SheetModal>
  );
}
