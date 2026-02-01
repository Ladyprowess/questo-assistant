import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

/**
 * Cleans assistant text so it doesn't leak internal tokens or system-ish traces
 */
export const cleanResponse = (text: string) => {
  return (text || "")
    .replace(/<ctrl\d+>/gi, "")
    .replace(/^\s*\[?(system|tool|trace|debug|ledger)\]?:.*$/gim, "")
    .replace(/^[\s\n\.]+/g, "")
    .trim();
};

export const assistantTools: FunctionDeclaration[] = [
  {
    name: "create_task",
    description:
      "REQUIRED for any intent to DO something, remember a todo, or schedule a task. Calculate absolute ISO-8601 timestamps.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "Direct, clear task title" },
        description: { type: Type.STRING, description: "Contextual details" },
        due_at: { type: Type.STRING, description: "ISO-8601 timestamp WITH OFFSET (no Z)" },
        priority: { type: Type.STRING, enum: ["low", "medium", "high"] },
        // Optional recurrence support (if your app later stores it)
        recurrence: {
          type: Type.STRING,
          description:
            "Optional RRULE string for recurring tasks, e.g. 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR'",
        },
      },
      required: ["title", "due_at"],
    },
  },
  {
    name: "create_note",
    description: "REQUIRED for recording information, facts, ideas, or memories that are not tasks.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "Note summary" },
        content: { type: Type.STRING, description: "Full body text" },
        scheduled_at: { type: Type.STRING, description: "ISO-8601 timestamp WITH OFFSET (no Z)" },
        recurrence: {
          type: Type.STRING,
          description:
            "Optional RRULE string if note reminder repeats, e.g. 'RRULE:FREQ=DAILY'",
        },
      },
      required: ["title", "content", "scheduled_at"],
    },
  },
  {
    name: "create_event",
    description: "REQUIRED for scheduling specific time blocks, meetings, or appointments on the calendar.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "Event name" },
        start_at: { type: Type.STRING, description: "ISO-8601 timestamp WITH OFFSET (no Z)" },
        end_at: { type: Type.STRING, description: "ISO-8601 timestamp WITH OFFSET (no Z)" },
        location: { type: Type.STRING, description: "Physical or virtual location" },
        recurrence: {
          type: Type.STRING,
          description:
            "Optional RRULE string for recurring events, e.g. 'RRULE:FREQ=WEEKLY;BYDAY=TU'",
        },
      },
      required: ["title", "start_at", "end_at"],
    },
  },
  {
    name: "draft_message",
    description: "REQUIRED when the user wants to compose an email or message.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        channel: { type: Type.STRING, enum: ["email", "message"] },
        recipient: { type: Type.STRING, description: "Who this is for" },
        subject: { type: Type.STRING, description: "Email subject line" },
        body: { type: Type.STRING, description: "The drafted content" },
      },
      required: ["channel", "body"],
    },
  },
];

/**
 * Reads user's preferred timezone from localStorage
 * Falls back to browser timezone, then UTC.
 */
const getUserTimeZone = () => {
  try {
    const fromStorage =
      localStorage.getItem("timezone") ||
      localStorage.getItem("user_timezone") ||
      localStorage.getItem("selectedTimezone") ||
      localStorage.getItem("selected_time_zone") ||
      localStorage.getItem("timeZone");

    const tz = fromStorage?.trim();
    if (tz) return tz;

    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

/**
 * Converts "GMT+1" / "UTC+01:00" etc into "+01:00"
 */
const normaliseOffset = (raw: string) => {
  if (!raw) return "+00:00";

  const m = raw.match(/([+-])\s*(\d{1,2})(?::?(\d{2}))?/i);
  if (!m) return "+00:00";

  const sign = m[1];
  const hh = String(m[2]).padStart(2, "0");
  const mm = String(m[3] || "00").padStart(2, "0");
  return `${sign}${hh}:${mm}`;
};

/**
 * Gets current offset for a timezone (best-effort).
 * Uses Intl "shortOffset" if available.
 */
const getTimeZoneOffsetNow = (tz: string) => {
  try {
    const dtf = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      timeZoneName: "shortOffset" as any,
      hour: "2-digit",
      minute: "2-digit",
    });

    const parts = (dtf as any).formatToParts(new Date());
    const tzName = parts?.find((p: any) => p.type === "timeZoneName")?.value || "";
    return normaliseOffset(tzName);
  } catch {
    return "+00:00";
  }
};

