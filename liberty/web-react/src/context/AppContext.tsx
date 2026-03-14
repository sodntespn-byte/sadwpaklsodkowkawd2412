import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { User, Server, Channel, Friend, Message, Settings } from '../types';
import { getStoredUser, setStoredUser, getStoredSettings, setStoredSettings, getStoredUsers } from '../utils/storage';
import { uuid } from '../utils/uuid';

interface AppContextType {
  currentUser: User | null;
  servers: Server[];
  currentServer: Server | null;
  currentChannel: Channel | null;
  currentDM: Friend | null;
  friends: Friend[];
  pendingFriends: Friend[];
  blockedFriends: Friend[];
  messages: Record<string, Message[]>;
  dmMessages: Record<string, Message[]>;
  settings: Settings;
  setCurrentUser: (user: User | null) => void;
  authSubmit: (name: string) => void;
  logout: () => void;
  createServer: (name: string, region: string, icon?: string) => void;
  selectServer: (id: string | null) => void;
  selectChannel: (id: string) => void;
  goHome: () => void;
  openDM: (friendId: string) => void;
  sendMessage: (text: string) => void;
  addFriend: (username: string, tag: string) => void;
  updateSettings: (s: Partial<Settings>) => void;
  updateUser: (u: Partial<User>) => void;
  toast: (msg: string, type?: 'success' | 'error') => void;
}

const defaultRoles = [
  { id: '0', name: 'Admin', color: '#FFFF00', permissions: ['admin', 'manage', 'roles', 'channels', 'kick', 'ban', 'messages', 'manage-msg'] },
  { id: '1', name: 'Moderador', color: '#FFD700', permissions: ['kick', 'ban', 'messages', 'manage-msg'] },
  { id: '2', name: '@todos', color: '#888888', permissions: ['messages'] },
];

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<User | null>(getStoredUser());
  const [servers, setServers] = useState<Server[]>([]);
  const [currentServer, setCurrentServer] = useState<Server | null>(null);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [currentDM, setCurrentDM] = useState<Friend | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingFriends, setPendingFriends] = useState<Friend[]>([]);
  const [blockedFriends, setBlockedFriends] = useState<Friend[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [dmMessages, setDmMessages] = useState<Record<string, Message[]>>({});
  const [settings, setSettingsState] = useState<Settings>(getStoredSettings());

  const setCurrentUser = useCallback((user: User | null) => {
    setCurrentUserState(user);
    setStoredUser(user);
  }, []);

  const toast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg animate-slide-up ${
      type === 'success' ? 'bg-liberty-yellow text-black' : 'bg-red-500/90 text-white'
    }`;
    el.innerHTML = `<i class="fas fa-${type === 'success' ? 'check' : 'exclamation'}-circle"></i><span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }, []);

  const authSubmit = useCallback((name: string) => {
    const trimmed = name.trim();
    const users = getStoredUsers();
    const existing = users[trimmed];
    
    if (existing) {
      setCurrentUser(existing);
      toast('Bem-vindo de volta!');
    } else {
      const user: User = {
        id: uuid(),
        username: trimmed,
        tag: '#' + String(Math.floor(Math.random() * 10000)).padStart(4, '0'),
        email: '',
        avatar: null,
        banner: null,
        bio: '',
        profileColor: '#FFFF00',
        status: 'online',
      };
      users[trimmed] = user;
      localStorage.setItem('liberty_users', JSON.stringify(users));
      setCurrentUser(user);
      toast('Conta criada! Adicione email, senha e HWID em Configurações > MultiFactor Authentication.');
    }
  }, [setCurrentUser, toast]);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setCurrentServer(null);
    setCurrentChannel(null);
    setCurrentDM(null);
    toast('Até logo!');
  }, [setCurrentUser, toast]);

  const createServer = useCallback((name: string, region: string, icon?: string) => {
    if (!currentUser) return;
    const server: Server = {
      id: uuid(),
      name,
      icon: icon || null,
      region: region as 'br' | 'us' | 'eu',
      channels: [
        { id: uuid(), name: 'geral', type: 'text' },
        { id: uuid(), name: 'voz', type: 'voice' },
      ],
      roles: JSON.parse(JSON.stringify(defaultRoles)),
      members: [{ ...currentUser, roles: ['Admin'], status: 'online' }],
      invites: [],
    };
    setServers((s) => [...s, server]);
    setCurrentServer(server);
    setCurrentChannel(null);
    setCurrentDM(null);
    const ch = server.channels.find((c) => c.type === 'text');
    if (ch) setCurrentChannel(ch);
    toast(`"${name}" criado!`);
  }, [currentUser, toast]);

  const selectServer = useCallback((id: string | null) => {
    if (!id) {
      setCurrentServer(null);
      setCurrentChannel(null);
      setCurrentDM(null);
      return;
    }
    const server = servers.find((s) => s.id === id);
    if (!server) return;
    setCurrentServer(server);
    setCurrentChannel(null);
    setCurrentDM(null);
    const ch = server.channels.find((c) => c.type === 'text');
    if (ch) setCurrentChannel(ch);
  }, [servers]);

  const selectChannel = useCallback((id: string) => {
    const ch = currentServer?.channels.find((c) => c.id === id);
    if (!ch) return;
    setCurrentChannel(ch);
    setCurrentDM(null);
  }, [currentServer]);

  const goHome = useCallback(() => {
    setCurrentServer(null);
    setCurrentChannel(null);
    setCurrentDM(null);
  }, []);

  const openDM = useCallback((friendId: string) => {
    const friend = friends.find((f) => f.id === friendId);
    if (!friend) return;
    setCurrentDM(friend);
    setCurrentChannel(null);
  }, [friends]);

  const sendMessage = useCallback((text: string) => {
    if (!currentUser || !text.trim()) return;
    const msg: Message = {
      id: uuid(),
      author: currentUser.username,
      avatar: currentUser.avatar,
      text: text.trim(),
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
    if (currentDM) {
      setDmMessages((m) => ({
        ...m,
        [currentDM.id]: [...(m[currentDM.id] || []), msg],
      }));
    } else if (currentChannel) {
      setMessages((m) => ({
        ...m,
        [currentChannel.id]: [...(m[currentChannel.id] || []), msg],
      }));
    } else {
      toast('Selecione um canal ou amigo para enviar mensagens', 'error');
    }
  }, [currentUser, currentDM, currentChannel, toast]);

  const addFriend = useCallback((username: string, tag: string) => {
    const friend: Friend = {
      id: uuid(),
      username,
      tag: '#' + tag.replace('#', ''),
      email: '',
      status: 'pending',
      avatar: null,
      banner: null,
      bio: '',
      profileColor: '#FFFF00',
    };
    setPendingFriends((p) => [...p, friend]);
    toast(`Convite enviado para ${username}`);
  }, [toast]);

  const updateSettings = useCallback((s: Partial<Settings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...s };
      setStoredSettings(next);
      return next;
    });
  }, []);

  const updateUser = useCallback((u: Partial<User>) => {
    if (!currentUser) return;
    setCurrentUser({ ...currentUser, ...u });
  }, [currentUser, setCurrentUser]);

  return (
    <AppContext.Provider
      value={{
        currentUser,
        servers,
        currentServer,
        currentChannel,
        currentDM,
        friends,
        pendingFriends,
        blockedFriends,
        messages,
        dmMessages,
        settings,
        setCurrentUser,
        authSubmit,
        logout,
        createServer,
        selectServer,
        selectChannel,
        goHome,
        openDM,
        sendMessage,
        addFriend,
        updateSettings,
        updateUser,
        toast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
