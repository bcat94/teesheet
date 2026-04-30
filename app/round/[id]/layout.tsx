import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';

type Props = { params: { id: string }; children: React.ReactNode };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_KEY!
  );

  const { data: round } = await supabase
    .from('rounds')
    .select('course, date, time, cancelled')
    .eq('id', id)
    .single();

  if (!round) {
    return {
      title: 'Tee Sheet',
      description: 'Round not found',
    };
  }

  const { count: playerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('round_id', id);

  const claimed = playerCount ?? 0;
  const openSpots = Math.max(0, 4 - claimed);

  // Format the time for the title strip — short version since iMessage
  // truncates aggressively.
  const [y, m, d] = round.date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayLabel = dt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const [hStr, mStr] = round.time.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const timeLabel = `${h}:${mStr} ${ampm}`;

  // Build the title that appears under the image in iMessage.
  let title: string;
  if (round.cancelled) {
    title = `Cancelled — ${dayLabel} ${timeLabel}`;
  } else if (openSpots === 0) {
    title = `Locked in — ${dayLabel} ${timeLabel}`;
  } else if (openSpots === 4) {
    title = `Open foursome — ${dayLabel} ${timeLabel}`;
  } else if (openSpots === 1) {
    title = `1 spot open — ${dayLabel} ${timeLabel}`;
  } else {
    title = `${openSpots} spots open — ${dayLabel} ${timeLabel}`;
  }

  const description = `${round.course} · ${claimed} of 4 in`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default function RoundLayout({ children }: Props) {
  return children;
}
