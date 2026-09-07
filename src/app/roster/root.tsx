'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { RosterList } from './RosterList';
import { CharDetail } from './CharDetail';

function Switcher() {
  const sp = useSearchParams();
  const c = Number(sp.get('c'));
  if (Number.isFinite(c) && c > 0) return <CharDetail instanceId={c} />;
  return <RosterList />;
}

export default function RosterRoot() {
  return (
    <Suspense fallback={null}>
      <Switcher />
    </Suspense>
  );
}
