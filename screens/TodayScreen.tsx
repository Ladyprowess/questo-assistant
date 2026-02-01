
import React from 'react';
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
  const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const ledgerMap = new Map<string, any>();

  const getFingerprint = (title: string, date: Date) => {
    const cleanTitle = title.toLowerCase().replace(/^(note|task|event):\s+/i, '').trim();
    return `${cleanTitle}-${date.getHours()}-${date.getMinutes()}`;
  };

  tasks.filter(t => t.status !== 'done').forEach(t => {
    const d = t.due_at ? new Date(t.due_at) : new Date();
    ledgerMap.set(getFingerprint(t.title, d), { id: t.id, title: t.title, type: 'task', time: d, isSynced: false });
  });

  notes.forEach(n => {
    const d = n.scheduled_at ? new Date(n.scheduled_at) : new Date();
    const key = getFingerprint(n.title, d);
    if (!ledgerMap.has(key)) ledgerMap.set(key, { id: n.id, title: n.title, type: 'note', time: d, isSynced: false });
  });

  events.forEach(e => {
    const d = new Date(e.start_at);
    const key = getFingerprint(e.title, d);
    if (ledgerMap.has(key)) {
      const existing = ledgerMap.get(key);
      ledgerMap.set(key, { ...existing, isSynced: true });
    } else {
      ledgerMap.set(key, { id: e.id, title: e.title, type: 'event', time: d, isSynced: e.source === 'google_calendar' });
    }
  });

  const sortedLedger = Array.from(ledgerMap.values()).sort((a, b) => a.time.getTime() - b.time.getTime());

  return (
    <div className="p-6">
      <header className="mb-10 pt-4 flex justify-between items-start">
        <div>
          <p className="font-black uppercase tracking-widest text-[10px] mb-2" style={{ color: COLORS.primary }}>Your Day</p>
          <h1 className="text-4xl font-black text-slate-900 leading-none">{dateStr}</h1>
        </div>
        <button onClick={() => navigate('/calendar')} className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 active:scale-95 transition-transform"><ICONS.Calendar className="w-5 h-5 text-teal-600" /></button>
      </header>

      <div className="bg-slate-900 rounded-[32px] p-6 mb-10 shadow-xl relative overflow-hidden group">
        {plan !== 'pro' && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-6 text-center">
            <ICONS.Lock className="w-6 h-6 text-teal-400 mb-2" />
            <p className="text-[10px] font-black uppercase text-white tracking-[0.2em] mb-1">AI Summary Locked</p>
            <button onClick={() => navigate('/paywall')} className="text-[8px] font-black text-teal-400 uppercase tracking-widest underline underline-offset-4">Upgrade to Pro</button>
          </div>
        )}
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><ICONS.Chat className="w-12 h-12 text-white" /></div>
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center"><ICONS.Audit className="w-4 h-4 text-white" /></div>
          <span className="text-[10px] font-black uppercase text-teal-400 tracking-widest">Assistant Pulse</span>
        </div>
        <p className={`text-sm text-slate-300 leading-relaxed font-medium ${plan !== 'pro' ? 'blur-[4px] select-none' : ''}`}>
          {sortedLedger.length > 0 ? (
            <>You have <span className="text-white font-bold">{sortedLedger.length} items</span> in your synchronized ledger today. Most activities cluster around 2:00 PM.</>
          ) : (
            <>Your schedule is clear. Use the assistant to add tasks or events.</>
          )}
        </p>
      </div>

      <section>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Timeline</h3>
          <button onClick={() => navigate('/calendar')} className="text-[10px] font-bold text-teal-600 uppercase tracking-widest flex items-center">Full View <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg></button>
        </div>
        <div className="space-y-4 pb-24">
          {sortedLedger.map((item) => (
            <div key={item.id} className="w-full flex items-center space-x-4 bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm transition-all hover:border-teal-100">
              <div className="text-[10px] font-black text-slate-400 min-w-[55px] uppercase">{item.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              <div className={`w-1 h-8 rounded-full ${item.type === 'event' ? 'bg-teal-500' : item.type === 'task' ? 'bg-orange-400' : 'bg-indigo-400'}`}></div>
              <div className="flex-1 overflow-hidden">
                <h4 className="text-sm font-bold text-slate-800 truncate">{item.title}</h4>
                <div className="flex items-center space-x-2"><span className="text-[8px] text-slate-400 font-black uppercase tracking-widest">{item.type}</span>{item.isSynced && <><span className="text-[8px] text-slate-300">•</span><span className="text-[8px] font-black uppercase tracking-widest text-teal-500 flex items-center"><ICONS.Check className="w-2.5 h-2.5 mr-1" strokeWidth={5} /> Synchronized</span></>}</div>
              </div>
            </div>
          ))}
          {sortedLedger.length === 0 && <div className="py-20 text-center opacity-40 italic">Nothing scheduled for today.</div>}
        </div>
      </section>
    </div>
  );
};

export default TodayScreen;
