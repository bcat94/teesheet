'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, type Round } from '@/lib/supabase';

type RoundWithCount = Round & { player_count: number };

export default function Home() {
  const [rounds, setRounds] = useState<RoundWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const today = new Date().toISOString().split('T')[0];
    const { data: roundsData } = await supabase
      .from('rounds')
      .select('*')
      .gte('date', today)
      .order('date', { ascending: true });

    if (!roundsData) { setLoading(false); return; }

    const withCounts = await Promise.all(
      roundsData.map(async (r) => {
        const { count } = await supabase
          .from('players')
          .select('*', { count: 'exact', head: true })
          .eq('round_id', r.id);
        return { ...r, player_count: count || 0 };
      })
    );
    setRounds(withCounts);
    setLoading(false);
  }

  return (
    <>
      <div className="bg-[var(--green)] text-white pt-13 pb-6 px-5">
        <h1 className="font-serif text-2xl">⛳ Tee Sheet</h1>
        <p className="text-sm opacity-65 mt-1">Weekend golf, sorted.</p>
      </div>

      <div className="p-5">
        <Link
          href="/create"
          className="block w-full bg-[var(--green)] text-white rounded-xl py-4 text-center font-semibold"
        >
          + New Round
        </Link>

        <div className="mt-6">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">
            Upcoming rounds
          </div>

          {loading ? (
            <div className="text-center py-10 text-[var(--muted)] text-sm">Loading…</div>
          ) : rounds.length === 0 ? (
            <div className="text-center py-11 text-[var(--muted)]">
              <div className="text-4xl mb-3">🏌️</div>
              <p className="text-sm leading-relaxed">
                No rounds yet.<br />Hit New Round, then text<br />the link to your group chat.
              </p>
            </div>
          ) : (
            rounds.map((r) => (
              <Link
                key={r.id}
                href={`/round/${r.id}`}
                className={`flex items-center justify-between bg-white border border-[var(--border)] rounded-xl py-4 px-4 mb-2 ${r.cancelled ? 'opacity-55' : ''}`}
              >
                <div>
                  <div className="text-[15px] font-semibold">
                    {r.course}
                    {r.cancelled && <span className="text-[var(--red)] text-xs ml-2">· Cancelled</span>}
                  </div>
                  <div className="text-[13px] text-[var(--muted)] mt-0.5">
                    {fmtDate(r.date)} · {fmtTime(r.time)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-[var(--green-mid)]">
                    {r.player_count}/4
                  </div>
                  {!r.cancelled && (
                    <div className="text-xs text-[var(--muted)] mt-0.5">
                      {4 - r.player_count} open
                    </div>
                  )}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function fmtDate(d: string) {
  const [, m, day] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[+m - 1]} ${+day}`;
}

function fmtTime(t: string) {
  const [h, min] = t.split(':');
  const hr = +h;
  const ap = hr >= 12 ? 'PM' : 'AM';
  return `${hr % 12 || 12}:${min} ${ap}`;
}
