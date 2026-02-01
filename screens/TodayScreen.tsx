import React, { useMemo } from 'react';
import { ICONS, COLORS } from '../constants';
import { useNavigate } from 'react-router-dom';
import { Task, CalendarEvent, Note } from '../types';

interface TodayScreenProps {
  plan: string;
  tasks: Task[];
  events: CalendarEvent[];
  notes: Note[];
}

const TodayScreen: React.FC<TodayScreenProps> = ({ plan, tasks, events, notes }) => {
  const navigate = useNavigate();

  const isPro = useMemo(() => (plan || '').toLowerCase() === 'pro', [plan]);

  /**
   * Use user timezone everywhere (prevents 5pm showing as 4pm).
   * We try common localStorage keys and fallback to browser timezone.
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

    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }, []);

  const formatDateHeaderInTz = (date: Date) => {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: userTimeZone,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(date);
    } catch {
      return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    }
  };

  const formatTimeInTz = (date: Date) => {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: userTimeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(date);
    } catch {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  /**
   * For dedupe: we need a timezone-aware hour/minute from a Date.
   * This avoids collisions caused by device timezone mismatch.
   */
  const getHourMinuteInTz = (date: Date) => {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: userTimeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(date);

      const hour = parts.find(p => p.type === 'hour')?.value || '00';
      const minute = parts.find(p => p.type === 'minute')?.value || '00';
      return { hour, minute };
    } catch {
      // fallback to device time
      return {
        hour: String(date.getHours()).padStart(2, '0'),
        minute: String(date.getMinutes()).padStart(2, '0'),
      };
    }
  };

  const dateStr = useMemo(() => formatDateHeaderInTz(new Date()), [userTimeZone]);

  const ledgerMap = useMemo(() => new Map<string, any>(), []);

  const getFingerprint = (title: string, date: Date) => {
    const cleanTitle = (title || '')
      .toLowerCase()
      .replace(/^(note|task|event):\s+/i, '')
      .trim();

    const { hour, minute } = getHourMinuteInTz(date);
    return `${cleanTitle}-${hour}-${minute}`;
  };

  // Build ledger (Tasks)
  tasks
    .filter(t => t.status !== 'done')
    .forEach(t => {
      const d = t.due_at ? new Date(t.due_at) : new Date();
      ledgerMap.set(getFingerprint(t.title, d), {
        id: t.id,
        title: t.title,
        type: 'task',
        time: d,
        isSynced: false,
      });
    });

  // Notes
  notes.forEach(n => {
    const d = n.scheduled_at ? new Date(n.scheduled_at) : new Date();
    const key = getFingerprint(n.title, d);
    if (!ledgerMap.has(key)) {
      ledgerMap.set(key, {
        id: n.id,
        title: n.title,
        type: 'note',
        time: d,
        isSynced: false,
      });
    }
  });

  // Events (mark synced if matching)
  events.forEach(e => {
    const d = new Date(e.start_at);
    const key = getFingerprint(e.title, d);

    if (ledgerMap.has(key)) {
      const existing = ledgerMap.get(key);
      ledgerMap.set(key, { ...existing, isSynced: true });
    } else {
      ledgerMap.set(key, {
        id: e.id,
        title: e.title,
        type: 'event',
        time: d,
        isSynced: e.source === 'google_calendar',
      });
    }
  });

  const sortedLedger = Array.from(ledgerMap.values()).sort((a, b) => a.time.getTime() - b.time.getTime());

  // Find “most active window” in a simple way (2-hour buckets)
  const peakWindow = useMemo(() => {
    if (sortedLedger.length === 0) return null;

    const bucketCounts = new Map<string, number>();

    sortedLedger.forEach(item => {
      const { hour } = getHourMinuteInTz(item.time);
      const h = Number(hour);
      const bucketStart = Math.floor(h / 2) * 2; // 0,2,4,...22
      const key = `${bucketStart}`;
      bucketCounts.set(key, (bucketCounts.get(key) || 0) + 1);
    });

    let bestBucket: string | null = null;
    let bestCount = 0;

    bucketCounts.forEach((count, bucket) => {
      if (count > bestCount) {
        bestCount = count;
        bestBucket = bucket;
      }
    });

    if (!bestBucket) return null;

    const start = Number(bestBucket);
    const end = start + 2;

    const fmt = (h: number) => {
      const date = new Date();
      date.setHours(h, 0, 0, 0);
      return formatTimeInTz(date);
    };

    return {
      label: `${fmt(start)} - ${fmt(end)}`,
      count: bestCount,
    };
  }, [sortedLedger, userTimeZone]);

  return (
    <div className="p-6">
      <header className="mb-10 pt-4 flex justify-between items-start">
        <div>
          <p className="font-black uppercase tracking-widest text-[10px] mb-2" style={{ color: COLORS.primary }}>
            Your Day
          </p>
          <h1 className="text-4xl font-black text-slate-900 leading-none">{dateStr}</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-2">
            Times shown in: {userTimeZone}
          </p>
        </div>

        <button
          onClick={() => navigate('/app/calendar')}
          className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 active:scale-95 transition-transform"
        >
          <ICONS.Calendar className="w-5 h-5 text-teal-600" />
        </button>
      </header>

      {/* Assistant Pulse */}
      <div className="bg-slate-900 rounded-[32px] p-6 mb-10 shadow-xl relative overflow-hidden group">
        {!isPro && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-6 text-center">
            <ICONS.Lock className="w-6 h-6 text-teal-400 mb-2" />
            <p className="text-[10px] font-black uppercase text-white tracking-[0.2em] mb-1">
              AI Summary Locked
            </p>
            <button
              onClick={() => navigate('/app/paywall')}
              className="text-[8px] font-black text-teal-400 uppercase tracking-widest underline underline-offset-4"
            >
              Upgrade to Pro
            </button>
          </div>
        )}

        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
          <ICONS.Chat className="w-12 h-12 text-white" />
        </div>

        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center">
            <ICONS.Audit className="w-4 h-4 text-white" />
          </div>
          <span className="text-[10px] font-black uppercase text-teal-400 tracking-widest">Assistant Pulse</span>
        </div>

        <p className={`text-sm text-slate-300 leading-relaxed font-medium ${!isPro ? 'blur-[4px] select-none' : ''}`}>
          {sortedLedger.length > 0 ? (
            <>
              You have <span className="text-white font-bold">{sortedLedger.length} items</span> lined up today.
              {peakWindow ? (
                <> Your busiest window looks like <span className="text-white font-bold">{peakWindow.label}</span>.</>
              ) : (
                <> Your schedule is spread out across the day.</>
              )}
            </>
          ) : (
            <>Your day is clear. Add a task, note, or event to start planning.</>
          )}
        </p>
      </div>

      {/* Timeline */}
      <section>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Timeline</h3>

          <button
            onClick={() => navigate('/app/calendar')}
            className="text-[10px] font-bold text-teal-600 uppercase tracking-widest flex items-center"
          >
            Full View
            <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 pb-24">
          {sortedLedger.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="w-full flex items-center space-x-4 bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm transition-all hover:border-teal-100"
            >
              <div className="text-[10px] font-black text-slate-400 min-w-[70px] uppercase">
                {formatTimeInTz(item.time)}
              </div>

              <div
                className={`w-1 h-8 rounded-full ${
                  item.type === 'event'
                    ? 'bg-teal-500'
                    : item.type === 'task'
                    ? 'bg-orange-400'
                    : 'bg-indigo-400'
                }`}
              />

              <div className="flex-1 overflow-hidden">
                <h4 className="text-sm font-bold text-slate-800 truncate">{item.title}</h4>

                <div className="flex items-center space-x-2">
                  <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest">
                    {item.type}
                  </span>

                  {item.isSynced && (
                    <>
                      <span className="text-[8px] text-slate-300">•</span>
                      <span className="text-[8px] font-black uppercase tracking-widest text-teal-500 flex items-center">
                        <ICONS.Check className="w-2.5 h-2.5 mr-1" strokeWidth={5} /> Synchronized
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

          {sortedLedger.length === 0 && (
            <div className="py-20 text-center opacity-40 italic">Nothing scheduled for today.</div>
          )}
        </div>
      </section>
    </div>
  );
};

export default TodayScreen;
