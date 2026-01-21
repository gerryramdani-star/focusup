
export type TaskStatus = 'pending' | 'done';

export type TaskPriority = 'High' | 'Medium' | 'Low' | 'Normal';

export interface Task {
  id: string;
  content: string;
  status: TaskStatus;
  priority?: TaskPriority;
  createdAt: string;
}

export interface UserSettings {
  name: string;
  apiKey: string;
  isDarkMode: boolean;
}

export enum ConnectionState {
  OFFLINE = 'OFFLINE',
  CONNECTING = 'CONNECTING',
  RECONNECTING = 'RECONNECTING',
  LISTENING = 'LISTENING',
  SPEAKING = 'SPEAKING',
  THINKING = 'THINKING',
  ERROR = 'ERROR'
}
