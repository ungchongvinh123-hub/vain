import { Suspense } from 'react';
import BattleClient from './client';

export default function BattlePage() {
  return (
    <Suspense fallback={null}>
      <BattleClient />
    </Suspense>
  );
}