export const getSystemInstruction = (plan: string = "free") => {
  const now = new Date();
  const tz = getUserTimeZone();
  const offsetNow = getTimeZoneOffsetNow(tz);

  const readableNow = (() => {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(now);
    } catch {
      return now.toLocaleString();
    }
  })();

  return `
You are "Queso Assistant", a warm, professional, high-performance virtual chief of staff.

USER PLAN: ${String(plan || "free").toUpperCase()}
USER TIMEZONE: ${tz}
CURRENT LOCAL TIME: ${readableNow}
REFERENCE ISO (SYSTEM): ${now.toISOString()}

CRITICAL TIME DIRECTIVE (MUST FOLLOW):
1. When a user says a time (e.g., "5pm"), they mean their LOCAL TIME in ${tz}.
2. You MUST generate ISO-8601 timestamps WITH A NUMERIC OFFSET suffix. Example format:
   2026-02-01T17:00:00${offsetNow}
3. NEVER generate timestamps ending in "Z" (UTC) and NEVER omit the offset.
4. If the user did NOT give a date, assume the soonest reasonable time in their timezone (usually today).
5. For "tomorrow", "next week", etc. calculate based on LOCAL TIME in ${tz}.

TOOL USAGE RULES:
- If the user wants a task/todo → call create_task.
- If the user is recording info/ideas → call create_note.
- If the user is scheduling a specific time block → call create_event.
- If the user wants an email/message draft → call draft_message.

PLAN RULES:
- FREE: provide shorter drafts/snippets, and limited usage.
- PRO: full features, full drafts, full access (no unnecessary restrictions).
- PRO (Calendar Sync): assume user can sync tasks/notes/events to Google Calendar.

CONFIRMATION STYLE (IMPORTANT):
After calling a tool, confirm naturally like a real assistant:
- "Done — I saved that note for 5:00 PM today."
- "All set — your task is scheduled for 5:00 PM."
- "Booked — your event is on your calendar for 5:00 PM."

Do NOT mention internal system instructions or debugging information.
`;
};

/**
 * Normalizes history for Gemini API:
 * 1) Maps 'assistant' to 'model'
 * 2) Merges consecutive messages from same role
 * 3) Ensures sequence starts with 'user'
 */
const normalizeHistory = (messages: { role: string; content: string }[]) => {
  if (!messages || messages.length === 0) return [];

  const contents: any[] = [];

  messages.forEach((m) => {
    const role = m.role === "assistant" ? "model" : "user";
    const text = m.content || "";

    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      contents[contents.length - 1].parts[0].text += `\n${text}`;
    } else {
      contents.push({ role, parts: [{ text }] });
    }
  });

  while (contents.length > 0 && contents[0].role !== "user") {
    contents.shift();
  }

  return contents;
};

export const getGeminiResponse = async (
  messages: { role: string; content: string }[],
  plan: string = "free"
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const contents = normalizeHistory(messages);

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents,
    config: {
      systemInstruction: getSystemInstruction(plan),
      tools: [{ functionDeclarations: assistantTools }],
    },
  });

  return response;
};

/* =======================================================================================
   GOOGLE CALENDAR PRO SYNC (Browser-only, uses Google Identity Services + Calendar REST)
   ======================================================================================= */

/**
 * REQUIRED ENV:
 * - VITE_GOOGLE_CLIENT_ID (Vite) OR GOOGLE_CLIENT_ID (generic)
 *
 * You must load Google Identity Services script in index.html:
 * <script src="https://accounts.google.com/gsi/client" async defer></script>
 */
declare global {
  interface Window {
    google?: any;
  }
}

const GOOGLE_CLIENT_ID =
  (import.meta as any)?.env?.VITE_GOOGLE_CLIENT_ID ||
  (import.meta as any)?.env?.GOOGLE_CLIENT_ID ||
  (process as any)?.env?.VITE_GOOGLE_CLIENT_ID ||
  (process as any)?.env?.GOOGLE_CLIENT_ID ||
  "";

