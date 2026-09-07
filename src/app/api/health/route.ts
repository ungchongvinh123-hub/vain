import { NextResponse } from 'next/server';
import { dbStatus } from '@/server/session';

export async function POST() {
  const db = await dbStatus();
  return NextResponse.json({ ok: true, db, ts: Date.now() });
}
