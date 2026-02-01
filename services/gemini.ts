import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

/**
 * Cleans assistant text so it doesn't leak internal tokens or system-ish traces
 */
export const cleanResponse = (text: string) => {
  return (text || "")
    .replace(/<ctrl\d+>/gi, "")
    .replace(/^\s*\[?(system|tool|trace|debug|ledger)\]?:.*$/gim, "") // removes "system/tool/trace/debug/ledger" lines if they ever appear
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
 * Reads user's preferred timezone from localStorage (same keys we used in ChatScreen/AuditLogScreen)
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

  // Examples you may see: "GMT+1", "GMT+01:00", "UTC+01:00"
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
      timeZoneName: "shortOffset" as any, // TS compat
      hour: "2-digit",
      minute: "2-digit",
    });

    const parts = (dtf as any).formatToParts(new Date());
    const tzName = parts?.find((p: any) => p.type === "timeZoneName")?.value || "";
    // tzName can be like "GMT+1"
    return normaliseOffset(tzName);
  } catch {
    // fallback: we can't reliably compute tz offset in all environments
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
   Using "Z" causes a 1-hour drift for many users.
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