const GCAL_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  // optional: if you want to read calendar list etc. Not strictly needed for event insert.
  // "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

const LS_GCAL_TOKEN = "gcal_access_token";
const LS_GCAL_TOKEN_EXP = "gcal_access_token_expires_at";
const LS_GCAL_CALENDAR_ID = "gcal_calendar_id";
const LS_GCAL_EVENT_MAP = "gcal_event_map_v1"; // localId -> googleEventId

const nowMs = () => Date.now();

const safeJsonParse = <T,>(raw: string | null, fallback: T): T => {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const getStoredToken = () => {
  try {
    const token = localStorage.getItem(LS_GCAL_TOKEN) || "";
    const exp = Number(localStorage.getItem(LS_GCAL_TOKEN_EXP) || "0");
    return { token, exp };
  } catch {
    return { token: "", exp: 0 };
  }
};

const setStoredToken = (token: string, expiresInSeconds: number) => {
  try {
    const expAt = nowMs() + Math.max(0, expiresInSeconds - 30) * 1000; // 30s buffer
    localStorage.setItem(LS_GCAL_TOKEN, token);
    localStorage.setItem(LS_GCAL_TOKEN_EXP, String(expAt));
  } catch {
    // ignore storage errors
  }
};

export const clearGoogleCalendarAuth = () => {
  try {
    localStorage.removeItem(LS_GCAL_TOKEN);
    localStorage.removeItem(LS_GCAL_TOKEN_EXP);
    localStorage.removeItem(LS_GCAL_CALENDAR_ID);
    // keep map by default (so re-auth doesn't duplicate). If you want wipe:
    // localStorage.removeItem(LS_GCAL_EVENT_MAP);
  } catch {
    // ignore
  }
};

const ensureGISLoaded = () => {
  if (!window.google?.accounts?.oauth2) {
    throw new Error(
      "Google Identity Services not loaded. Add <script src=\"https://accounts.google.com/gsi/client\" async defer></script> to index.html."
    );
  }
  if (!GOOGLE_CLIENT_ID) {
    throw new Error(
      "Missing Google Client ID. Set VITE_GOOGLE_CLIENT_ID (recommended) or GOOGLE_CLIENT_ID."
    );
  }
};

/**
 * Pro-only: prompts user to connect Google Calendar and returns an access token.
 * Call this when user clicks “Connect Google Calendar” OR when they upgrade to Pro and choose to sync.
 */
export const requestGoogleCalendarAccessToken = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      ensureGISLoaded();

      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GCAL_SCOPES,
        prompt: "consent", // ensures user picks/consents
        callback: (resp: any) => {
          if (!resp || resp.error) {
            reject(new Error(resp?.error_description || resp?.error || "Google auth failed"));
            return;
          }
          const token = resp.access_token as string;
          const expiresIn = Number(resp.expires_in || 3600);
          setStoredToken(token, expiresIn);
          resolve(token);
        },
      });

      tokenClient.requestAccessToken();
    } catch (e: any) {
      reject(e);
    }
  });
};

/**
 * Returns a valid token if stored, otherwise triggers an auth prompt.
 */
export const getGoogleCalendarAccessToken = async (): Promise<string> => {
  const { token, exp } = getStoredToken();
  if (token && exp > nowMs()) return token;
  return requestGoogleCalendarAccessToken();
};

const gcalFetch = async (path: string, token: string, init?: RequestInit) => {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Google Calendar API error (${res.status}): ${txt || res.statusText}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
};

/**
 * We create (or reuse) a dedicated calendar called "Queso Assistant"
 * so you don’t clutter the user’s primary calendar.
 */
