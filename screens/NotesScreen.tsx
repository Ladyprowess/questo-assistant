import React, { useMemo, useState } from 'react';
import { ICONS, COLORS } from '../constants';
import { Note } from '../types';
import { supabase } from '../services/supabase';

type Props = {
  plan: string;
  notes: Note[];
  setNotes: any;
  addAction: (t: string, i: any) => void;
  syncToCalendar: (title: string, date: string | null) => void;
};

const NotesScreen: React.FC<Props> = ({ plan, notes, setNotes, addAction, syncToCalendar }) => {
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formNote, setFormNote] = useState({ title: '', content: '', scheduled_at: '' });
  const [isLoading, setIsLoading] = useState(false);

  // Simple UI feedback (success/error)
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const isPro = useMemo(() => (plan || '').toLowerCase() === 'pro', [plan]);

  /**
   * TIMEZONE: We must format timestamps consistently using the user's timezone.
   * We try localStorage keys, then fallback to browser timezone.
   */
  const userTimeZone = useMemo(() => {
    const fromStorage =
      localStorage.getItem('timezone') ||
      localStorage.getItem('user_timezone') ||
      localStorage.getItem('selectedTimezone') ||
      localStorage.getItem('selected_time_zone') ||
      localStorage.getItem('timeZone');

    const tz = fromStorage?.trim();
    if (tz) return tz;

    // Browser fallback
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }, []);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(null), 3500);
  };

  /**
   * Format a UTC ISO date using the user timezone (not the laptop timezone).
   * This fixes “5pm shows 4pm” when the machine TZ differs from user TZ.
   */
  const formatInTz = (iso: string, withDate = true) => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '—';

      const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: userTimeZone,
        year: withDate ? 'numeric' : undefined,
        month: withDate ? 'short' : undefined,
        day: withDate ? '2-digit' : undefined,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      return fmt.format(d);
    } catch {
      return '—';
    }
  };

  const formatDateOnlyInTz = (iso: string) => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '—';

      const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: userTimeZone,
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      });

      return fmt.format(d);
    } catch {
      return '—';
    }
  };

  /**
   * Convert a datetime-local string (e.g. "2026-02-01T17:00")
   * which represents a time in userTimeZone → UTC ISO string for storage.
   *
   * Why: datetime-local has no timezone. If we store it wrongly,
   * it shifts by 1hr or more depending on the machine TZ.
   */
  const datetimeLocalToUtcIso = (datetimeLocal: string, tz: string) => {
    // If empty, just use now
    if (!datetimeLocal) return new Date().toISOString();

    // Parse local parts
    // format: YYYY-MM-DDTHH:mm
    const [datePart, timePart] = datetimeLocal.split('T');
    if (!datePart || !timePart) return new Date().toISOString();

    const [y, m, d] = datePart.split('-').map(Number);
    const [hh, mm] = timePart.split(':').map(Number);

    if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return new Date().toISOString();

    // Start with a UTC guess
    let guess = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));

    // We want: when guess is formatted in tz, it matches y-m-d hh:mm.
    // We'll adjust using the difference between desired and formatted parts.
    const getPartsInTz = (date: Date) => {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(date);

      const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
      return {
        year: get('year'),
        month: get('month'),
        day: get('day'),
        hour: get('hour'),
        minute: get('minute'),
      };
    };

    const desired = { year: y, month: m, day: d, hour: hh, minute: mm };

    // Adjust twice for stability (handles DST/timezone offsets)
    for (let i = 0; i < 2; i++) {
      const got = getPartsInTz(guess);

      // Convert both to "minutes from epoch-like" in a comparable way
      const desiredMinutes = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute) / 60000;
      const gotMinutes = Date.UTC(got.year, got.month - 1, got.day, got.hour, got.minute) / 60000;

      const diffMinutes = desiredMinutes - gotMinutes;
      if (diffMinutes === 0) break;

      guess = new Date(guess.getTime() + diffMinutes * 60000);
    }

    return guess.toISOString();
  };

  const handleSaveNote = async () => {
    if (!formNote.title.trim() || !formNote.content.trim() || isLoading) {
      if (!formNote.title.trim() || !formNote.content.trim()) {
        showToast('info', 'Please add a title and write something before saving.');
      }
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) {
        showToast('error', 'You are not signed in. Please sign in and try again.');
        return;
      }

      const noteTimeUtcIso = formNote.scheduled_at
        ? datetimeLocalToUtcIso(formNote.scheduled_at, userTimeZone)
        : new Date().toISOString();

      if (isEditing && selectedNote) {
        const { data, error } = await supabase
          .from('notes')
          .update({
            title: formNote.title,
            content: formNote.content,
            scheduled_at: noteTimeUtcIso,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedNote.id)
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setNotes((prev: Note[]) => prev.map(n => (n.id === selectedNote.id ? data : n)));
          addAction('manual_note_update', { id: selectedNote.id });
          showToast('success', 'Updated. Your note has been saved successfully.');

          // Pro-only calendar sync
          if (isPro) {
            try {
              syncToCalendar(`Note: ${formNote.title}`, noteTimeUtcIso);
            } catch {
              // don’t break the save flow
            }
          } else {
            showToast('info', 'Saved. Upgrade to Pro to sync notes to Google Calendar.');
          }
        }
      } else {
        const { data, error } = await supabase
          .from('notes')
          .insert([{
            user_id: user.id,
            title: formNote.title,
            content: formNote.content,
            scheduled_at: noteTimeUtcIso,
          }])
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setNotes((prev: Note[]) => [data, ...prev]);
          addAction('manual_note_create', { title: formNote.title });
          showToast('success', 'Saved. Your note has been added to Notes.');

          // Pro-only calendar sync
          if (isPro) {
            try {
              syncToCalendar(`Note: ${formNote.title}`, noteTimeUtcIso);
            } catch {
              // don’t break the save flow
            }
          } else {
            showToast('info', 'Saved. Upgrade to Pro to sync notes to Google Calendar.');
          }
        }
      }

      setFormNote({ title: '', content: '', scheduled_at: '' });
      setIsCreating(false);
      setIsEditing(false);
      setSelectedNote(null);
    } catch (err: any) {
      console.error(err);
      showToast('error', err?.message ? `Could not save note: ${err.message}` : 'Could not save note. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteNote = async (id: string) => {
    if (!id) return;

    try {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw error;

      setNotes((prev: Note[]) => prev.filter(n => n.id !== id));
      addAction('manual_note_delete', { id });
      setSelectedNote(null);

      showToast('success', 'Deleted. Your note has been removed.');
    } catch (err: any) {
      console.error(err);
      showToast('error', err?.message ? `Could not delete note: ${err.message}` : 'Could not delete note. Please try again.');
    }
  };

  return (
    <div className="p-6 relative min-h-full">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-0 right-0 z-[200] flex justify-center px-4">
          <div
            className={`max-w-md w-full rounded-2xl px-4 py-3 shadow-xl border text-sm font-semibold ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                : toast.type === 'info'
                ? 'bg-slate-50 text-slate-700 border-slate-100'
                : 'bg-red-50 text-red-700 border-red-100'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      <header className="flex justify-between items-end mb-8">
        <div>
          <p className="font-black uppercase tracking-widest text-[10px] mb-2" style={{ color: COLORS.primary }}>
            Cloud Intelligence
          </p>
          <h1 className="text-3xl font-black text-slate-800">Notes</h1>
        </div>

        <button
          onClick={() => {
            setIsCreating(true);
            setIsEditing(false);
            setFormNote({ title: '', content: '', scheduled_at: '' });
          }}
          className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg active:scale-95 transition-transform"
        >
          <ICONS.Plus className="w-6 h-6" />
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {notes.length > 0 ? notes.map((note) => (
          <div
            key={note.id}
            onClick={() => setSelectedNote(note)}
            className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative group cursor-pointer"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h3 className="font-bold text-slate-800 text-lg">{note.title}</h3>

                {note.scheduled_at && (
                  <p className="text-[9px] font-black uppercase text-teal-600 tracking-widest mt-0.5">
                    Ref Time: {formatInTz(note.scheduled_at, true)}
                  </p>
                )}
              </div>
            </div>

            <p className="text-slate-500 text-sm mb-4 line-clamp-3 leading-relaxed whitespace-pre-wrap">
              {note.content}
            </p>

            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
              <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">
                Synced: {formatDateOnlyInTz(note.created_at)}
              </span>
            </div>
          </div>
        )) : (
          <div className="text-center py-20 bg-slate-100 rounded-[40px] border-2 border-dashed border-slate-200">
            <p className="text-slate-400 text-sm font-medium italic">Your notes will appear here.</p>
          </div>
        )}
      </div>

      {selectedNote && !isEditing && (
        <div className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-md flex items-end animate-in fade-in duration-300 p-4">
          <div className="bg-white w-full max-w-md mx-auto rounded-[40px] p-8 pb-12 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 block">
                  Scheduled: {formatInTz(selectedNote.scheduled_at || selectedNote.created_at, true)}
                </span>
                <h2 className="text-2xl font-black text-slate-800 leading-tight">{selectedNote.title}</h2>
              </div>

              <button onClick={() => setSelectedNote(null)} className="p-2 bg-slate-100 rounded-xl">
                <ICONS.Plus className="w-4 h-4 rotate-45 text-slate-500" />
              </button>
            </div>

            <p className="text-slate-600 text-base leading-relaxed whitespace-pre-wrap mb-8">
              {selectedNote.content}
            </p>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setIsEditing(true);

                  // Convert stored UTC ISO → datetime-local string in userTimeZone (for editing)
                  // We'll generate a "YYYY-MM-DDTHH:mm" string.
                  const iso = selectedNote.scheduled_at || selectedNote.created_at;
                  let dtLocal = '';
                  try {
                    const d = new Date(iso);
                    const parts = new Intl.DateTimeFormat('en-GB', {
                      timeZone: userTimeZone,
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    }).formatToParts(d);

                    const get = (t: string) => parts.find(p => p.type === t)?.value || '';
                    const YYYY = get('year');
                    const MM = get('month');
                    const DD = get('day');
                    const HH = get('hour');
                    const MIN = get('minute');
                    dtLocal = `${YYYY}-${MM}-${DD}T${HH}:${MIN}`;
                  } catch {
                    dtLocal = '';
                  }

                  setFormNote({
                    title: selectedNote.title,
                    content: selectedNote.content,
                    scheduled_at: dtLocal,
                  });
                }}
                className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all"
              >
                Edit Note
              </button>

              <button
                onClick={() => deleteNote(selectedNote.id)}
                className="flex-1 py-4 bg-red-50 text-red-500 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {(isCreating || isEditing) && (
        <div className="fixed inset-0 z-[120] bg-slate-900/50 backdrop-blur-md flex items-end animate-in fade-in duration-300 p-4">
          <div className="bg-white w-full max-w-md mx-auto rounded-[40px] p-8 pb-12 animate-in slide-in-from-bottom duration-300 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-800">{isEditing ? 'Edit Note' : 'Record Note'}</h2>

              <button
                onClick={() => {
                  setIsCreating(false);
                  setIsEditing(false);
                }}
                className="p-2 bg-slate-100 rounded-xl"
              >
                <ICONS.Plus className="w-4 h-4 rotate-45 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Title"
                value={formNote.title}
                onChange={e => setFormNote({ ...formNote, title: e.target.value })}
                className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm focus:ring-4 focus:ring-teal-100 transition-all outline-none font-bold"
              />

              <input
                type="datetime-local"
                value={formNote.scheduled_at}
                onChange={e => setFormNote({ ...formNote, scheduled_at: e.target.value })}
                className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm focus:ring-4 focus:ring-teal-100 transition-all outline-none font-bold"
              />

              <textarea
                placeholder="Write everything down..."
                rows={5}
                value={formNote.content}
                onChange={e => setFormNote({ ...formNote, content: e.target.value })}
                className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm focus:ring-4 focus:ring-teal-100 transition-all outline-none resize-none"
              />

              <button
                onClick={handleSaveNote}
                disabled={isLoading}
                className="w-full py-4 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all flex justify-center items-center"
                style={{ backgroundColor: COLORS.primary }}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  isEditing ? 'Update & Save' : 'Save Note'
                )}
              </button>

              {/* Pro hint */}
              {!isPro && (
                <p className="text-xs text-slate-400 font-semibold text-center">
                  Upgrade to Pro to sync notes to Google Calendar and receive Google reminders.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotesScreen;
