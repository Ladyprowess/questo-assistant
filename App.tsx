import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Nigeria: 'Africa/Lagos',
  'United Kingdom': 'Europe/London',
  'United States': 'America/New_York',
  Canada: 'America/Toronto',
  Germany: 'Europe/Berlin',
  France: 'Europe/Paris',
  India: 'Asia/Kolkata',
  Australia: 'Australia/Sydney',
  'South Africa': 'Africa/Johannesburg',
  Brazil: 'America/Sao_Paulo',
  Japan: 'Asia/Tokyo',
  UAE: 'Asia/Dubai',
};

/**
 * ---------- TIME HELPERS (FIXES 5PM -> 4PM DRIFT) ----------
 * The drift happens when:
 * - datetime-local has NO timezone
 * - toISOString() converts to UTC (Z) and shifts the hour
 *
 * Fix:
 * - Keep local wall-clock time and store ISO with numeric offset (+01:00 etc)
 * - Display with user's chosen timezone
 */

const getUserTimeZone = () => {
  try {
    const tz =
      localStorage.getItem('timezone') ||
      localStorage.getItem('user_timezone') ||
      localStorage.getItem('selectedTimezone') ||
      localStorage.getItem('selected_time_zone') ||
      localStorage.getItem('timeZone');

    if (tz && tz.trim()) return tz.trim();
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const pad2 = (n: number) => String(n).padStart(2, '0');

const toISOWithOffset = (d: Date) => {
  // Example: 2026-02-01T17:00:00+01:00
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());

  // getTimezoneOffset: minutes behind UTC (Nigeria is -60)
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const offH = pad2(Math.floor(abs / 60));
  const offM = pad2(abs % 60);

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${sign}${offH}:${offM}`;
};

const safeParseDate = (value: string) => {
  if (!value) return null;
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d;
  return null;
};

const formatForUI = (value: string | Date, tz: string) => {
  try {
    const d = typeof value === 'string' ? new Date(value) : value;
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  } catch {
    try {
      const d = typeof value === 'string' ? new Date(value) : value;
      return d.toLocaleString();
    } catch {
      return '';
    }
  }
};

/**
 * ---------- UI Notification Builder ----------
 * Better success message quality + consistent tone.
 */
const buildSuccess = (title: string, body: string) => {
  return { title, body };
};

const buildError = (title: string, body: string) => {
  return { title, body };
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
      <p className="text-slate-400 text-sm mb-8 leading-relaxed max-w-xs">
        Configuration missing. Enter your Supabase project details to enable the cloud ledger and sync features.
      </p>

      <div className="w-full max-w-sm space-y-4">
        <div className="text-left">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-4">
            Project URL
          </label>
          <input
            type="text"
            placeholder="https://xyz.supabase.co"
            className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-teal-500 transition-all text-sm"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <div className="text-left">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-4">
            Anon Key
          </label>
          <input
            type="password"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5c..."
            className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-teal-500 transition-all text-sm"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </div>
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
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAuth = async () => {
    if (!isSupabaseConfigured) return;

    setIsAuthLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (isSignup) {
        if (!fullName.trim()) {
          setError('Please enter your full name.');
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) throw error;

        // If email confirmation enabled:
        if (data?.user && !data.session) {
          setSuccessMsg('Account created! Please check your email to confirm your address.');
        } else {
          setSuccessMsg('Welcome! Your account is ready.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setSuccessMsg('Welcome back — signing you in now.');
      }
    } catch (err: any) {
      setError(err?.message || 'Auth failed. Please try again.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (!isSupabaseConfigured) return;

    setIsAuthLoading(true);
    setError(null);
    setSuccessMsg(null);
    onAuthStarted();

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/#/chat`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed. Please try again.');
      setIsAuthLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-8 text-center animate-in fade-in duration-500">
      <div
        className="w-20 h-20 rounded-[28px] flex items-center justify-center mb-8 shadow-2xl rotate-3"
        style={{ backgroundColor: COLORS.primary }}
      >
        <span className="text-white text-4xl font-black italic">Q</span>
      </div>
      <h1 className="text-3xl font-black mb-2 text-slate-900">{isSignup ? 'Create Account' : 'Sign In'}</h1>
      <p className="text-slate-400 text-sm mb-8 font-medium italic">Your private virtual assistant.</p>

      <div className="w-full space-y-4 max-w-sm">
        {error && (
          <div className="p-4 bg-red-50 text-red-600 text-xs font-bold rounded-2xl mb-4">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="p-4 bg-teal-50 text-teal-700 text-xs font-bold rounded-2xl mb-4">
            {successMsg}
          </div>
        )}

        <button
          onClick={handleGoogleAuth}
          disabled={isAuthLoading}
          className="w-full flex items-center justify-center space-x-3 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-50 transition-all active:scale-95 mb-2 disabled:opacity-50"
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            className="w-5 h-5"
            alt="Google"
          />
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

        <input
          type="password"
          placeholder="Password"
          className="w-full p-5 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-teal-100 transition-all text-sm font-semibold"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleAuth}
          disabled={isAuthLoading}
          className="w-full py-5 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex justify-center items-center disabled:opacity-50"
          style={{ backgroundColor: COLORS.primary }}
        >
          {isAuthLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : isSignup ? (
            'Get Started'
          ) : (
            'Login'
          )}
        </button>

        <button
          onClick={() => setIsSignup(!isSignup)}
          className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-2 block mx-auto"
        >
          {isSignup ? 'Already have an account? Login' : 'New to Queso? Join Now'}
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const tz = useMemo(() => getUserTimeZone(), []);

  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [messages, setMessages] = useState<any[]>(() => JSON.parse(localStorage.getItem('queso_chat') || '[]'));
  const [actions, setActions] = useState<AssistantAction[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [notification, setNotification] = useState<{ title: string; body: string } | null>(null);

  // Good notifications
  const triggerNotification = useCallback((title: string, body: string) => {
    setNotification({ title, body });
    setTimeout(() => setNotification(null), 4200);
  }, []);

  // Auth boot
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
        setTasks([]);
        setEvents([]);
        setNotes([]);
        setDrafts([]);
        setActions([]);
      }

      setIsInitializing(false);
    });

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (initialSession) {
        setSession(initialSession);
        fetchProfile(initialSession.user);
      }
      if (!initialSession) setIsInitializing(false);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfile = async (user: any) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        const fullName = user.user_metadata?.full_name || user.user_metadata?.name || 'New User';
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert([{ id: user.id, full_name: fullName, plan: 'free' }])
          .select()
          .single();

        setProfile(newProfile);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Profile fetch error', err);
    }
  };

  const fetchAllData = useCallback(async () => {
    if (!session?.user || !isSupabaseConfigured) return;

    setIsDataLoading(true);
    const userId = session.user.id;

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
    } finally {
      setIsDataLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    if (session?.user && isSupabaseConfigured) {
      fetchAllData();
    }
  }, [session, fetchAllData]);

  // Persist chat
  useEffect(() => {
    localStorage.setItem('queso_chat', JSON.stringify(messages));
  }, [messages]);

  /**
   * Action logger (supports result payload too)
   * This improves tracing for success messages (text + voice)
   */
  const addAction = useCallback(
    async (type: string, input: any, result?: any) => {
      if (!session?.user || !isSupabaseConfigured) return;

      const payload = {
        user_id: session.user.id,
        action_type: type,
        input_payload: input,
        result_payload: result || { status: 'success' },
      };

      try {
        const { data, error } = await supabase
          .from('assistant_actions')
          .insert([payload])
          .select()
          .single();

        if (!error && data) setActions((prev) => [data, ...prev]);
      } catch (e) {
        // don’t crash UI if audit insert fails
        console.warn('assistant_actions insert failed', e);
      }
    },
    [session?.user]
  );

  /**
   * ---------- GOOGLE CALENDAR SYNC (PRO) ----------
   * To get Google notifications on your phone:
   * - we must create events in YOUR Google Calendar.
   *
   * This requires:
   * - OAuth with calendar scope (not just basic Google login)
   * - storing refresh token securely (Supabase)
   * - server-side insert into Google Calendar (Edge Function)
   *
   * This function:
   * - always writes to internal "events" table
   * - if PRO + google connected -> also calls Edge Function to insert into Google Calendar
   */
  const silentCalendarSync = useCallback(
    async (title: string, date: string | null) => {
      if (!date || !session?.user || !isSupabaseConfigured) return;

      const d = safeParseDate(date);
      if (!d) return;

      // Store without drift: ISO WITH OFFSET
      const startAt = toISOWithOffset(d);
      const endAt = toISOWithOffset(new Date(d.getTime() + 30 * 60 * 1000)); // 30 mins

      // Prevent duplicates (best-effort)
      try {
        const { data: existing } = await supabase
          .from('events')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('title', title)
          .eq('start_at', startAt);

        if (existing && existing.length > 0) return;
      } catch {
        // ignore dedupe failure
      }

      // 1) Always store internally
      try {
        const { data, error } = await supabase
          .from('events')
          .insert([
            {
              user_id: session.user.id,
              title,
              description: 'Synchronized Ledger Entry',
              start_at: startAt,
              end_at: endAt,
              location: 'Cloud Sync',
              source: 'internal',
            },
          ])
          .select()
          .single();

        if (!error && data) {
          setEvents((prev) => [data, ...prev]);
        }
      } catch (e) {
        console.warn('internal calendar insert failed', e);
      }

      // 2) If PRO, also push to Google Calendar (so phone notifications work)
      const isPro = (profile?.plan || 'free') === 'pro';
      if (!isPro) return;

      // If user connected google calendar, we expect a flag in localStorage (or profile later)
      const googleConnected = localStorage.getItem('google_calendar_connected') === 'true';

      if (!googleConnected) {
        // Don’t spam users; only a gentle notice
        // (You’ll add a proper “Connect Google Calendar” in Settings)
        return;
      }

      // Call your Supabase Edge Function (you will create this next)
      // Function should:
      // - read stored refresh token for user
      // - insert an event into Google Calendar
      try {
        const { data: fnData, error: fnError } = await supabase.functions.invoke('google-calendar-sync', {
          body: {
            title,
            start_at: startAt,
            end_at: endAt,
            description: 'Queso Assistant Sync',
          },
        });

        if (fnError) {
          console.warn('google calendar sync failed', fnError);
          return;
        }

        // Optional: mark the matching internal event as google_calendar source
        // (only if your edge function returns googleEventId)
        // Example: if (fnData?.googleEventId) { ... }

      } catch (e) {
        console.warn('google calendar edge invoke failed', e);
      }
    },
    [session?.user, profile?.plan]
  );

  // Better sign out
  const handleSignOut = async () => {
    try {
      if (isSupabaseConfigured) await supabase.auth.signOut();
    } finally {
      localStorage.removeItem('queso_chat');
      // Keep timezone + google flags if you want
      // localStorage.clear();  // (this clears timezone too - not ideal)
      window.location.reload();
    }
  };

  // If plan updates to PRO, show a strong confirmation and refetch
  useEffect(() => {
    if (!profile?.plan) return;
    if (profile.plan === 'pro') {
      triggerNotification(
        buildSuccess('Pro Activated', 'All features are now unlocked — including full drafts and calendar sync.').title,
        buildSuccess('Pro Activated', 'All features are now unlocked — including full drafts and calendar sync.').body
      );
      fetchAllData();
    }
  }, [profile?.plan, fetchAllData, triggerNotification]);

  if (!isSupabaseConfigured) return <SupabaseConfigScreen />;

  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Checking Authentication...</p>
      </div>
    );
  }

  if (!session) return <AuthScreen onAuthStarted={() => setIsInitializing(true)} />;

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
                <p className="text-[10px] text-slate-600 line-clamp-2">
                  {notification.body}
                </p>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto pb-24 scroll-smooth">
          <Routes>
            <Route path="/" element={<Navigate to="/chat" />} />

            <Route
              path="/chat"
              element={
                <ChatScreen
                  plan={profile?.plan || 'free'}
                  messages={messages}
                  setMessages={setMessages}
                  onClearChat={() => {
                    setMessages([]);
                    localStorage.removeItem('queso_chat');
                  }}
                  setTasks={setTasks}
                  setEvents={setEvents}
                  setNotes={setNotes}
                  setDrafts={setDrafts}
                  triggerNotification={(title, body) => triggerNotification(title, body)}
                  addAction={addAction}
                  syncToCalendar={silentCalendarSync}
                  refreshData={fetchAllData}
                />
              }
            />

            <Route
              path="/today"
              element={<TodayScreen plan={profile?.plan || 'free'} tasks={tasks} events={events} notes={notes} />}
            />

            <Route
              path="/tasks"
              element={
                <TasksScreen
                  plan={profile?.plan || 'free'}
                  tasks={tasks}
                  setTasks={setTasks}
                  addAction={addAction}
                  syncToCalendar={silentCalendarSync}
                />
              }
            />

            <Route
              path="/calendar"
              element={<CalendarScreen events={events} setEvents={setEvents} addAction={addAction} />}
            />

            <Route
              path="/notes"
              element={
                <NotesScreen
                  plan={profile?.plan || 'free'}
                  notes={notes}
                  setNotes={setNotes}
                  addAction={addAction}
                  syncToCalendar={silentCalendarSync}
                />
              }
            />

            <Route
              path="/drafts/:id"
              element={
                <DraftsScreen
                  plan={profile?.plan || 'free'}
                  drafts={drafts}
                  triggerNotification={triggerNotification}
                  addAction={addAction}
                />
              }
            />

            <Route
              path="/settings"
              element={
                <SettingsScreen
                  profile={{
                    ...profile,
                    email: session.user.email,
                    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.id}`,
                  }}
                  setProfile={setProfile}
                  onSignOut={handleSignOut}
                  addAction={addAction}
                />
              }
            />

            <Route path="/paywall" element={<PaywallScreen profile={profile} setProfile={setProfile} />} />

            <Route path="/audit" element={<AuditLogScreen actions={actions} />} />
          </Routes>

          {/* Optional tiny loader indicator */}
          {isDataLoading && (
            <div className="px-6 pb-6">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                Syncing latest updates...
              </div>
            </div>
          )}
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
    className={({ isActive }) =>
      `flex flex-col items-center justify-center space-y-1 transition-all ${isActive ? 'scale-110' : 'text-slate-400'}`
    }
    style={({ isActive }) => ({ color: isActive ? COLORS.primary : undefined })}
  >
    {icon}
    <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
  </NavLink>
);

export default App;
