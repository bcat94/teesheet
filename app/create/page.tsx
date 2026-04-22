'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const PRESET_COURSES = ['Angus North', 'Angus South', 'Braeben'];

function genId() {
  return Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase();
}

function nextSat() {
  const d = new Date();
  const dd = d.getDay();
  d.setDate(d.getDate() + ((6 - dd + 7) % 7 || 7));
  return d.toISOString().split('T')[0];
}

export default function Create() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [customCourse, setCustomCourse] = useState('');
  const [date, setDate] = useState(nextSat());
  const [time, setTime] = useState('08:00');
  const [playing, setPlaying] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const course = selectedCourse || customCourse.trim();
    if (!name.trim() || !course || !date || !time) {
      alert('Fill in all fields');
      return;
    }
    setSubmitting(true);
    const id = genId();

    const { error: roundErr } = await supabase.from('rounds').insert({
      id,
      course,
      date,
      time,
      organizer_name: name.trim(),
      booker_is_player: playing,
      cancelled: false,
    });
    if (roundErr) {
      alert('Could not save: ' + roundErr.message);
      setSubmitting(false);
      return;
    }

    if (playing) {
      await supabase.from('players').insert({
        round_id: id,
        name: name.trim(),
        is_organizer: true,
      });
    }

    // Remember "me" for this round
    try { sessionStorage.setItem('tee_me_' + id, name.trim()); } catch {}

    router.push(`/round/${id}?justCreated=1`);
  }

  return (
    <>
      <div className="bg-[var(--green)] text-white pt-13 pb-6 px-5">
        <Link href="/" className="text-white/75 text-sm pb-3 inline-block">← Back</Link>
        <h1 className="font-serif text-2xl">New Round</h1>
        <p className="text-sm opacity-65 mt-1">You&apos;re booking a tee time for 4.</p>
      </div>

      <div className="p-5">
        <Field label="Your name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Brendan"
            autoComplete="off"
            className="w-full border border-[var(--border)] rounded-[10px] py-3 px-4 text-base bg-white outline-none focus:border-[var(--green-mid)]"
          />
        </Field>

        <Field label="Course">
          <div className="flex gap-2 flex-wrap mb-2.5">
            {PRESET_COURSES.map((c) => (
              <button
                key={c}
                onClick={() => { setSelectedCourse(c); setCustomCourse(''); }}
                className={`py-2 px-4 border border-[var(--border)] rounded-full text-sm ${selectedCourse === c ? 'bg-[var(--green)] text-white border-[var(--green)]' : 'bg-white'}`}
              >
                {c}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={customCourse}
            onChange={(e) => { setCustomCourse(e.target.value); if (e.target.value.trim()) setSelectedCourse(null); }}
            placeholder="Or type a course name..."
            autoComplete="off"
            className="w-full border border-[var(--border)] rounded-[10px] py-3 px-4 text-base bg-white outline-none focus:border-[var(--green-mid)]"
          />
        </Field>

        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-[var(--border)] rounded-[10px] py-3 px-4 text-base bg-white outline-none focus:border-[var(--green-mid)]"
          />
        </Field>

        <Field label="Tee time">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full border border-[var(--border)] rounded-[10px] py-3 px-4 text-base bg-white outline-none focus:border-[var(--green-mid)]"
          />
        </Field>

        <label className="flex items-center justify-between bg-white border border-[var(--border)] rounded-xl py-3.5 px-4 mb-4 cursor-pointer gap-3">
          <div>
            <div className="text-[15px] font-medium">I&apos;m playing this round</div>
            <div className="text-xs text-[var(--muted)] mt-0.5">
              {playing ? 'You take 1 of 4 spots · 3 open for friends' : 'Just organizing · All 4 spots open for friends'}
            </div>
          </div>
          <input
            type="checkbox"
            checked={playing}
            onChange={(e) => setPlaying(e.target.checked)}
            className="appearance-none w-[50px] h-[30px] rounded-full bg-gray-300 cursor-pointer relative transition-colors flex-shrink-0 checked:bg-[var(--green)] before:content-[''] before:absolute before:w-6 before:h-6 before:rounded-full before:bg-white before:top-[3px] before:left-[3px] before:transition-all before:shadow-md checked:before:left-[23px]"
          />
        </label>

        <button
          onClick={submit}
          disabled={submitting}
          className="w-full bg-[var(--green)] text-white rounded-xl py-4 font-semibold text-base disabled:opacity-60"
        >
          {submitting ? 'Booking…' : 'Book It →'}
        </button>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">{label}</div>
      {children}
    </div>
  );
}
