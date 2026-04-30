import { createClient } from '@supabase/supabase-js';

// Always fresh against current DB state for local iteration.
export const dynamic = 'force-dynamic';

// Brand colors — keep in sync with opengraph-image.tsx.
const GREEN = '#1B5E3F';
const GREEN_DARK = '#143F2C';
const CREAM = '#F2D27A';

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
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${mStr} ${ampm}`;
}

function getStatusLine(openSpots: number, cancelled: boolean): string {
  if (cancelled) return 'Cancelled';
  if (openSpots === 0) return 'Foursome locked';
  if (openSpots === 4) return 'Open foursome · tap to claim';
  if (openSpots === 1) return '1 spot open · tap to claim';
  return `${openSpots} spots open · tap to claim`;
}

function getTitleLine(
  openSpots: number,
  cancelled: boolean,
  dayLabel: string,
  timeLabel: string
): string {
  if (cancelled) return `Cancelled — ${dayLabel} ${timeLabel}`;
  if (openSpots === 0) return `Locked in — ${dayLabel} ${timeLabel}`;
  if (openSpots === 4) return `Open foursome — ${dayLabel} ${timeLabel}`;
  if (openSpots === 1) return `1 spot open — ${dayLabel} ${timeLabel}`;
  return `${openSpots} spots open — ${dayLabel} ${timeLabel}`;
}

export default async function PreviewPage({
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

  if (!round) {
    return (
      <main style={{ padding: 40, fontFamily: 'system-ui' }}>
        <h1>Round not found</h1>
        <p>No round with id <code>{id}</code></p>
      </main>
    );
  }

  const { data: players } = await supabase
    .from('players')
    .select('name, is_organizer')
    .eq('round_id', id)
    .order('joined_at', { ascending: true });

  const claimed: Player[] = players ?? [];
  const openSpots = Math.max(0, 4 - claimed.length);
  const slots: (Player | null)[] = [
    claimed[0] ?? null,
    claimed[1] ?? null,
    claimed[2] ?? null,
    claimed[3] ?? null,
  ];

  const dayLabel = formatDate(round.date);
  const timeLabel = formatTime(round.time);
  const statusLine = getStatusLine(openSpots, round.cancelled);
  const titleLine = getTitleLine(openSpots, round.cancelled, dayLabel, timeLabel);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#F5F5F7',
        padding: '40px 20px',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
          iMessage preview
        </h1>
        <p
          style={{
            fontSize: 13,
            color: '#666',
            marginBottom: 24,
          }}
        >
          State: {claimed.length} of 4 claimed · {round.cancelled ? 'cancelled' : 'active'}
        </p>

        {/* iMessage chat frame */}
        <div
          style={{
            background: '#fff',
            borderRadius: 24,
            padding: '24px 16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          {/* Other person's bubble for context */}
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
            <div
              style={{
                background: '#E9E9EB',
                color: '#000',
                borderRadius: 18,
                padding: '8px 14px',
                fontSize: 15,
                maxWidth: '70%',
              }}
            >
              who's in for this weekend?
            </div>
          </div>

          {/* The shared round */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
            <div
              style={{
                width: 280,
                borderRadius: 18,
                overflow: 'hidden',
                background: '#fff',
                border: '0.5px solid #d2d2d7',
              }}
            >
              {/* OG image area — scaled down representation of 1200x630 */}
              <div
                style={{
                  background: round.cancelled ? GREEN_DARK : GREEN,
                  color: '#fff',
                  padding: '18px 20px 16px',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    opacity: 0.7,
                    fontWeight: 500,
                  }}
                >
                  Tee Sheet
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 500,
                    marginTop: 6,
                    lineHeight: 1.15,
                    textDecoration: round.cancelled ? 'line-through' : 'none',
                    opacity: round.cancelled ? 0.6 : 1,
                  }}
                >
                  {dayLabel} · {timeLabel}
                </div>
                <div style={{ fontSize: 14, marginTop: 2, opacity: 0.85 }}>
                  {round.course}
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
                  {slots.map((player, i) => {
                    const filled = player !== null;
                    return (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          background: filled ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                          border: filled ? 'none' : '1px dashed rgba(255,255,255,0.4)',
                          borderRadius: 6,
                          padding: '8px 6px',
                          textAlign: 'center',
                        }}
                      >
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: filled ? CREAM : 'rgba(255,255,255,0.1)',
                            color: filled ? GREEN : 'rgba(255,255,255,0.7)',
                            margin: '0 auto 4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 500,
                            fontSize: 11,
                          }}
                        >
                          {filled ? initials(player!.name) : '+'}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 500,
                            opacity: filled ? 1 : 0.7,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {filled ? player!.name.split(' ')[0] : 'Open'}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    marginTop: 12,
                    opacity: 0.85,
                    textAlign: 'center',
                  }}
                >
                  {statusLine}
                </div>
              </div>

              {/* iMessage's metadata footer */}
              <div
                style={{
                  background: '#F2F2F2',
                  padding: '8px 12px',
                  fontSize: 11,
                  color: '#666',
                }}
              >
                <div style={{ fontWeight: 500, color: '#000', fontSize: 12 }}>
                  {titleLine}
                </div>
                <div style={{ marginTop: 1 }}>
                  {round.course} · {claimed.length} of 4 in
                </div>
                <div style={{ marginTop: 1 }}>teesheet-flax.vercel.app</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ fontSize: 11, color: '#8E8E93', marginRight: 4 }}>
              Delivered
            </div>
          </div>
        </div>

        {/* Direct link to the actual generated PNG for side-by-side comparison */}
        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: '#fff',
            borderRadius: 12,
            border: '0.5px solid #d2d2d7',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
            Actual generated PNG
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#666',
              marginBottom: 12,
            }}
          >
            This is what iMessage will fetch and embed.
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/round/${id}/opengraph-image`}
            alt="OG image"
            style={{
              width: '100%',
              borderRadius: 8,
              border: '0.5px solid #d2d2d7',
              display: 'block',
            }}
          />
        </div>
      </div>
    </main>
  );
}
