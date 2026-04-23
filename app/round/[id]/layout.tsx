import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';

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

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_KEY!
  );

  const { data: round } = await supabase.from('rounds').select('*').eq('id', id).single();
  const { count } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('round_id', id);

  if (!round) {
    return { title: 'Tee Sheet' };
  }

  const taken = count ?? 0;
  const open = 4 - taken;
  const dateStr = `${fmtDate(round.date)} at ${fmtTime(round.time)}`;
  const statusStr = round.cancelled
    ? 'Round cancelled'
    : open === 0
      ? 'Foursome is full'
      : `${open} open - tap to claim your spot`;

  const title = `${round.course} - ${dateStr}`;
  const description = `${round.organizer_name} booked a round. ${statusStr}`;

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

export default function RoundLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
