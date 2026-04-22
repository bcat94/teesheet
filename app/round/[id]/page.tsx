'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase, type Round, type Player, type Message } from '@/lib/supabase';

type MeState = { name: string } | null;

export default function RoundPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const justCreated = searchParams.get('justCreated') === '1';

  const [round, setRound] = useState<Round | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [me, setMe] = useState<MeState>(null);
  const [claimingSlot, setClaimingSlot] = useState<number | null>(null);
  const [claimName, setClaimName] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [modal, setModal] = useState<null | 'edit' | 'cancel' | 'leave' | 'replace'>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [replaceName, setReplaceName] = useState('');
  const [toast, setToast] = useState('');
  const chatBoxRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  };

  const load = useCallback(async () => {
    const { data: roundData } = await supabase.from('rounds').select('*').eq('id', id).single();
    if (!roundData) { setNotFound(true); setLoading(false); return; }

    const { data: playerData } = await supabase
      .from('players').select('*').eq('round_id', id).order('joined_at');
    const { data: msgData } = await supabase
      .from('messages').select('*').eq('round_id', id).order('created_at');

    setRound(roundData);
    setPlayers(playerData || []);
    setMessages(msgData || []);
    setLoading(false);

    try {
      const stored = sessionStorage.getItem('tee_me_' + id);
      if (stored) {
        const organizerName = roundData.organizer_name;
        const inRound = (playerData || []).find(p => p.name.toLowerCase() === stored.toLowerCase());
        if (organizerName.toLowerCase() === stored.toLowerCase() || inRound) {
          setMe({ name: stored });
        } else {
          sessionStorage.removeItem('tee_me_' + id);
        }
      }
    } catch {}
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`round-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `round_id=eq.${id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') setMessages((m) => [...m, payload.new as Message]);
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `round_id=eq.${id}` },
        () => { supabase.from('players').select('*').eq('round_id', id).order('joined_at').then(({ data }) => setPlayers(data || [])); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rounds', filter: `id=eq.${id}` },
        (payload) => setRound(payload.new as Round))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  useEffect(() => {
    if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
  }, [messages]);

  if (loading) return <div className="p-16 text-center text-[var(--muted)]">Loading…</div>;
  if (notFound || !round) return (
    <div className="p-16 text-center">
      <div className="text-4xl">🤔</div>
      <p className="mt-4 text-[var(--muted)]">Round not found.</p>
      <Link href="/" className="mt-5 inline-block bg-[var(--green)] text-white rounded-xl py-3 px-6 font-semibold">Go Home</Link>
    </div>
  );

  const orgName = round.organizer_name;
  const bookerIsPlayer = round.booker_is_player;
  const isCancelled = round.cancelled;
  const taken = players.length;
  const open = 4 - taken;
  const isFull = open === 0;

  const meIsOrg = me && me.name.toLowerCase() === orgName.toLowerCase();
  const mePlayer = me ? players.find(p => p.name.toLowerCase() === me.name.toLowerCase()) : null;
  const canChat = !!me && (meIsOrg || !!mePlayer);

  const claimedNames = [orgName, ...players.map(p => p.name)]
    .filter((n, i, arr) => arr.findIndex(x => x.toLowerCase() === n.toLowerCase()) === i);

  async function claimSpot() {
    const name = claimName.trim();
    if (!name) { showToast('Enter your name'); return; }
    if (isCancelled) { showToast('Round is cancelled'); return; }
    if (players.length >= 4) { showToast("Round's full!"); return; }
    if (players.find(p => p.name.toLowerCase() === name.toLowerCase())) { showToast("You're already in!"); return; }

    const { error } = await supabase.from('players').insert({ round_id: id, name });
    if (error) { showToast('Could not save'); return; }
    await supabase.from('messages').insert({ round_id: id, type: 'sys', author_name: name, text: `✅ ${name} claimed a spot` });

    try { sessionStorage.setItem('tee_me_' + id, name); } catch {}
    setMe({ name });
    setClaimName('');
    setClaimingSlot(null);
    showToast(`${name} is in! 🎉`);
  }

  async function sendMsg() {
    if (!me || !canChat) return;
    const text = chatDraft.trim();
    if (!text) return;
    if (isCancelled) { showToast('Round is cancelled'); return; }
    await supabase.from('messages').insert({ round_id: id, type: 'msg', author_name: me.name, text });
    setChatDraft('');
  }

  async function quickMsg(kind: 'late' | 'otw' | 'here') {
    if (!me) return;
    let text = '';
    if (kind === 'late') {
      const mins = prompt('How many minutes late?', '10');
      if (mins === null) return;
      const n = parseInt(mins, 10);
      text = isNaN(n) ? `${me.name} is running late` : `${me.name} is running ~${n} min late`;
    } else if (kind === 'otw') text = `${me.name} is on the way 🚗`;
    else text = `${me.name} is here ✅`;
    await supabase.from('messages').insert({ round_id: id, type: 'sys', author_name: me.name, text });
  }

  async function saveEdit() {
    if (!me || !round) return;
    if (!editDate || !editTime) { showToast('Fill both fields'); return; }
    const oldStr = `${fmtDate(round.date)} · ${fmtTime(round.time)}`;
    const newStr = `${fmtDate(editDate)} · ${fmtTime(editTime)}`;
    if (oldStr === newStr) { setModal(null); return; }

    await supabase.from('rounds').update({ date: editDate, time: editTime }).eq('id', id);
    await supabase.from('messages').insert({
      round_id: id, type: 'sys', author_name: me.name,
      text: `${me.name} updated the tee time: ${oldStr} → ${newStr}`
    });
    setModal(null);
    showToast('Tee time updated');
  }

  async function confirmCancel() {
    if (!me) return;
    await supabase.from('rounds').update({ cancelled: true }).eq('id', id);
    await supabase.from('messages').insert({
      round_id: id, type: 'cancel', author_name: me.name, text: `❌ ${me.name} cancelled the round`
    });
    setModal(null);
    showToast('Round cancelled');
  }

  async function leaveOpen() {
    if (!mePlayer || !me) return;
    await supabase.from('players').delete().eq('id', mePlayer.id);
    await supabase.from('messages').insert({
      round_id: id, type: 'sys', author_name: me.name,
      text: `👋 ${me.name} left the round — 1 spot open`
    });
    try { sessionStorage.removeItem('tee_me_' + id); } catch {}
    setMe(null);
    setModal(null);
    showToast('You left the round');
  }

  async function doReplace() {
    const newName = replaceName.trim();
    if (!newName) { showToast("Enter a friend's name"); return; }
    if (!mePlayer || !me) return;
    if (players.find(p => p.name.toLowerCase() === newName.toLowerCase() && p.id !== mePlayer.id)) {
      showToast(`${newName} is already in`); return;
    }
    await supabase.from('players').update({ name: newName }).eq('id', mePlayer.id);
    await supabase.from('messages').insert({
      round_id: id, type: 'sys', author_name: me.name,
      text: `🔄 ${me.name} swapped out — ${newName} is in`
    });
    try { sessionStorage.removeItem('tee_me_' + id); } catch {}
    setMe(null);
    setReplaceName('');
    setModal(null);
    showToast(`${newName} is in for you`);
  }

  function shareRound() {
    if (!round) return;
    const url = window.location.origin + `/round/${id}`;
    const msg = `⛳ ${orgName} is booking a round!\n\n📍 ${round.course}\n🗓 ${fmtDate(round.date)} at ${fmtTime(round.time)}\n\nTap to claim your spot (${open} open): ${url}`;
    if (navigator.share) {
      navigator.share({ text: msg, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(msg).then(() => showToast('Copied!'));
    }
  }

  function copyLink() {
    const url = window.location.origin + `/round/${id}`;
    navigator.clipboard.writeText(url).then(() => showToast('Link copied!'));
  }

  function setMeBy(name: string) {
    try { sessionStorage.setItem('tee_me_' + id, name); } catch {}
    setMe({ name });
    showToast(`Signed in as ${name}`);
  }

  function signOut() {
    try { sessionStorage.removeItem('tee_me_' + id); } catch {}
    setMe(null);
  }

  const hdrBg = isCancelled ? 'bg-gray-500' : 'bg-[var(--green)]';

  return (
    <>
      <div className={`${hdrBg} text-white pt-14 pb-6 px-5`}>
        <Link href="/" className="text-white/75 text-sm pb-3 inline-block">← All rounds</Link>
        <h1 className="font-serif text-2xl">
          {round.course}{isCancelled && <span className="opacity-70 text-base ml-2">(cancelled)</span>}
        </h1>
        <p className="text-sm opacity-65 mt-1">{fmtDate(round.date)} · {fmtTime(round.time)}</p>
      </div>

      <div className="p-5">
        {justCreated && (
          <div className="bg-[var(--green-light)] rounded-[10px] p-3 mb-4 text-sm text-[var(--green)] font-medium">
            ✓ Round created! Share the link with your group chat below.
          </div>
        )}

        {!bookerIsPlayer && (
          <div className="bg-[var(--green-light)] rounded-[10px] py-2.5 px-3.5 mb-3.5 text-[13px] text-[var(--green)] font-medium">
            🏌️ Organized by <strong className="ml-1">{orgName}</strong>
          </div>
        )}

        {me && (
          <div className="flex items-center gap-2.5 bg-[var(--amber-bg)] rounded-[10px] py-2.5 px-3.5 mb-3.5 text-[13px] text-[var(--amber)] font-medium">
            Signed in as <strong>{me.name}</strong>
            <button onClick={signOut} className="ml-auto text-xs font-semibold underline">Switch</button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <StatCard label="Filled" value={`${taken}/4`} color="var(--green)" />
          <StatCard label="Open" value={isCancelled ? '—' : String(open)} color={isFull || isCancelled ? 'var(--muted)' : 'var(--green-mid)'} />
        </div>

        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">The foursome</div>
        <div className="flex flex-col gap-2.5">
          {renderSlots({
            round, players, me, orgName, bookerIsPlayer, isCancelled, isFull,
            claimingSlot, setClaimingSlot, claimName, setClaimName, claimSpot,
            onLeaveClick: () => setModal('leave')
          })}
        </div>

        {isCancelled && <div className="bg-[var(--red-bg)] text-[var(--red)] text-[13px] font-semibold py-2.5 px-4 rounded-[10px] text-center mt-3">❌ This round was cancelled</div>}
        {!isCancelled && isFull && <div className="bg-[#FEF3C7] text-[#92400E] text-[13px] font-semibold py-2.5 px-4 rounded-[10px] text-center mt-3">🔒 Foursome is set — all 4 spots taken!</div>}

        <div className="mt-6">
          <div className="flex items-center justify-between mb-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Round chat</div>
            <div className="text-[11px] text-[var(--muted)]">{players.length} in · live</div>
          </div>

          {!canChat ? (
            <div className="bg-white border border-[var(--border)] rounded-2xl p-4 text-center">
              <p className="text-[13px] text-[var(--muted)] mb-3">Coordinate with the foursome — who are you?</p>
              <div className="flex gap-2 flex-wrap justify-center">
                {claimedNames.map((n) => (
                  <button key={n} onClick={() => setMeBy(n)} className="py-2 px-4 border border-[var(--border)] rounded-full text-sm bg-white">
                    {n}
                  </button>
                ))}
              </div>
              <p className="mt-3.5 text-xs text-[var(--muted)]">Only players in this round can use the chat.</p>
            </div>
          ) : (
            <>
              {!isCancelled && (
                <div className="flex gap-2 overflow-x-auto pb-1 mb-3">
                  <QuickBtn onClick={() => quickMsg('late')}>⏰ Running late</QuickBtn>
                  <QuickBtn onClick={() => quickMsg('otw')}>🚗 On my way</QuickBtn>
                  <QuickBtn onClick={() => quickMsg('here')}>✅ I&apos;m here</QuickBtn>
                  {meIsOrg && <QuickBtn onClick={() => { setEditDate(round.date); setEditTime(round.time); setModal('edit'); }}>✏️ Edit time</QuickBtn>}
                  {meIsOrg && <QuickBtn onClick={() => setModal('cancel')} danger>❌ Cancel round</QuickBtn>}
                </div>
              )}

              <div ref={chatBoxRef} className="bg-white border border-[var(--border)] rounded-2xl p-3 max-h-[380px] overflow-y-auto flex flex-col gap-2">
                {messages.length === 0 ? (
                  <div className="text-center py-6 text-[var(--muted)] text-[13px]">No messages yet. Say hi 👋</div>
                ) : messages.map((m) => <MsgBubble key={m.id} msg={m} me={me!} />)}
              </div>

              {!isCancelled && (
                <div className="flex gap-2 mt-2.5 items-end">
                  <textarea
                    value={chatDraft}
                    onChange={(e) => setChatDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
                    placeholder="Message the foursome..."
                    rows={1}
                    className="flex-1 min-h-[44px] max-h-32 py-2.5 px-3.5 text-[15px] border border-[var(--border)] rounded-[22px] resize-none leading-tight bg-white outline-none focus:border-[var(--green-mid)]"
                  />
                  <button onClick={sendMsg} disabled={!chatDraft.trim()} className="bg-[var(--green)] text-white rounded-full w-11 h-11 text-xl flex-shrink-0 flex items-center justify-center disabled:bg-gray-300">↑</button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <button onClick={shareRound} className="w-full bg-[var(--blue)] text-white rounded-xl py-4 font-semibold flex items-center justify-center gap-2">
            <span className="text-lg">💬</span> Share to Group Chat
          </button>
          <button onClick={copyLink} className="w-full bg-transparent text-[var(--green)] border-[1.5px] border-[var(--green)] rounded-xl py-4 font-semibold">
            Copy Share Link
          </button>
        </div>
      </div>

      {modal === 'edit' && (
        <ModalShell onClose={() => setModal(null)}>
          <h3 className="font-serif text-lg mb-2">Edit tee time</h3>
          <p className="text-sm text-[var(--muted)] mb-4">The foursome will see this update in the chat.</p>
          <div className="flex gap-2.5 mb-3.5">
            <div className="flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">Date</div>
              <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full border border-[var(--border)] rounded-[10px] py-3 px-3 text-base bg-white outline-none" />
            </div>
            <div className="flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">Time</div>
              <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="w-full border border-[var(--border)] rounded-[10px] py-3 px-3 text-base bg-white outline-none" />
            </div>
          </div>
          <div className="flex gap-2.5">
            <button onClick={() => setModal(null)} className="flex-1 bg-transparent text-[var(--green)] border-[1.5px] border-[var(--green)] rounded-xl py-3.5 font-semibold">Cancel</button>
            <button onClick={saveEdit} className="flex-1 bg-[var(--green)] text-white rounded-xl py-3.5 font-semibold">Update →</button>
          </div>
        </ModalShell>
      )}

      {modal === 'cancel' && (
        <ModalShell onClose={() => setModal(null)}>
          <h3 className="font-serif text-lg mb-2">Cancel this round?</h3>
          <p className="text-sm text-[var(--muted)] mb-4">Everyone&apos;s spots stay visible but the round will be marked cancelled and the chat will lock. This can&apos;t be undone.</p>
          <div className="flex gap-2.5">
            <button onClick={() => setModal(null)} className="flex-1 bg-transparent text-[var(--green)] border-[1.5px] border-[var(--green)] rounded-xl py-3.5 font-semibold">Keep Round</button>
            <button onClick={confirmCancel} className="flex-1 bg-[var(--red-bg)] text-[var(--red)] rounded-xl py-3.5 font-semibold">Cancel Round</button>
          </div>
        </ModalShell>
      )}

      {modal === 'leave' && (
        <ModalShell onClose={() => setModal(null)}>
          <h3 className="font-serif text-lg mb-2">Leaving the round?</h3>
          <p className="text-sm text-[var(--muted)] mb-4">Your spot will open up. You can either let anyone grab it, or pass it directly to a friend.</p>
          <div className="flex flex-col gap-2.5">
            <button onClick={leaveOpen} className="w-full bg-[var(--green)] text-white rounded-xl py-3.5 font-semibold">Reopen for anyone</button>
            <button onClick={() => setModal('replace')} className="w-full bg-transparent text-[var(--green)] border-[1.5px] border-[var(--green)] rounded-xl py-3.5 font-semibold">Pass to a friend →</button>
            <button onClick={() => setModal(null)} className="w-full bg-transparent text-[var(--muted)] border-[1.5px] border-gray-300 rounded-xl py-3.5 font-semibold">Stay in round</button>
          </div>
        </ModalShell>
      )}

      {modal === 'replace' && (
        <ModalShell onClose={() => setModal(null)}>
          <h3 className="font-serif text-lg mb-2">Pass your spot</h3>
          <p className="text-sm text-[var(--muted)] mb-4">Who&apos;s taking your spot?</p>
          <input
            type="text"
            value={replaceName}
            onChange={(e) => setReplaceName(e.target.value)}
            placeholder="Friend's name..."
            autoFocus
            className="w-full border border-[var(--border)] rounded-[10px] py-3 px-4 text-base bg-white outline-none mb-3"
          />
          <div className="flex gap-2.5">
            <button onClick={() => { setModal('leave'); setReplaceName(''); }} className="flex-1 bg-transparent text-[var(--green)] border-[1.5px] border-[var(--green)] rounded-xl py-3.5 font-semibold">Back</button>
            <button onClick={doReplace} className="flex-1 bg-[var(--green)] text-white rounded-xl py-3.5 font-semibold">Swap in →</button>
          </div>
        </ModalShell>
      )}

      {toast && (
        <div className="fixed bottom-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white py-2.5 px-5 rounded-full text-sm z-50">
          {toast}
        </div>
      )}
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
function fmtMsgTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const same = d.toDateString() === now.toDateString();
  const hr = d.getHours(); const min = String(d.getMinutes()).padStart(2, '0');
  const t = `${hr % 12 || 12}:${min} ${hr >= 12 ? 'PM' : 'AM'}`;
  if (same) return t;
  return fmtDate(d.toISOString().split('T')[0]) + ' · ' + t;
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white border border-[var(--border)] rounded-xl py-3.5 px-4 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</div>
      <div className="text-2xl font-bold font-serif mt-1" style={{ color }}>{value}</div>
    </div>
  );
}

function QuickBtn({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex-shrink-0 bg-white border border-[var(--border)] rounded-full py-2 px-3.5 text-[13px] font-medium whitespace-nowrap ${danger ? 'text-[var(--red)]' : 'text-[var(--text)]'}`}>
      {children}
    </button>
  );
}

function MsgBubble({ msg, me }: { msg: Message; me: { name: string } }) {
  if (msg.type === 'sys' || msg.type === 'cancel') {
    const isCancel = msg.type === 'cancel';
    return (
      <div className="self-center flex flex-col items-center max-w-[92%]">
        <div className={`py-1.5 px-3 rounded-[10px] text-xs font-medium text-center ${isCancel ? 'bg-[var(--red-bg)] text-[var(--red)]' : 'bg-[var(--amber-bg)] text-[var(--amber)]'}`}>
          {msg.text}
        </div>
        <div className="text-[10px] text-[var(--muted)] mt-0.5 mx-2">{fmtMsgTime(msg.created_at)}</div>
      </div>
    );
  }
  const mine = msg.author_name.toLowerCase() === me.name.toLowerCase();
  return (
    <div className={`flex flex-col max-w-[82%] ${mine ? 'self-end items-end' : 'self-start items-start'}`}>
      {!mine && <div className="text-[11px] text-[var(--muted)] mx-2 mb-0.5 font-medium">{msg.author_name}</div>}
      <div className={`py-2.5 px-3.5 rounded-2xl text-sm leading-snug break-words ${mine ? 'bg-[var(--green-mid)] text-white rounded-br-sm' : 'bg-gray-100 text-[var(--text)] rounded-bl-sm'}`}>
        {msg.text}
      </div>
      <div className="text-[10px] text-[var(--muted)] mt-0.5 mx-2">{fmtMsgTime(msg.created_at)}</div>
    </div>
  );
}

type SlotRenderArgs = {
  round: Round; players: Player[]; me: MeState; orgName: string;
  bookerIsPlayer: boolean; isCancelled: boolean; isFull: boolean;
  claimingSlot: number | null;
  setClaimingSlot: (n: number | null) => void;
  claimName: string;
  setClaimName: (s: string) => void;
  claimSpot: () => void;
  onLeaveClick: () => void;
};

function renderSlots(args: SlotRenderArgs) {
  const { players, me, orgName, bookerIsPlayer } = args;

  if (bookerIsPlayer) {
    const friends = players.filter(p => p.name.toLowerCase() !== orgName.toLowerCase());
    const orgIsMe = me && orgName.toLowerCase() === me.name.toLowerCase();
    return [
      <div key="org" className="flex items-center gap-3 bg-[var(--green)] border border-[var(--green)] rounded-xl py-3.5 px-4 text-white">
        <div className="w-[34px] h-[34px] rounded-full bg-white/20 flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0">1</div>
        <div>
          <div className="text-[15px] font-semibold">{orgName}</div>
          <div className="text-xs opacity-65 mt-0.5">Organizer{orgIsMe ? ' · You' : ''}</div>
        </div>
      </div>,
      ...[0, 1, 2].map((i) => <Slot key={i} spotNum={i + 2} player={friends[i]} slotIdx={i} {...args} />)
    ];
  }
  return [0, 1, 2, 3].map((i) => <Slot key={i} spotNum={i + 1} player={players[i]} slotIdx={i} {...args} />);
}

function Slot({ spotNum, player, slotIdx, me, isCancelled, claimingSlot, setClaimingSlot, claimName, setClaimName, claimSpot, onLeaveClick }: SlotRenderArgs & { spotNum: number; player?: Player; slotIdx: number }) {
  if (player) {
    const isMe = me && player.name.toLowerCase() === me.name.toLowerCase();
    return (
      <div
        className={`flex items-center gap-3 rounded-xl py-3.5 px-4 bg-[var(--green-light)] border border-[var(--green-mid)]/30 ${isMe && !isCancelled ? 'border-[1.5px] border-[var(--green-mid)] cursor-pointer' : ''}`}
        onClick={isMe && !isCancelled ? onLeaveClick : undefined}
      >
        <div className="w-[34px] h-[34px] rounded-full bg-[var(--green-mid)] flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0">{spotNum}</div>
        <div>
          <div className="text-[15px] font-semibold">{player.name}</div>
          <div className="text-xs text-[var(--green-mid)] mt-0.5">{isMe ? 'You · tap to leave' : 'Confirmed ✓'}</div>
        </div>
        {isMe && !isCancelled && <div className="ml-auto text-xs text-[var(--green-mid)] font-semibold">Leave →</div>}
      </div>
    );
  }
  if (isCancelled) return (
    <div className="flex items-center gap-3 bg-white border border-[var(--border)] rounded-xl py-3.5 px-4 opacity-40">
      <div className="w-[34px] h-[34px] rounded-full bg-gray-200 flex items-center justify-center text-[13px] font-bold text-[var(--muted)]">{spotNum}</div>
      <div><div className="text-[15px] text-[var(--muted)]">Open spot</div><div className="text-xs text-[var(--muted)]">Round cancelled</div></div>
    </div>
  );
  if (claimingSlot === slotIdx) return (
    <div className="bg-white border-[1.5px] border-[var(--green-mid)] rounded-xl py-3.5 px-4 flex flex-col gap-2.5">
      <div className="text-[13px] text-[var(--muted)]">Spot {spotNum} — enter your name</div>
      <div className="flex items-center gap-2.5">
        <input
          type="text" autoFocus value={claimName}
          onChange={(e) => setClaimName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') claimSpot(); }}
          placeholder="Your name..."
          className="flex-1 border border-[var(--border)] rounded-lg py-2.5 px-3 text-[15px] bg-white outline-none focus:border-[var(--green-mid)]"
        />
        <button onClick={claimSpot} className="bg-[var(--green)] text-white rounded-lg py-2.5 px-4 text-sm font-semibold whitespace-nowrap">Join ✓</button>
      </div>
    </div>
  );
  return (
    <div onClick={() => setClaimingSlot(slotIdx)} className="flex items-center gap-3 bg-white border border-[var(--border)] rounded-xl py-3.5 px-4 cursor-pointer">
      <div className="w-[34px] h-[34px] rounded-full bg-gray-200 flex items-center justify-center text-[13px] font-bold text-[var(--muted)]">{spotNum}</div>
      <div><div className="text-[15px] font-semibold text-[var(--green)]">Tap to claim</div><div className="text-xs text-[var(--muted)] mt-0.5">Open spot</div></div>
      <div className="ml-auto text-2xl text-[var(--green-mid)] font-light leading-none">+</div>
    </div>
  );
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="fixed inset-0 bg-black/40 flex items-center justify-center z-[200] p-5">
      <div className="bg-white rounded-2xl p-5 max-w-sm w-full">{children}</div>
    </div>
  );
}