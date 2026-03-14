export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

export interface User {
  id: string;
  username: string;
  tag: string;
  email?: string;
  password?: string;
  hwid?: string;
  avatar?: string | null;
  banner?: string | null;
  bio?: string;
  profileColor?: string;
  status: UserStatus;
}

export interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice';
}

export interface Role {
  id: string;
  name: string;
  color: string;
  permissions: string[];
}

export interface Server {
  id: string;
  name: string;
  icon?: string | null;
  region: 'br' | 'us' | 'eu';
  channels: Channel[];
  roles: Role[];
  members: User[];
  invites: Invite[];
}

export interface Message {
  id: string;
  author: string;
  avatar?: string | null;
  text: string;
  time: string;
}

export interface Friend extends User {
  status: 'online' | 'pending' | 'blocked';
}

export interface Invite {
  id: string;
  link: string;
  expires: string;
  uses: number;
}

export interface Settings {
  theme: 'dark' | 'amoled' | 'light';
  accent: string;
  compact?: boolean;
  showOnline?: boolean;
  allowDM?: boolean;
  allowInvites?: boolean;
}
