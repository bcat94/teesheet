import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

// Runtime fix per project TODO — edge runtime was breaking with Next 16 + Turbopack
export const runtime = 'nodejs';

// Always render on demand against current DB state.
// Note: iMessage caches preview images aggressively per URL — even with this set,
// once a recipient's device has fetched the preview for round /abc123, it won't
// refetch until cache expiry. Test changes against a fresh round ID.
export const dynamic = 'force-dynamic';

export const alt = 'Tee Sheet round';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Brand colors — keep in sync with globals.css if you tweak the palette there.
const GREEN = '#1B5E3F';
const GREEN_DARK = '#143F2C';
const CREAM = '#F2D27A';
const WHITE_10 = 'rgba(255,255,255,0.10)';
const WHITE_15 = 'rgba(255,255,255,0.15)';
const WHITE_40 = 'rgba(255,255,255,0.40)';
const WHITE_70 = 'rgba(255,255,255,0.70)';
const WHITE_85 = 'rgba(255,255,255,0.85)';

type Player = { name: string; is_organizer: boolean };
type Round = {
  course: string;
  date: string;
  time: string;
  cancelled: boolean;
  organizer_name: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

function formatDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatTime(timeStr: string): string {
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr!, 10);
  const m = mStr!;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_KEY!
  );

  const { data: round } = await supabase
    .from('rounds')
    .select('course, date, time, cancelled, organizer_name')
    .eq('id', id)
    .single<Round>();

  const { data: players } = await supabase
    .from('players')
    .select('name, is_organizer')
    .eq('round_id', id)
    .order('joined_at', { ascending: true });

  if (!round) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: GREEN,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 48,
            fontWeight: 500,
          }}
        >
          Tee Sheet
        </div>
      ),
      size
    );
  }

  const claimed: Player[] = players ?? [];
  const openSpots = Math.max(0, 4 - claimed.length);
  const slots: (Player | null)[] = [
    claimed[0] ?? null,
    claimed[1] ?? null,
    claimed[2] ?? null,
    claimed[3] ?? null,
  ];

  let statusLine: string;
  if (round.cancelled) statusLine = 'Cancelled';
  else if (openSpots === 0) statusLine = 'Foursome locked';
  else if (openSpots === 4) statusLine = 'Open foursome · tap to claim';
  else if (openSpots === 1) statusLine = '1 spot open · tap to claim';
  else statusLine = `${openSpots} spots open · tap to claim`;

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: round.cancelled ? GREEN_DARK : GREEN,
          color: '#fff',
          padding: '64px 72px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            display: 'flex',
            fontSize: 22,
            letterSpacing: 4,
            textTransform: 'uppercase',
            color: WHITE_70,
            fontWeight: 500,
          }}
        >
          TEE SHEET
        </div>

        {/* Headline */}
        <div
          style={{
            display: 'flex',
            fontSize: 76,
            fontWeight: 500,
            marginTop: 16,
            lineHeight: 1.05,
            textDecoration: round.cancelled ? 'line-through' : 'none',
            opacity: round.cancelled ? 0.6 : 1,
          }}
        >
          {`${formatDate(round.date)} · ${formatTime(round.time)}`}
        </div>

        {/* Course */}
        <div
          style={{
            display: 'flex',
            fontSize: 36,
            marginTop: 8,
            color: WHITE_85,
          }}
        >
          {round.course}
        </div>

        {/* Foursome strip */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            marginTop: 56,
          }}
        >
          {slots.map((player, i) => {
            const filled = player !== null;
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flex: 1,
                  background: filled ? WHITE_15 : WHITE_10,
                  border: filled ? '2px solid transparent' : `2px dashed ${WHITE_40}`,
                  borderRadius: 16,
                  padding: '24px 16px',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    background: filled ? CREAM : WHITE_10,
                    color: filled ? GREEN : WHITE_70,
                    fontSize: 28,
                    fontWeight: 500,
                  }}
                >
                  {filled ? initials(player!.name) : '+'}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    fontSize: 22,
                    fontWeight: 500,
                    color: filled ? '#fff' : WHITE_70,
                  }}
                >
                  {filled ? player!.name.split(' ')[0] : 'Open'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Status line */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            fontSize: 28,
            color: WHITE_85,
            marginTop: 'auto',
            fontWeight: 500,
          }}
        >
          {statusLine}
        </div>
      </div>
    ),
    size
  );
}
