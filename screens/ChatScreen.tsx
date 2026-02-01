import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getGeminiResponse, assistantTools, getSystemInstruction, cleanResponse } from '../services/gemini';
import { ICONS, COLORS } from '../constants';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Task, CalendarEvent, Note, Draft } from '../types';
import { supabase } from '../services/supabase';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isAction?: boolean;
  draftId?: string;
  actionType?: string;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number) {
  const bufferCopy = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const dataInt16 = new Int16Array(bufferCopy);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

interface ChatScreenProps {
  plan: string;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  onClearChat: () => void;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
  setDrafts: React.Dispatch<React.SetStateAction<Draft[]>>;
  triggerNotification: (title: string, body: string) => void;
  addAction: (type: string, input: any, result?: any) => Promise<void>;
  syncToCalendar: (title: string, date: string | null) => void;
  refreshData: () => Promise<void>;
}

const ChatScreen: React.FC<ChatScreenProps> = ({
  plan,
  messages,
  setMessages,
  onClearChat,
  setTasks,
  setEvents,
  setNotes,
  setDrafts,
  triggerNotification,
  addAction,
  syncToCalendar,
  refreshData,
}) => {
  const navigate = useNavigate();

  const isPro = useMemo(() => (plan || '').toLowerCase() === 'pro', [plan]);

  // ---------- TIMEZONE (Fix 5pm -> 4pm) ----------
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

  // ---------- UI ----------
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<'connecting' | 'listening' | 'speaking' | 'idle'>('idle');
  const [audioLevel, setAudioLevel] = useState(0);

  const [liveUserText, setLiveUserText] = useState('');
  const [liveAssistantText, setLiveAssistantText] = useState('');

  const userAccRef = useRef('');
  const assistantAccRef = useRef('');
  const isVoiceActiveRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextStartTimeRef = useRef(0);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // ---------- CREDITS (Supabase-owned) ----------
const [credits, setCredits] = useState<number | null>(null);

const loadCredits = async () => {
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    setCredits(null);
    return;
  }

  await ensureProfileExists(user);

  const { data, error } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Failed to load credits:', error);
    setCredits(0);
    return;
  }

  setCredits(typeof data?.credits === 'number' ? data.credits : 0);
};

