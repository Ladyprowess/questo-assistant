
export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'doing' | 'done';
export type EventSource = 'internal' | 'google_calendar';
export type ReminderType = 'task' | 'event' | 'custom';
export type ReminderStatus = 'scheduled' | 'sent' | 'cancelled';
export type DraftChannel = 'email' | 'sms' | 'whatsapp' | 'dm';
export type DraftStatus = 'draft' | 'approved' | 'sent' | 'cancelled';
export type SubscriptionPlan = 'free' | 'basic' | 'pro';

export interface Profile {
  id: string;
  full_name: string;
  timezone: string;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  priority: Priority;
  status: TaskStatus;
  recurring_rule: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  location: string | null;
  attendees: any[];
  source: EventSource;
  // UI-only property to track sync status in deduplicated lists
  isSynced?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  tags: string[] | null;
  scheduled_at: string | null; // Added time field for notes
  created_at: string;
  updated_at: string;
}

export interface AssistantAction {
  id: string;
  user_id: string;
  action_type: string;
  input_payload: any;
  result_payload: any;
  created_at: string;
}

export interface Draft {
  id: string;
  user_id: string;
  channel: DraftChannel;
  recipient: string;
  subject: string | null;
  body: string;
  status: DraftStatus;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: 'active' | 'inactive' | 'cancelled';
  current_period_end: string | null;
}
