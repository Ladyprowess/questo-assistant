
import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { ICONS, COLORS } from './constants';
import { Task, CalendarEvent, Note, AssistantAction, Draft } from './types';
import { supabase, isSupabaseConfigured, saveSupabaseConfig } from './services/supabase';

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

const SupabaseConfigScreen: React.FC = () => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');

  const handleSave = () => {
    if (url && key) {
      saveSupabaseConfig(url, key);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-8 text-center text-white">
      <div className="w-20 h-20 rounded-[28px] bg-teal-600 flex items-center justify-center mb-8 shadow-2xl">
        <ICONS.Settings className="w-10 h-10 text-white" />
      </div>
      <h1 className="text-3xl font-black mb-4">Connect Supabase</h1>
      <p className="text-slate-400 text-sm mb-8 leading-relaxed max-w-xs font-medium">
        Cloud Ledger missing. Enter project details to enable permanent persistence and sync.
      </p>
      
      <div className="w-full max-w-sm space-y-4">
        <input 
          type="text" 
          placeholder="https://xyz.supabase.co" 
          className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-teal-500 transition-all text-sm font-mono"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <input 
          type="password" 
          placeholder="Anon Key" 
          className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-teal-500 transition-all text-sm font-mono"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <button 
          onClick={handleSave}
          className="w-full py-5 bg-teal-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all mt-4"
        >
          Initialize Sync
        </button>
      </div>
    </div>
  );
};