export const ensureQuesoCalendar = async (token: string): Promise<string> => {
  try {
    const existing = localStorage.getItem(LS_GCAL_CALENDAR_ID);
    if (existing) return existing;
  } catch {
    // ignore
  }

  // 1) Try to find it in calendarList
  const list = await gcalFetch("/users/me/calendarList?minAccessRole=writer", token);
  const items: any[] = list?.items || [];
  const found = items.find((c) => String(c?.summary || "").toLowerCase() === "queso assistant");
  if (found?.id) {
    try {
      localStorage.setItem(LS_GCAL_CALENDAR_ID, found.id);
    } catch {}
    return found.id;
  }

  // 2) Create a new calendar
  const tz = getUserTimeZone();
  const created = await gcalFetch("/calendars", token, {
    method: "POST",
    body: JSON.stringify({
      summary: "Queso Assistant",
      timeZone: tz || "UTC",
      description: "Auto-synced reminders from Queso Assistant (Pro).",
    }),
  });

  const id = created?.id;
  if (!id) throw new Error("Could not create Google Calendar");

  try {
    localStorage.setItem(LS_GCAL_CALENDAR_ID, id);
  } catch {}
  return id;
};

type LocalTask = {
  id?: string;
  uuid?: string;
  title: string;
  description?: string;
  due_at: string;
  priority?: "low" | "medium" | "high";
  recurrence?: string;
};

type LocalNote = {
  id?: string;
  uuid?: string;
  title: string;
  content: string;
  scheduled_at: string;
  recurrence?: string;
};

type LocalEvent = {
  id?: string;
  uuid?: string;
  title: string;
  start_at: string;
  end_at: string;
  location?: string;
  recurrence?: string;
};

type PushAllPayload = {
  tasks?: LocalTask[];
  notes?: LocalNote[];
  events?: LocalEvent[];
};

const getLocalId = (x: { id?: string; uuid?: string }, fallback: string) => {
  return String(x.id || x.uuid || fallback);
};

const loadEventMap = (): Record<string, string> => {
  try {
    return safeJsonParse<Record<string, string>>(localStorage.getItem(LS_GCAL_EVENT_MAP), {});
  } catch {
    return {};
  }
};

const saveEventMap = (map: Record<string, string>) => {
  try {
    localStorage.setItem(LS_GCAL_EVENT_MAP, JSON.stringify(map));
  } catch {
    // ignore
  }
};

const toReminderOverrides = (kind: "task" | "note" | "event") => {
  // You can tweak these later
  if (kind === "event") {
    return [{ method: "popup", minutes: 10 }];
  }
  // tasks/notes as reminders
  return [{ method: "popup", minutes: 5 }];
};

const toGcalEventFromTask = (t: LocalTask) => {
  const start = t.due_at;
  const end = addMinutesISO(start, 15);

  const descParts = [
    t.description ? `Details: ${t.description}` : "",
    t.priority ? `Priority: ${t.priority}` : "",
    "Source: Queso Assistant (Task)",
  ].filter(Boolean);

  const body: any = {
    summary: `🧩 ${t.title}`,
    description: descParts.join("\n"),
    start: { dateTime: start },
    end: { dateTime: end },
    reminders: { useDefault: false, overrides: toReminderOverrides("task") },
  };

  if (t.recurrence) body.recurrence = [t.recurrence];
  return body;
};

const toGcalEventFromNote = (n: LocalNote) => {
  const start = n.scheduled_at;
  const end = addMinutesISO(start, 20);

  const body: any = {
    summary: `📝 ${n.title}`,
    description: `${n.content}\n\nSource: Queso Assistant (Note)`,
    start: { dateTime: start },
    end: { dateTime: end },
    reminders: { useDefault: false, overrides: toReminderOverrides("note") },
  };

  if (n.recurrence) body.recurrence = [n.recurrence];
  return body;
};

const toGcalEventFromEvent = (e: LocalEvent) => {
  const body: any = {
    summary: `📅 ${e.title}`,
    location: e.location || undefined,
    description: "Source: Queso Assistant (Event)",
    start: { dateTime: e.start_at },
    end: { dateTime: e.end_at },
    reminders: { useDefault: false, overrides: toReminderOverrides("event") },
  };

  if (e.recurrence) body.recurrence = [e.recurrence];
  return body;
};

