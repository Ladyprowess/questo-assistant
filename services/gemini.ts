
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

export const cleanResponse = (text: string) => {
  return text
    .replace(/<ctrl\d+>/gi, '')
    .replace(/^[\s\n\.]+/g, '')
    .trim();
};

export const assistantTools: FunctionDeclaration[] = [
  {
    name: 'create_task',
    description: 'REQUIRED for any intent to DO something, remember a todo, or schedule a task. Calculate absolute ISO-8601 timestamps.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Direct, clear task title' },
        description: { type: Type.STRING, description: 'Contextual details' },
        due_at: { type: Type.STRING, description: 'ISO-8601 timestamp' },
        priority: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
      },
      required: ['title', 'due_at'],
    },
  },
  {
    name: 'create_note',
    description: 'REQUIRED for recording information, facts, ideas, or memories that are not tasks.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Note summary' },
        content: { type: Type.STRING, description: 'Full body text' },
        scheduled_at: { type: Type.STRING, description: 'ISO-8601 timestamp' },
      },
      required: ['title', 'content', 'scheduled_at'],
    },
  },
  {
    name: 'create_event',
    description: 'REQUIRED for scheduling specific time blocks, meetings, or appointments on the calendar.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Event name' },
        start_at: { type: Type.STRING, description: 'ISO-8601 timestamp' },
        end_at: { type: Type.STRING, description: 'ISO-8601 timestamp' },
        location: { type: Type.STRING, description: 'Physical or virtual location' },
      },
      required: ['title', 'start_at', 'end_at'],
    },
  },
  {
    name: 'draft_message',
    description: 'REQUIRED when the user wants to compose an email or message.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        channel: { type: Type.STRING, enum: ['email', 'message'] },
        recipient: { type: Type.STRING, description: 'Who this is for' },
        subject: { type: Type.STRING, description: 'Email subject line' },
        body: { type: Type.STRING, description: 'The drafted content' },
      },
      required: ['channel', 'body'],
    },
  },
];

export const getSystemInstruction = (plan: string = 'free') => {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit', 
    timeZone: 'Africa/Lagos'
  };
  
  return `
You are "Queso Assistant", a high-performance virtual chief of staff.
USER PLAN: ${plan.toUpperCase()}
CURRENT TIME (Nigeria): ${now.toLocaleString('en-NG', options)}
REFERENCE ISO: ${now.toISOString()}

CRITICAL TIME DIRECTIVE:
1. Nigeria is in WAT (UTC+1). 
2. When a user says "4pm", they mean 16:00:00 local time.
3. You MUST generate ISO strings with the +01:00 offset suffix.
4. Correct Format Example: 2024-05-20T16:00:00+01:00
5. NEVER generate timestamps with "Z" or without an offset. It causes a 1-hour drift.

CONVERSATIONAL TONE:
- Be warm, professional, and helpful.
- After calling a tool, provide a natural, written/spoken confirmation. 
- Example: "Got it! I've set that task for you for 4:00 PM today." 
- Example: "Sure thing, I've recorded that note in your cloud ledger."
- Speak like a high-end personal assistant, not a computer.
`;
};

/**
 * Normalizes history for Gemini API:
 * 1. Maps 'assistant' to 'model'.
 * 2. Merges consecutive messages from the same role.
 * 3. Ensures sequence starts with 'user'.
 * 4. Ensures alternating turns.
 */
const normalizeHistory = (messages: { role: string; content: string }[]) => {
  if (messages.length === 0) return [];

  const contents: any[] = [];
  
  messages.forEach(m => {
    const role = m.role === 'assistant' ? 'model' : 'user';
    const text = m.content || "";
    
    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      // Merge consecutive same roles
      contents[contents.length - 1].parts[0].text += `\n${text}`;
    } else {
      contents.push({ role, parts: [{ text }] });
    }
  });

  // API requires starting with 'user'
  while (contents.length > 0 && contents[0].role !== 'user') {
    contents.shift();
  }

  return contents;
};

export const getGeminiResponse = async (messages: { role: string; content: string }[], plan: string = 'free') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const contents = normalizeHistory(messages);

  // Using gemini-3-flash-preview for better quota availability and lower latency
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents,
    config: {
      systemInstruction: getSystemInstruction(plan),
      tools: [{ functionDeclarations: assistantTools }],
    },
  });
  return response;
};
