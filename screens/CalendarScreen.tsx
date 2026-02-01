
import React, { useState } from 'react';
import { ICONS, COLORS } from '../constants';
import { CalendarEvent } from '../types';

interface CalendarScreenProps {
  events: CalendarEvent[];
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  addAction: (t: string, i: any) => void;
}

const CalendarScreen: React.FC<CalendarScreenProps> = ({ events, setEvents, addAction }) => {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', start_at: '', end_at: '', location: '' });

  // Deduplicate events for display (Title + Time fingerprint)
  const eventMap = new Map<string, any>();
  events.forEach(e => {
    const d = new Date(e.start_at);
    const key = `${e.title.toLowerCase().trim()}-${d.getHours()}-${d.getMinutes()}`;
    if (eventMap.has(key)) {
      const existing = eventMap.get(key);
      // Prefer Google source for the status if there's a collision
      if (e.source === 'google_calendar') {
        eventMap.set(key, { ...e, isSynced: true });
      } else {
        eventMap.set(key, { ...existing, isSynced: true });
      }
    } else {
      eventMap.set(key, { ...e, isSynced: e.source === 'google_calendar' });
    }
  });
  const dedupedEvents = Array.from(eventMap.values()).sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  const handleManualCreate = () => {
    if (!newEvent.title || !newEvent.start_at) return;
    const event: CalendarEvent = {
      id: Date.now().toString(),
      user_id: 'u1',
      title: newEvent.title,
      description: 'Manually scheduled by user.',
      start_at: new Date(newEvent.start_at).toISOString(),
      end_at: new Date(newEvent.end_at || Date.now() + 3600000).toISOString(),
      location: newEvent.location,
      attendees: [],
      source: 'internal',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setEvents(prev => [event, ...prev]);
    addAction('manual_event_create', { title: newEvent.title });
    setIsCreating(false);
    setNewEvent({ title: '', start_at: '', end_at: '', location: '' });
  };

  return (
    <div className="p-6 relative min-h-full">
      <header className="flex justify-between items-end mb-8">
        <div>
          <div className="flex items-center space-x-2 mb-1">
             <p className="text-teal-600 font-bold uppercase tracking-widest text-[10px]">Your Schedule</p>
          </div>
          <h1 className="text-3xl font-black text-slate-800">Calendar</h1>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg active:scale-95 transition-transform"
        >
          <ICONS.Plus className="w-6 h-6" />
        </button>
      </header>

      {/* AI Daily Pulse card */}
      <div className="mb-8 p-6 bg-white border border-slate-100 rounded-[32px] shadow-sm flex items-center space-x-4">
        <div className="w-12 h-12 bg-teal-50 rounded-2xl flex items-center justify-center text-teal-600 shrink-0">
          <ICONS.Calendar className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">AI Daily Pulse</p>
          <p className="text-xs text-slate-700 font-bold leading-relaxed">
            Your most active period today is <span className="text-teal-600 underline">2:00 PM - 4:00 PM</span>. You have {dedupedEvents.length} items currently logged.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <section>
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 ml-2">All Events</h3>
          <div className="space-y-3">
            {dedupedEvents.map((event) => (
              <div key={event.id} onClick={() => setSelectedEvent(event)} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-start space-x-4 group hover:border-teal-200 transition-colors cursor-pointer relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                  <ICONS.Calendar className="w-8 h-8" />
                </div>
                <div className="flex flex-col items-center justify-center min-w-[50px] py-1 border-r border-slate-100 pr-4">
                  <span className="text-xs font-bold text-slate-800">{new Date(event.start_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                  <div className="w-1 h-8 bg-teal-100 rounded-full my-1"></div>
                  <span className="text-[10px] text-slate-400 uppercase font-black text-[8px]">Event</span>
                </div>
                <div className="flex-1 text-left">
                  <h4 className="font-bold text-slate-800 text-sm group-hover:text-teal-600 transition-colors">{event.title}</h4>
                  <div className="flex items-center space-x-2 mt-1">
                    <p className="text-xs text-slate-400 line-clamp-1">{event.location || 'Meeting'}</p>
                    {event.isSynced && (
                      <span className="bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest">G-Sync</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {dedupedEvents.length === 0 && (
              <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                <p className="text-slate-400 text-sm italic font-medium">Your calendar is clear.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {isCreating && (
        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-md flex items-end animate-in fade-in duration-300 p-4">
          <div className="bg-white w-full max-w-md mx-auto rounded-[40px] p-8 pb-12 animate-in slide-in-from-bottom duration-300 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-800">Schedule Event</h2>
              <button onClick={() => setIsCreating(false)} className="p-2 bg-slate-100 rounded-xl"><ICONS.Plus className="w-4 h-4 rotate-45 text-slate-500" /></button>
            </div>
            <div className="space-y-4">
              <input type="text" placeholder="Event Title" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm focus:ring-4 focus:ring-teal-100 outline-none font-bold" />
              <div className="grid grid-cols-2 gap-3">
                <input type="datetime-local" value={newEvent.start_at} onChange={e => setNewEvent({...newEvent, start_at: e.target.value})} className="bg-slate-50 border-none rounded-2xl py-4 px-4 text-xs focus:ring-4 focus:ring-teal-100 outline-none font-bold" />
                <input type="datetime-local" value={newEvent.end_at} onChange={e => setNewEvent({...newEvent, end_at: e.target.value})} className="bg-slate-50 border-none rounded-2xl py-4 px-4 text-xs focus:ring-4 focus:ring-teal-100 outline-none font-bold" />
              </div>
              <input type="text" placeholder="Location" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm focus:ring-4 focus:ring-teal-100 outline-none font-bold" />
              <button onClick={handleManualCreate} className="w-full py-4 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all" style={{ backgroundColor: COLORS.primary }}>Sync to Cloud</button>
            </div>
          </div>
        </div>
      )}

      {selectedEvent && (
        <div className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-md flex items-end p-4">
          <div className="bg-white w-full max-w-md mx-auto rounded-[40px] p-8 pb-12 animate-in slide-in-from-bottom duration-300 shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div className="flex-1 pr-4">
                <h2 className="text-2xl font-black text-slate-800 leading-tight">{selectedEvent.title}</h2>
                <div className="mt-2 flex items-center text-[10px] font-black uppercase text-teal-600 tracking-widest">
                   {selectedEvent.isSynced ? 'Synchronized Entry' : 'Local Entry'}
                </div>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="p-2 bg-slate-100 rounded-xl"><ICONS.Plus className="w-4 h-4 rotate-45 text-slate-500" /></button>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed mb-8">{selectedEvent.description || "No further details recorded."}</p>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-4 bg-slate-50 rounded-2xl"><p className="text-[9px] font-black uppercase text-slate-400 mb-1">Starts</p><p className="text-sm font-bold text-slate-800">{new Date(selectedEvent.start_at).toLocaleTimeString()}</p></div>
              <div className="p-4 bg-slate-50 rounded-2xl"><p className="text-[9px] font-black uppercase text-slate-400 mb-1">Ends</p><p className="text-sm font-bold text-slate-800">{new Date(selectedEvent.end_at).toLocaleTimeString()}</p></div>
            </div>
            <button onClick={() => setSelectedEvent(null)} className="w-full py-4 text-white rounded-2xl font-black uppercase text-xs tracking-widest" style={{ backgroundColor: COLORS.primary }}>Back to Grid</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarScreen;
