'use client';
import { useSearchParams } from 'next/navigation';
import { BattleScreen } from '@/components/battle/BattleScreen';

export default function BattleClient() {
  const sp = useSearchParams();
  const stageId = Math.max(1, Math.min(10, Number(sp.get('stage')) || 1));
  return <BattleScreen stageId={stageId} />;
}