const decrementCredits = async () => {
  // Pro users shouldn’t be blocked by credits
  if (isPro) return;

  const { data, error } = await supabase.rpc('decrement_credits');

  if (error) {
    console.error('Failed to decrement credits:', error);
    // fail-safe: don’t silently allow infinite usage if decrement is broken
    setCredits((prev) => (typeof prev === 'number' ? prev : 0));
    return;
  }

  // rpc returns the new integer credits value
  setCredits(typeof data === 'number' ? data : 0);
};




  const audioResourcesRef = useRef<{
    inputCtx: AudioContext | null;
    outputCtx: AudioContext | null;
    stream: MediaStream | null;
    processor: ScriptProcessorNode | null;
  }>({ inputCtx: null, outputCtx: null, stream: null, processor: null });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading, liveUserText, liveAssistantText]);

  useEffect(() => {
    return () => stopVoiceMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const ensureProfileExists = async (user: any) => {
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).single();
    if (!profile) {
      console.warn('Tool execution: Profile missing, auto-generating...');
      const fullName = user.user_metadata?.full_name || 'Queso User';
      await supabase.from('profiles').insert([
        { id: user.id, full_name: fullName, plan: 'free', credits: 20 }
      ]);
      
      await supabase.from('subscriptions').insert([{ user_id: user.id, plan: 'free', status: 'active' }]);
    }
  };

  useEffect(() => {
    loadCredits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro]);

  // ---------- SUCCESS MESSAGES ----------
  const successCopy = (type: 'task' | 'note' | 'event' | 'draft', title: string) => {
    if (type === 'task') return `Task saved: “${title}”.`;
    if (type === 'note') return `Note saved: “${title}”.`;
    if (type === 'event') return `Event scheduled: “${title}”.`;
    return `Draft created successfully.`;
  };

  // ---------- TOOL EXECUTION ----------
  const executeFunction = async (name: string, args: any) => {
    console.log(`[LEDGER] Executing: ${name}`, args);

    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      triggerNotification('Sign-in required', 'Your session expired. Please log in again.');
      return { error: 'Session expired.' };
    }

    await ensureProfileExists(user);

    let resultPayload: { status: string; error?: string; id?: string } = { status: 'failed', error: 'Unknown' };

    try {
      if (name === 'create_task') {
        const { data, error } = await supabase
          .from('tasks')
          .insert([{
            user_id: user.id,
            title: args.title,
            description: args.description || '',
            due_at: args.due_at || new Date().toISOString(),
            priority: args.priority || 'medium'
          }])
          .select()
          .single();

        if (error) throw error;

        if (data) {
          // Pro users should have access to ALL features.
          // Only sync calendar if Pro (so free users don’t expect Google reminders)
          if (isPro) syncToCalendar(args.title, args.due_at || data.due_at);

          triggerNotification('Saved', successCopy('task', args.title));
          resultPayload = { status: 'success', id: data.id };

          await addAction(name, args, resultPayload);
          await refreshData();
          return { result: 'Task created.' };
        }
      }

      if (name === 'create_note') {
        const { data, error } = await supabase
          .from('notes')
          .insert([{
            user_id: user.id,
            title: args.title,
            content: args.content,
            scheduled_at: args.scheduled_at || new Date().toISOString()
          }])
          .select()
          .single();

        if (error) throw error;

        if (data) {
          if (isPro) syncToCalendar(`Note: ${args.title}`, args.scheduled_at || data.scheduled_at);

          triggerNotification('Saved', successCopy('note', args.title));
          resultPayload = { status: 'success', id: data.id };

          await addAction(name, args, resultPayload);
          await refreshData();
          return { result: 'Note saved.' };
        }
      }

      if (name === 'create_event') {
        const { data, error } = await supabase
          .from('events')
          .insert([{
            user_id: user.id,
            title: args.title,
            start_at: args.start_at,
            end_at: args.end_at,
            location: args.location || ''
          }])
          .select()
          .single();

        if (error) throw error;

        if (data) {
          if (isPro) syncToCalendar(`Event: ${args.title}`, args.start_at);

          triggerNotification('Saved', successCopy('event', args.title));
          resultPayload = { status: 'success', id: data.id };

          await addAction(name, args, resultPayload);
          await refreshData();
          return { result: 'Event scheduled.' };
        }
      }

      if (name === 'draft_message') {
        const { data, error } = await supabase
          .from('drafts')
          .insert([{
            user_id: user.id,
            channel: args.channel || 'email',
            recipient: args.recipient || '',
            subject: args.subject || '',
            body: args.body
          }])
          .select()
          .single();

        if (error) throw error;

        if (data) {
          triggerNotification('Saved', 'Draft created and stored in Drafts.');
          resultPayload = { status: 'success', id: data.id };

          await addAction(name, args, resultPayload);
          await refreshData();
          return { result: 'Draft created.', draftId: data.id };
        }
      }

      await addAction(name, args, resultPayload);
      await refreshData();
      return { result: 'Action completed.' };
    } catch (e: any) {
      console.error(`[LEDGER ERROR] ${name}:`, e);
      triggerNotification('Action failed', e?.message || 'Cloud error. Please try again.');
      await addAction(name, args, { status: 'error', message: e?.message });
      return { error: `Database rejection: ${e?.message}` };
    }
  };

  // ---------- VOICE ----------
  const stopVoiceMode = () => {
    isVoiceActiveRef.current = false;

    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch {}
      sessionRef.current = null;
    }

    sourcesRef.current.forEach(source => { try { source.stop(); } catch {} });
    sourcesRef.current.clear();

    const { inputCtx, outputCtx, stream, processor } = audioResourcesRef.current;
    if (processor) { try { processor.disconnect(); } catch {} }
    if (stream) stream.getTracks().forEach(track => track.stop());
    if (inputCtx && inputCtx.state !== 'closed') inputCtx.close();
    if (outputCtx && outputCtx.state !== 'closed') outputCtx.close();

    audioResourcesRef.current = { inputCtx: null, outputCtx: null, stream: null, processor: null };

    setIsVoiceActive(false);
    setVoiceStatus('idle');
    setLiveUserText('');
    setLiveAssistantText('');
    setAudioLevel(0);

    userAccRef.current = '';
    assistantAccRef.current = '';
  };

  const toggleVoiceMode = async () => {
    if (isVoiceActive) {
      stopVoiceMode();
      return;
    }

    if (!isPro && credits === null) {
      await loadCredits();
    }
    if (!isPro && (credits ?? 0) <= 0) {
      navigate('/app/paywall');
      return;
    }
    
    

    setIsVoiceActive(true);
    isVoiceActiveRef.current = true;
    setVoiceStatus('connecting');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      await inputCtx.resume();
      await outputCtx.resume();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      audioResourcesRef.current = { inputCtx, outputCtx, stream, processor: null };
      nextStartTimeRef.current = outputCtx.currentTime;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setVoiceStatus('listening');

            const micSource = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            audioResourcesRef.current.processor = processor;

            processor.onaudioprocess = (e) => {
              if (!isVoiceActiveRef.current) return;

              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
              setAudioLevel(Math.min(100, Math.sqrt(sum / inputData.length) * 400));

              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;

              sessionPromise.then(s => {
                if (s && isVoiceActiveRef.current) {
                  s.sendRealtimeInput({
                    media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' }
                  });
                }
              });
            };

            micSource.connect(processor);
            processor.connect(inputCtx.destination);
          },

          onmessage: async (m: LiveServerMessage) => {
            if (m.toolCall) {
              for (const fc of m.toolCall.functionCalls) {
                const result = await executeFunction(fc.name, fc.args);
                sessionPromise.then(s =>
                  s.sendToolResponse({
                    functionResponses: { id: fc.id, name: fc.name, response: result }
                  })
                );
              }
            }

            if (m.serverContent?.inputTranscription) {
              userAccRef.current += m.serverContent.inputTranscription.text;
              setLiveUserText(userAccRef.current);
            }

            if (m.serverContent?.outputTranscription) {
              assistantAccRef.current += m.serverContent.outputTranscription.text;
              setLiveAssistantText(assistantAccRef.current);
            }

            if (m.serverContent?.turnComplete) {
              const finalU = cleanResponse(userAccRef.current);
              const finalA = cleanResponse(assistantAccRef.current);

              if (finalU || finalA) {
                const now = new Date();

                setMessages(prev => [
                  ...prev,
                  ...(finalU ? [{ id: `vu-${Date.now()}`, role: 'user' as const, content: finalU, timestamp: now }] : []),
                  ...(finalA ? [{ id: `va-${Date.now()}`, role: 'assistant' as const, content: finalA, timestamp: now }] : [])
                ]);

                if (finalU) await decrementCredits();

                triggerNotification('Voice saved', 'Your voice message was captured and added to chat.');
              }

              userAccRef.current = '';
              assistantAccRef.current = '';
              setLiveUserText('');
              setLiveAssistantText('');
              setVoiceStatus('listening');
            }

            const audioPart = m.serverContent?.modelTurn?.parts.find(p => p.inlineData);

            if (audioPart?.inlineData?.data) {
              setVoiceStatus('speaking');

              const buffer = await decodeAudioData(decode(audioPart.inlineData.data), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);

              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setVoiceStatus('listening');
              });

              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }

            if (m.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch {} });
              sourcesRef.current.clear();

              nextStartTimeRef.current = outputCtx.currentTime;
              setVoiceStatus('listening');
              setLiveAssistantText('(Interrupted)');
              assistantAccRef.current = '';
            }
          },

          onclose: () => stopVoiceMode(),
          onerror: () => stopVoiceMode(),
        },

        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{ functionDeclarations: assistantTools }],
          systemInstruction: getSystemInstruction(plan),
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        },
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
      stopVoiceMode();
      triggerNotification('Voice mode failed', 'Could not start voice mode. Please check microphone permissions.');
    }
  };

  // ---------- TEXT SEND ----------
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (!isPro && (credits ?? 0) <= 0) {
  navigate('/app/paywall');
  return;
}


    const now = new Date();

    const userMessage: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: now,
    };

    setMessages(prev => [...prev, userMessage]);

    const currentInput = input;
    setInput('');
    setIsLoading(true);


    try {
      const history = [...messages, userMessage].slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await getGeminiResponse(history, plan);
      await decrementCredits(); 

      let assistantContent = response.text || '';
      let isAction = false;
      let draftId = undefined;
      let actionResults: string[] = [];

      if (response.functionCalls && response.functionCalls.length > 0) {
        for (const fc of response.functionCalls) {
          const res: any = await executeFunction(fc.name, fc.args);
          isAction = true;
          if (res?.result) actionResults.push(res.result);
          if (res?.draftId) draftId = res.draftId;
        }
      }

      const finalAssistantText =
        cleanResponse(assistantContent) ||
        (isAction ? (actionResults.join(' ') || 'Done.') : 'Done.');

      const assistantMessage: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: finalAssistantText,
        timestamp: new Date(),
        isAction,
        draftId,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Better text success message
      triggerNotification('Message sent', 'Your message was sent to the assistant successfully.');
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      triggerNotification('Assistant offline', `Connection failed: ${error?.message || 'Check your network.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <header className="px-6 py-6 border-b border-slate-100 bg-white flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center space-x-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black shadow-lg"
            style={{ backgroundColor: COLORS.primary }}
          >
            Q
          </div>

          <div>
            <h1 className="font-black text-slate-800 tracking-tight">Queso Assistant</h1>
            <div className="flex items-center mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full mr-2 ${isVoiceActive ? 'bg-teal-500 animate-pulse' : 'bg-slate-300'}`} />
              <span className="text-[9px] text-slate-400 font-black uppercase tracking-[0.15em]">
                {isVoiceActive
                  ? `VOICE: ${voiceStatus}`
                  : isPro
                  ? 'PRO ACCESS'
                  : `${Math.max(0, credits ?? 0)} CREDITS`}

              </span>
            </div>
            <div className="text-[8px] text-slate-300 font-black uppercase tracking-widest mt-1">
              {userTimeZone}
            </div>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[85%] px-5 py-4 rounded-3xl text-sm shadow-sm transition-all ${
                msg.role === 'user'
                  ? 'bg-slate-800 text-white rounded-tr-none'
                  : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'
              }`}
            >
              {msg.isAction && <div className="text-[8px] font-black uppercase text-teal-500 mb-1">Completed</div>}

              {msg.content}

              {/* FIXED timestamp rendering */}
              <div className="text-[8px] text-slate-400 mt-1 text-right opacity-60">
                {formatTimeInTz(new Date(msg.timestamp))}
              </div>
            </div>

            {msg.draftId && (
              <div className="mt-3 w-full max-w-[85%] bg-indigo-50 border border-indigo-100 p-4 rounded-2xl shadow-sm">
                <button
                  onClick={() => navigate(`/app/drafts/${msg.draftId}`)}
                  className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                >
                  Review Message Draft
                </button>
              </div>
            )}
          </div>
        ))}

        {liveUserText && (
          <div className="flex justify-end">
            <div className="max-w-[85%] px-5 py-4 rounded-3xl rounded-tr-none text-sm bg-slate-700 text-slate-100 italic opacity-80">
              {liveUserText}
            </div>
          </div>
        )}

        {liveAssistantText && (
          <div className="flex justify-start">
            <div className="max-w-[85%] px-5 py-4 rounded-3xl rounded-tl-none text-sm bg-teal-50 border border-teal-100 text-teal-900">
              {liveAssistantText}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex space-x-1.5 p-4 bg-white/50 rounded-2xl w-16 items-center justify-center animate-pulse">
            <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
            <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
            <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
          </div>
        )}
      </div>

      <div className="p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100 mb-20 relative">
        {isVoiceActive && (
          <div className="absolute -top-[1px] left-0 right-0 h-[2px] bg-slate-100 overflow-hidden">
            <div className="h-full bg-teal-400 transition-all duration-75 ease-out" style={{ width: `${audioLevel}%` }} />
          </div>
        )}

        <div className="flex items-center space-x-2">
          <button
            onClick={toggleVoiceMode}
            className={`p-4 rounded-2xl transition-all shadow-md border ${
              isVoiceActive ? 'bg-teal-500 text-white border-teal-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {isVoiceActive ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="6" width="12" height="12" rx="2" fill="white" stroke="none" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            )}
          </button>

          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isVoiceActive ? 'Listening...' : 'Message Queso...'}
              className="w-full bg-white rounded-2xl py-5 px-6 text-sm focus:ring-4 focus:ring-teal-100 outline-none shadow-sm font-medium border border-slate-100 placeholder:text-slate-300"
            />

            <button
              onClick={handleSend}
              className={`absolute right-2 top-2 p-3 active:scale-110 transition-transform ${input.trim() ? 'text-teal-600' : 'text-slate-200'}`}
            >
              <ICONS.Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatScreen;
