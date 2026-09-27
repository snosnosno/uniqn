import { useParams } from 'react-router';
import { Placeholder } from './Placeholder';

export function Component() {
  const { id, tab } = useParams();
  return (
    <Placeholder
      title="운영 콘솔"
      slice="W4~W6"
      detail={`대회 ${id ?? '-'} · 탭 ${tab ?? 'status'}`}
    />
  );
}