const AuthScreen: React.FC<{ onAuthStarted: () => void }> = ({ onAuthStarted }) => {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async () => {
    if (!isSupabaseConfigured) return;
    setIsAuthLoading(true);
    setError(null);
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } }
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-8 text-center animate-in fade-in duration-500">
      <div className="w-20 h-20 rounded-[28px] flex items-center justify-center mb-8 shadow-2xl rotate-3" style={{ backgroundColor: COLORS.primary }}>
        <span className="text-white text-4xl font-black italic">Q</span>
      </div>
      <h1 className="text-3xl font-black mb-2 text-slate-900">{isSignup ? 'Create Account' : 'Sign In'}</h1>
      <p className="text-slate-400 text-sm mb-8 font-medium italic">Your private virtual assistant.</p>
      
      <div className="w-full space-y-4 max-w-sm">
        {error && <div className="p-4 bg-red-50 text-red-600 text-[10px] font-black uppercase rounded-2xl mb-4 text-left">{error}</div>}
        
        {isSignup && (
          <input 
            type="text" 
            placeholder="Full Name" 
            className="w-full p-5 bg-slate-50 border-none rounded-2xl outline-none text-sm font-semibold"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        )}
        <input 
          type="email" 
          placeholder="Email Address" 
          className="w-full p-5 bg-slate-50 border-none rounded-2xl outline-none text-sm font-semibold"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input 
          type="password" 
          placeholder="Password" 
          className="w-full p-5 bg-slate-50 border-none rounded-2xl outline-none text-sm font-semibold"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button 
          onClick={handleAuth}
          disabled={isAuthLoading}
          className="w-full py-5 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl flex justify-center items-center disabled:opacity-50"
          style={{ backgroundColor: COLORS.primary }}
        >
          {isAuthLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (isSignup ? 'Get Started' : 'Login')}
        </button>

        <button onClick={() => setIsSignup(!isSignup)} className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-2 block mx-auto">
          {isSignup ? 'Login instead' : 'Join Now'}
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [messages, setMessages] = useState<any[]>(() => JSON.parse(localStorage.getItem('queso_chat') || '[]'));
  const [actions, setActions] = useState<AssistantAction[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [notification, setNotification] = useState<{title: string, body: string} | null>(null);

  const refreshAllData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const userId = user.id;

    try {
      const [tasksRes, eventsRes, notesRes, draftsRes, actionsRes] = await Promise.all([
        supabase.from('tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('events').select('*').eq('user_id', userId).order('start_at', { ascending: true }),
        supabase.from('notes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('drafts').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('assistant_actions').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      ]);

      if (tasksRes.data) setTasks(tasksRes.data);
      if (eventsRes.data) setEvents(eventsRes.data);
      if (notesRes.data) setNotes(notesRes.data);
      if (draftsRes.data) setDrafts(draftsRes.data);
      if (actionsRes.data) setActions(actionsRes.data);
    } catch (e) {
      console.error("Cloud data sync failed", e);
    }
  }, []);

  const fetchProfile = useCallback(async (user: any) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (error || !data) {
        console.warn("Profile missing, attempting self-healing creation...");
        const fullName = user.user_metadata?.full_name || user.user_metadata?.name || 'New User';
        const { data: newProfile, error: insErr } = await supabase.from('profiles')
          .insert([{ id: user.id, full_name: fullName, plan: 'free' }])
          .select()
          .single();
        
        if (!insErr && newProfile) {
          await supabase.from('subscriptions').insert([{ user_id: user.id, plan: 'free', status: 'active' }]);
          setProfile(newProfile);
        }
      } else {
        setProfile(data);
      }
      refreshAllData();
    } catch (err) {
      console.error("Critical profile fetch failure", err);
    }
  }, [refreshAllData]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsInitializing(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      if (currentSession) {
        fetchProfile(currentSession.user);
      } else {
        setProfile(null);
      }
      setIsInitializing(false);
    });

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (initialSession) {
        setSession(initialSession);
        fetchProfile(initialSession.user);
      }
      setIsInitializing(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  useEffect(() => {
    localStorage.setItem('queso_chat', JSON.stringify(messages));
  }, [messages]);

  const addAction = async (type: string, input: any, result: any = { status: 'success' }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('assistant_actions')
        .insert([{
          user_id: user.id,
          action_type: type,
          input_payload: input,
          result_payload: result
        }])
        .select()
        .single();
      
      if (data) setActions(prev => [data, ...prev]);
      if (error) console.error("Persistence failed for audit log:", error);
    } catch (e) {
      console.error("Audit log exception:", e);
    }
  };

  const silentCalendarSync = async (title: string, date: string | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!date || !user) return;
    try {
      const startAt = new Date(date).toISOString();
      const endAt = new Date(new Date(date).getTime() + 1800000).toISOString();
      
      const { data } = await supabase.from('events').insert([{
        user_id: user.id,
        title: title,
        description: 'AI Managed Sync',
        start_at: startAt,
        end_at: endAt
      }]).select()
      .single();

      if (data) setEvents(prev => [data, ...prev]);
    } catch (e) {
      console.error("Silent calendar sync failed", e);
    }
  };

  const triggerNotification = (title: string, body: string) => {
    setNotification({ title, body });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    window.location.reload();
  };

  if (!isSupabaseConfigured) return <SupabaseConfigScreen />;
  if (isInitializing) return <div className="flex h-screen items-center justify-center font-black uppercase tracking-widest text-[10px] text-slate-400">Ledgering...</div>;
  if (!session) return <AuthScreen onAuthStarted={() => setIsInitializing(true)} />;

  return (
    <HashRouter>
      <div className="flex flex-col h-screen bg-slate-50 max-w-md mx-auto relative border-x border-slate-200 shadow-2xl overflow-hidden">
        {notification && (
          <div className="absolute top-6 left-4 right-4 z-[200] animate-in slide-in-from-top-12 duration-500">
            <div className="bg-white/95 backdrop-blur-xl border border-slate-200 p-4 rounded-3xl shadow-2xl flex items-center space-x-4">
              <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center text-white shrink-0"><ICONS.Check className="w-6 h-6" /></div>
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
                plan={profile?.plan || 'free'} messages={messages} setMessages={setMessages} 
                onClearChat={() => { setMessages([]); localStorage.removeItem('queso_chat'); }}
                setTasks={setTasks} setEvents={setEvents} setNotes={setNotes} setDrafts={setDrafts}
                triggerNotification={triggerNotification} addAction={addAction} syncToCalendar={silentCalendarSync}
                refreshData={refreshAllData}
              />
            } />
            <Route path="/today" element={<TodayScreen plan={profile?.plan || 'free'} tasks={tasks} events={events} notes={notes} />} />
            <Route path="/tasks" element={<TasksScreen plan={profile?.plan || 'free'} tasks={tasks} setTasks={setTasks} addAction={addAction} syncToCalendar={silentCalendarSync} />} />
            <Route path="/notes" element={<NotesScreen plan={profile?.plan || 'free'} notes={notes} setNotes={setNotes} addAction={addAction} syncToCalendar={silentCalendarSync} />} />
            <Route path="/calendar" element={<CalendarScreen events={events} setEvents={setEvents} addAction={addAction} />} />
            <Route path="/audit" element={<AuditLogScreen actions={actions} />} />
            <Route path="/settings" element={<SettingsScreen profile={{...profile, email: session.user.email, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.id}`} } setProfile={setProfile} onSignOut={handleSignOut} addAction={addAction} />} />
            <Route path="/paywall" element={<PaywallScreen profile={profile} setProfile={setProfile} />} />
            <Route path="/drafts/:id" element={<DraftsScreen plan={profile?.plan || 'free'} drafts={drafts} triggerNotification={triggerNotification} addAction={addAction} />} />
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
