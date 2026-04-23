import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };

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

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_KEY!
  );

  const [{ data: round }, { data: players }] = await Promise.all([
    supabase.from('rounds').select('*').eq('id', id).single(),
    supabase.from('players').select('*').eq('round_id', id).order('joined_at'),
  ]);

  if (!round) {
    return new ImageResponse(
      (
        <div style={{ display: 'flex', background: '#1B4332', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 60 }}>
          Tee Sheet
        </div>
      ),
      { ...size }
    );
  }

  const orgName = round.organizer_name;
  const bookerIsPlayer = round.booker_is_player;
  const allPlayers = players || [];
  const taken = allPlayers.length;
  const open = 4 - taken;
  const isCancelled = round.cancelled;

  const slots: Array<{ num: number; name: string | null; isOrg: boolean }> = [];
  if (bookerIsPlayer) {
    slots.push({ num: 1, name: orgName, isOrg: true });
    const friends = allPlayers.filter((p) => p.name.toLowerCase() !== orgName.toLowerCase());
    for (let i = 0; i < 3; i++) {
      slots.push({ num: i + 2, name: friends[i]?.name ?? null, isOrg: false });
    }
  } else {
    for (let i = 0; i < 4; i++) {
      slots.push({ num: i + 1, name: allPlayers[i]?.name ?? null, isOrg: false });
    }
  }

  return new ImageResponse(
    (
      <div style={{
        display: 'flex', flexDirection: 'column', background: '#F5F2EC',
        width: '100%', height: '100%', padding: '60px 70px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 56 }}>⛳</div>
            <div style={{ fontSize: 36, fontWeight: 600, color: '#1B4332' }}>Tee Sheet</div>
          </div>
          {isCancelled ? (
            <div style={{ display: 'flex', background: '#FEE2E2', color: '#B91C1C', padding: '10px 22px', borderRadius: 999, fontSize: 24, fontWeight: 600 }}>
              Cancelled
            </div>
          ) : open === 0 ? (
            <div style={{ display: 'flex', background: '#FEF3C7', color: '#92400E', padding: '10px 22px', borderRadius: 999, fontSize: 24, fontWeight: 600 }}>
              Foursome set
            </div>
          ) : (
            <div style={{ display: 'flex', background: '#D8F3DC', color: '#1B4332', padding: '10px 22px', borderRadius: 999, fontSize: 24, fontWeight: 600 }}>
              {open} open - tap to claim
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 40 }}>
          <div style={{ fontSize: 68, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.1, marginBottom: 10 }}>
            {round.course}
          </div>
          <div style={{ fontSize: 34, color: '#6E7179' }}>
            {fmtDate(round.date)} - {fmtTime(round.time)}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
          {slots.map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 20,
              padding: '16px 24px', borderRadius: 16,
              background: s.isOrg ? '#1B4332' : s.name ? '#D8F3DC' : '#FFFFFF',
              border: s.name ? 'none' : '2px solid #E2DDD5',
              color: s.isOrg ? '#fff' : '#1A1A1A',
            }}>
              <div style={{
                display: 'flex', width: 44, height: 44, borderRadius: 22,
                alignItems: 'center', justifyContent: 'center',
                background: s.isOrg ? 'rgba(255,255,255,0.2)' : s.name ? '#40916C' : '#EEECE8',
                color: s.isOrg || s.name ? '#fff' : '#6E7179',
                fontSize: 20, fontWeight: 700,
              }}>
                {s.num}
              </div>
              <div style={{ fontSize: 28, fontWeight: 600 }}>
                {s.name ?? 'Open spot'}
              </div>
              {s.isOrg && (
                <div style={{ marginLeft: 'auto', fontSize: 22, opacity: 0.7 }}>
                  Organizer
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
