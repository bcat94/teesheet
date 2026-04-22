import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_KEY!;

export const supabase = createClient(url, key, {
  realtime: { params: { eventsPerSecond: 10 } },
});

export type Round = {
  id: string;
  course: string;
  date: string;
  time: string;
  organizer_name: string;
  booker_is_player: boolean;
  cancelled: boolean;
  created_at: string;
};

export type Player = {
  id: string;
  round_id: string;
  name: string;
  is_organizer: boolean;
  joined_at: string;
};

export type Message = {
  id: string;
  round_id: string;
  type: 'msg' | 'sys' | 'cancel';
  author_name: string;
  text: string;
  created_at: string;
};