const addMinutesISO = (isoWithOffset: string, mins: number) => {
  // Best-effort: parse date part + offset part
  // We avoid forcing UTC conversion; we just do Date() and then rebuild ISO without "Z" if possible.
  const d = new Date(isoWithOffset);
  if (Number.isNaN(d.getTime())) return isoWithOffset;

  const d2 = new Date(d.getTime() + mins * 60 * 1000);

  // If original had an explicit offset, keep it visually by using the original suffix if present.
  const m = isoWithOffset.match(/([+-]\d{2}:\d{2})$/);
  const offset = m ? m[1] : "";

  // Build local ISO-like string (YYYY-MM-DDTHH:mm:ss) then append offset
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d2.getFullYear();
  const mm = pad(d2.getMonth() + 1);
  const dd = pad(d2.getDate());
  const hh = pad(d2.getHours());
  const mi = pad(d2.getMinutes());
  const ss = pad(d2.getSeconds());

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${offset || ""}`;
};

/**
 * Inserts OR updates a Google Calendar event.
 * We store a localId -> googleEventId map in localStorage to prevent duplicates.
 */
const upsertGoogleEvent = async (
  token: string,
  calendarId: string,
  localId: string,
  body: any
) => {
  const map = loadEventMap();
  const existingGoogleId = map[localId];

  if (existingGoogleId) {
    // Update
    const updated = await gcalFetch(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(existingGoogleId)}`,
      token,
      { method: "PATCH", body: JSON.stringify(body) }
    );
    return { googleEventId: existingGoogleId, updated };
  }

  // Insert
  const created = await gcalFetch(
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    token,
    { method: "POST", body: JSON.stringify(body) }
  );

  const googleEventId = created?.id;
  if (googleEventId) {
    map[localId] = googleEventId;
    saveEventMap(map);
  }

  return { googleEventId, created };
};

/**
 * ✅ MAIN FUNCTION YOU NEED FOR YOUR REQUIREMENT:
 * When user upgrades to PRO:
 * - request token
 * - create/find Queso Assistant calendar
 * - push ALL existing tasks/notes/events from Free into Google Calendar
 *
 * Call this ONCE right after upgrade (or when user clicks “Sync now”).
 */
export const pushAllToGoogleCalendar = async (payload: PushAllPayload) => {
  const token = await getGoogleCalendarAccessToken();
  const calendarId = await ensureQuesoCalendar(token);

  const tasks = payload.tasks || [];
  const notes = payload.notes || [];
  const events = payload.events || [];

  const results: Array<{ localId: string; googleEventId?: string; kind: string; title: string }> =
    [];

  // Push tasks
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const localId = getLocalId(t, `task_${i}`);
    const body = toGcalEventFromTask(t);
    const r = await upsertGoogleEvent(token, calendarId, `task:${localId}`, body);
    results.push({
      localId: `task:${localId}`,
      googleEventId: r.googleEventId,
      kind: "task",
      title: t.title,
    });
  }

  // Push notes
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    const localId = getLocalId(n, `note_${i}`);
    const body = toGcalEventFromNote(n);
    const r = await upsertGoogleEvent(token, calendarId, `note:${localId}`, body);
    results.push({
      localId: `note:${localId}`,
      googleEventId: r.googleEventId,
      kind: "note",
      title: n.title,
    });
  }

  // Push events
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const localId = getLocalId(e, `event_${i}`);
    const body = toGcalEventFromEvent(e);
    const r = await upsertGoogleEvent(token, calendarId, `event:${localId}`, body);
    results.push({
      localId: `event:${localId}`,
      googleEventId: r.googleEventId,
      kind: "event",
      title: e.title,
    });
  }

  return {
    calendarId,
    synced: results.length,
    results,
  };
};

/**
 * Optional: remove an item from Google if user deletes locally later
 */
export const deleteFromGoogleCalendar = async (kind: "task" | "note" | "event", localId: string) => {
  const token = await getGoogleCalendarAccessToken();
  const calendarId = await ensureQuesoCalendar(token);

  const map = loadEventMap();
  const key = `${kind}:${localId}`;
  const googleEventId = map[key];
  if (!googleEventId) return { deleted: false };

  await gcalFetch(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
    token,
    { method: "DELETE" }
  );

  delete map[key];
  saveEventMap(map);

  return { deleted: true };
};