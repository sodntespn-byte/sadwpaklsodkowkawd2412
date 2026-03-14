import type { User, Settings } from '../types';

const USER_KEY = 'liberty_user';
const USERS_KEY = 'liberty_users';
const SETTINGS_KEY = 'liberty_settings';

export function getStoredUser(): User | null {
  const s = localStorage.getItem(USER_KEY);
  return s ? JSON.parse(s) : null;
}

export function getStoredUsers(): Record<string, User> {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function setStoredUser(user: User | null): void {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    const users = getStoredUsers();
    users[user.username] = user;
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

export function getStoredSettings(): Settings {
  const s = localStorage.getItem(SETTINGS_KEY);
  return s ? JSON.parse(s) : { theme: 'dark', accent: '#FFFF00' };
}

export function setStoredSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
