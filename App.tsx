
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { ICONS, COLORS } from './constants';
import { Task, CalendarEvent, Note, AssistantAction, Draft } from './types';

// Screens
import ChatScreen from './screens/ChatScreen';
import TodayScreen from './screens/TodayScreen';
import CalendarScreen from './screens/CalendarScreen';
import TasksScreen from './screens/TasksScreen';
import NotesScreen from './screens/NotesScreen';
import SettingsScreen from './screens/SettingsScreen';
import PaywallScreen from './screens/PaywallScreen';
import AuditLogScreen from './screens/AuditLogScreen';
import DraftsScreen from './screens/DraftsScreen';

export const COUNTRY_TIMEZONES: Record<string, string> = {
  'Nigeria': 'Africa/Lagos',
  'United Kingdom': 'Europe/London',
  'United States': 'America/New_York',
  'Canada': 'America/Toronto',
  'Germany': 'Europe/Berlin',
  'France': 'Europe/Paris',
  'India': 'Asia/Kolkata',
  'Australia': 'Australia/Sydney',
  'South Africa': 'Africa/Johannesburg',
  'Brazil': 'America/Sao_Paulo',
  'Japan': 'Asia/Tokyo',
  'UAE': 'Asia/Dubai',
};

const AuthScreen: React.FC<{ onLogin: (user: any) => void }> = ({ onLogin }) => {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const handleAuth = async (isGoogle = false) => {
    setIsAuthLoading(true);
    setTimeout(() => {
      onLogin({ 
        id: 'u-' + Date.now(), 
        full_name: isGoogle ? "Google User" : (fullName || email.split('@')[0]), 
        email: isGoogle ? "google.user@gmail.com" : email, 
        avatar: isGoogle ? `https://api.dicebear.com/7.x/avataaars/svg?seed=google` : `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
        plan: 'free',
        country: 'Nigeria',
        timezone: 'Africa/Lagos',
        auth_provider: isGoogle ? 'google' : 'email'
      });
      setIsAuthLoading(false);
    }, 1200);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-8 text-center animate-in fade-in duration-500">
      <div className="w-20 h-20 rounded-[28px] flex items-center justify-center mb-8 shadow-2xl rotate-3" style={{ backgroundColor: COLORS.primary }}>
        <span className="text-white text-4xl font-black italic">Q</span>
      </div>
      <h1 className="text-3xl font-black mb-2 text-slate-900">{isSignup ? 'Create Account' : 'Sign In'}</h1>
      <p className="text-slate-400 text-sm mb-12 font-medium italic">Your private virtual assistant.</p>
      
      <div className="w-full space-y-4 max-w-sm">
        <button 
          onClick={() => handleAuth(true)}
          disabled={isAuthLoading}
          className="w-full flex items-center justify-center space-x-3 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-50 transition-all active:scale-95 mb-2"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
          <span className="text-sm font-bold text-slate-700">Continue with Google</span>
        </button>

        <div className="flex items-center space-x-4 py-2">
          <div className="flex-1 h-px bg-slate-100"></div>
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">or email</span>
          <div className="flex-1 h-px bg-slate-100"></div>
        </div>

        {isSignup && (
          <input 
            type="text" 
            placeholder="Full Name" 
            className="w-full p-5 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-teal-100 transition-all text-sm font-semibold"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        )}
        <input 
          type="email" 
          placeholder="Email Address" 
          className="w-full p-5 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-teal-100 transition-all text-sm font-semibold"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button 
          onClick={() => handleAuth(false)}
          disabled={isAuthLoading}
          className="w-full py-5 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex justify-center items-center"
          style={{ backgroundColor: COLORS.primary }}
        >
          {isAuthLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (isSignup ? 'Get Started' : 'Login')}
        </button>

        <button onClick={() => setIsSignup(!isSignup)} className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-2 block mx-auto">
          {isSignup ? 'Already have an account? Login' : 'New to Queso? Join Now'}
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<any | null>(() => {
    const saved = localStorage.getItem('queso_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [tasks, setTasks] = useState<Task[]>(() => JSON.parse(localStorage.getItem('queso_tasks') || '[]'));
  const [events, setEvents] = useState<CalendarEvent[]>(() => JSON.parse(localStorage.getItem('queso_events') || '[]'));
  const [notes, setNotes] = useState<Note[]>(() => JSON.parse(localStorage.getItem('queso_notes') || '[]'));
  const [messages, setMessages] = useState<any[]>(() => JSON.parse(localStorage.getItem('queso_chat') || '[]'));
  const [actions, setActions] = useState<AssistantAction[]>(() => JSON.parse(localStorage.getItem('queso_actions') || '[]'));
  const [drafts, setDrafts] = useState<Draft[]>(() => JSON.parse(localStorage.getItem('queso_drafts') || '[]'));
  const [notification, setNotification] = useState<{title: string, body: string} | null>(null);

  useEffect(() => {
    if (user) localStorage.setItem('queso_user', JSON.stringify(user));
    localStorage.setItem('queso_tasks', JSON.stringify(tasks));
    localStorage.setItem('queso_events', JSON.stringify(events));
    localStorage.setItem('queso_notes', JSON.stringify(notes));
    localStorage.setItem('queso_chat', JSON.stringify(messages));
    localStorage.setItem('queso_actions', JSON.stringify(actions));
    localStorage.setItem('queso_drafts', JSON.stringify(drafts));
  }, [user, tasks, events, notes, messages, actions, drafts]);

  const addAction = (type: string, input: any) => {
    const newAction: AssistantAction = {
      id: 'a-' + Date.now(),
      user_id: user?.id || 'u1',
      action_type: type,
      input_payload: input,
      result_payload: { status: 'success' },
      created_at: new Date().toISOString(),
    };
    setActions(prev => [newAction, ...prev]);
  };

  const silentCalendarSync = (title: string, date: string | null) => {
    if (!date || !user) return;
    const dateObj = new Date(date);
    const timestamp = dateObj.getTime();
    if (isNaN(timestamp)) return;

    setEvents(prev => {
      const alreadySynced = prev.some(e => e.source === 'google_calendar' && e.title === title && new Date(e.start_at).getTime() === timestamp);
      if (alreadySynced) return prev;

      const syncedEvent: CalendarEvent = {
        id: 'gsync-' + Math.random().toString(36).substring(2, 9),
        user_id: user.id,
        title: title, 
        description: 'Synchronized Ledger Entry',
        start_at: dateObj.toISOString(),
        end_at: new Date(timestamp + 1800000).toISOString(),
        location: 'Cloud Sync',
        attendees: [],
        source: 'google_calendar',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      return [syncedEvent, ...prev];
    });
  };

  const triggerNotification = (title: string, body: string) => {
    setNotification({ title, body });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleSignOut = () => {
    setUser(null);
    localStorage.clear();
    window.location.reload();
  };

  if (!user) return <AuthScreen onLogin={setUser} />;

  return (
    <HashRouter>
      <div className="flex flex-col h-screen bg-slate-50 max-w-md mx-auto relative border-x border-slate-200 shadow-2xl overflow-hidden">
        {notification && (
          <div className="absolute top-6 left-4 right-4 z-[200] animate-in slide-in-from-top-12 duration-500">
            <div className="bg-white/95 backdrop-blur-xl border border-slate-200 p-4 rounded-3xl shadow-2xl flex items-center space-x-4">
              <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center text-white shrink-0">
                <ICONS.Check className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-black text-slate-800">{notification.title}</h4>
                <p className="text-[10px] text-slate-500 line-clamp-1">{notification.body}</p>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto pb-24 scroll-smooth">
          <Routes>
            <Route path="/" element={<Navigate to="/chat" />} />
            <Route path="/chat" element={
              <ChatScreen 
                plan={user.plan} 
                messages={messages} 
                setMessages={setMessages} 
                onClearChat={() => setMessages([])}
                setTasks={setTasks}
                setEvents={setEvents}
                setNotes={setNotes}
                setDrafts={setDrafts}
                triggerNotification={triggerNotification}
                addAction={addAction}
                syncToCalendar={silentCalendarSync}
              />
            } />
            <Route path="/today" element={<TodayScreen plan={user.plan} tasks={tasks} events={events} notes={notes} />} />
            <Route path="/tasks" element={<TasksScreen plan={user.plan} tasks={tasks} setTasks={setTasks} addAction={addAction} syncToCalendar={silentCalendarSync} />} />
            <Route path="/calendar" element={<CalendarScreen events={events} setEvents={setEvents} addAction={addAction} />} />
            <Route path="/notes" element={<NotesScreen plan={user.plan} notes={notes} setNotes={setNotes} addAction={addAction} syncToCalendar={silentCalendarSync} />} />
            <Route path="/drafts/:id" element={<DraftsScreen plan={user.plan} drafts={drafts} triggerNotification={triggerNotification} addAction={addAction} />} />
            <Route path="/settings" element={<SettingsScreen profile={user} setProfile={setUser} onSignOut={handleSignOut} addAction={addAction} />} />
            <Route path="/paywall" element={<PaywallScreen profile={user} setProfile={setUser} />} />
            <Route path="/audit" element={<AuditLogScreen actions={actions} />} />
          </Routes>
        </main>

        <nav className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 flex items-center justify-around py-4 pb-8 px-6 z-50">
          <NavItem to="/chat" icon={<ICONS.Chat className="w-6 h-6" />} label="Assistant" />
          <NavItem to="/today" icon={<ICONS.Today className="w-6 h-6" />} label="Schedule" />
          <NavItem to="/tasks" icon={<ICONS.Tasks className="w-6 h-6" />} label="Tasks" />
          <NavItem to="/notes" icon={<ICONS.Notes className="w-6 h-6" />} label="Notes" />
          <NavItem to="/settings" icon={<ICONS.Settings className="w-6 h-6" />} label="Setup" />
        </nav>
      </div>
    </HashRouter>
  );
};

const NavItem: React.FC<{ to: string; icon: React.ReactNode; label: string }> = ({ to, icon, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) => `flex flex-col items-center justify-center space-y-1 transition-all ${isActive ? 'scale-110' : 'text-slate-400'}`}
    style={({ isActive }) => ({ color: isActive ? COLORS.primary : undefined })}
  >
    {icon}
    <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
  </NavLink>
);

export default App;
