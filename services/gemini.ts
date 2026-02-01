
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
    description: 'Create an ACTION ITEM. Use this for things the user has to DO. You MUST calculate the absolute ISO-8601 timestamp for due_at based on the CURRENT SYSTEM TIME provided.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Task title' },
        description: { type: Type.STRING, description: 'Optional details' },
        due_at: { type: Type.STRING, description: 'Absolute ISO-8601 timestamp (e.g. 2024-05-20T17:00:00Z)' },
        priority: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
        recurring_rule: { type: Type.STRING, description: 'Pro Only: DAILY, WEEKLY, etc.' },
      },
      required: ['title', 'due_at'],
    },
  },
  {
    name: 'create_note',
    description: 'Record INFORMATION or a MEMORY. Calculate the absolute scheduled_at timestamp for the entry.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Summary' },
        content: { type: Type.STRING, description: 'Full details' },
        scheduled_at: { type: Type.STRING, description: 'Absolute ISO-8601 timestamp' },
      },
      required: ['title', 'content', 'scheduled_at'],
    },
  },
  {
    name: 'create_event',
    description: 'Schedule a specific meeting on the calendar. Calculate absolute start and end times.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Event title' },
        start_at: { type: Type.STRING, description: 'ISO-8601 timestamp' },
        end_at: { type: Type.STRING, description: 'ISO-8601 timestamp' },
        location: { type: Type.STRING, description: 'Location' },
      },
      required: ['title', 'start_at', 'end_at'],
    },
  },
  {
    name: 'draft_message',
    description: 'Draft a message/email for the user to review.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        channel: { type: Type.STRING, enum: ['email', 'message'] },
        recipient: { type: Type.STRING, description: 'Recipient identifier' },
        subject: { type: Type.STRING, description: 'Email subject' },
        body: { type: Type.STRING, description: 'Content of the message' },
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
    second: '2-digit', 
    timeZoneName: 'short',
    timeZone: 'Africa/Lagos'
  };
  
  return `
You are "Queso Assistant", an elite personal virtual assistant. 
USER STATUS: ${plan.toUpperCase()}

STRICT TEMPORAL RULES:
- Current Reference Time (UTC): ${now.toISOString()}
- Current Local Time (Nigeria): ${now.toLocaleString('en-NG', options)}
- If the user says "tomorrow", calculate it relative to ${now.toLocaleDateString('en-NG', {timeZone: 'Africa/Lagos'})}.
- If the user says "at 5", and it is currently ${now.getHours()}:${now.getMinutes()}, determine if they mean AM or PM.
- ALWAYS output absolute ISO-8601 strings for tool arguments.

VOICE MODE PROTOCOLS:
- You are in LIVE AUDIO CONVERSATION.
- Keep responses concise and natural.
- Confirm specific times you have calculated for tasks/events (e.g., "I've set that for tomorrow at 5 PM").
- Maintain a helpful, calm, and professional tone.
`;
};

// Always use a new instance right before making an API call.
export const getGeminiResponse = async (messages: { role: string; content: string }[], plan: string = 'free') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: messages.map(m => ({ 
      role: m.role === 'assistant' ? 'model' : 'user', 
      parts: [{ text: m.content }] 
    })),
    config: {
      systemInstruction: getSystemInstruction(plan),
      tools: [{ functionDeclarations: assistantTools }],
    },
  });
  return response;
};
