import { useState } from 'react';
import { ConfirmDialog } from '@/components/ops/ConfirmDialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DEFAULT_BLIND_LEVELS } from '@/core/domains/ops/defaultBlindStructure';
import type { OpsBlindLevelInput } from '@/core/schemas/opsBlindLevel.schema';
import {
  useDeleteBlindPreset,
  useOpsBlindPresets,
  useSaveBlindPreset,
} from '@/hooks/ops/useBlindMutations';

const APP_PRESETS = [{ name: '기본 30레벨', levels: DEFAULT_BLIND_LEVELS as OpsBlindLevelInput[] }];

type Pending =
  | { kind: 'apply'; name: string; levels: OpsBlindLevelInput[] }
  | { kind: 'delete'; id: string; name: string };

/** 블라인드 프리셋 — 모바일 BlindPresetSheet: 앱 기본 + 내 프리셋, 적용(교체 확인)·저장·삭제(확인). */
export function BlindPresetDialog({
  open,
  onOpenChange,
  currentLevels,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentLevels: OpsBlindLevelInput[];
  onApply: (levels: OpsBlindLevelInput[], name: string) => void;
}) {
  const presets = useOpsBlindPresets();
  const save = useSaveBlindPreset();
  const remove = useDeleteBlindPreset();
  const [name, setName] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && currentLevels.length > 0 && !save.isPending;

  const row = (key: string, label: string, levels: OpsBlindLevelInput[], del?: () => void) => (
    <li key={key} className="flex items-center gap-2 border-t first:border-t-0">
      <button
        type="button"
        className="flex h-12 flex-1 items-center justify-between px-3 text-left hover:bg-muted"
        onClick={() => setPending({ kind: 'apply', name: label, levels })}
      >
        <span className="font-semibold">{label}</span>
        <span className="num text-xs text-muted-foreground">{levels.length}레벨</span>
      </button>
      {del ? (
        <Button variant="ghost" className="h-11 text-destructive" onClick={del}>
          삭제
        </Button>
      ) : null}
    </li>
  );

  return (
    <>
      <Dialog open={open && pending === null} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle>블라인드 프리셋</DialogTitle>
            <DialogDescription>
              누르면 현재 구조를 프리셋으로 교체해요(저장 전까지는 되돌릴 수 있어요).
            </DialogDescription>
          </DialogHeader>
          <ul className="flex max-h-[45dvh] flex-col overflow-auto border">
            {APP_PRESETS.map((p) => row(`app:${p.name}`, p.name, p.levels))}
            {(presets.data ?? []).map((p) =>
              row(p.id, p.name, p.levels, () =>
                setPending({ kind: 'delete', id: p.id, name: p.name })
              )
            )}
          </ul>
          <form
            className="flex items-end gap-2 border-t pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSave)
                save.mutate(
                  { name: trimmed, levels: currentLevels },
                  { onSuccess: () => setName('') }
                );
            }}
          >
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="label">현재 구조를 내 프리셋으로 저장</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="프리셋 이름"
                maxLength={60}
              />
            </label>
            <Button type="submit" className="h-10" disabled={!canSave}>
              저장
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending?.kind === 'delete' ? '프리셋 삭제' : '프리셋 적용'}
        confirmLabel={pending?.kind === 'delete' ? '삭제' : '교체'}
        onConfirm={() => {
          if (pending?.kind === 'apply') {
            onApply(pending.levels, pending.name);
            onOpenChange(false);
          } else if (pending?.kind === 'delete') {
            remove.mutate(pending.id);
          }
        }}
      >
        {pending?.kind === 'delete' ? (
          <>"{pending.name}" 프리셋을 삭제할까요?</>
        ) : (
          <>현재 블라인드 구조를 "{pending?.name}"(으)로 교체할까요? 기존 편집 내용은 사라집니다.</>
        )}
      </ConfirmDialog>
    </>
  );
}
