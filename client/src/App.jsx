import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Camera,
  CheckCheck,
  CheckCircle2,
  Edit3,
  File,
  ArrowLeft,
  Bell,
  Accessibility,
  Database,
  Globe2,
  HelpCircle,
  Image,
  KeyRound,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  MessageSquareText,
  Mic,
  Moon,
  Paperclip,
  Palette,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Smile,
  Sparkles,
  Sun,
  Trash2,
  UserCog,
  UserPlus,
  Wifi,
  X
} from 'lucide-react';
import { apiFetch, API_URL } from './lib/api.js';
import { hasSupabaseConfig, supabase } from './lib/supabase.js';

const EMOJIS = ['😀', '😂', '😍', '🔥', '👍', '🙏', '🎉', '❤️', '😎', '😢', '🤝', '🚀'];

const SETTINGS_SECTIONS = [
  { id: 'account', title: 'Account', subtitle: 'Profile, password, sessions', icon: UserCog },
  { id: 'privacy', title: 'Privacy', subtitle: 'Friend requests and visibility', icon: LockKeyhole },
  { id: 'chats', title: 'Chats', subtitle: 'Theme, font size, chat history', icon: MessageSquareText },
  { id: 'notifications', title: 'Notifications', subtitle: 'Messages, requests, sounds', icon: Bell },
  { id: 'storage', title: 'Storage and data', subtitle: 'Uploads and media usage', icon: Database },
  { id: 'accessibility', title: 'Accessibility', subtitle: 'Motion, contrast, readability', icon: Accessibility },
  { id: 'language', title: 'App language', subtitle: 'English and locale settings', icon: Globe2 },
  { id: 'help', title: 'Help and feedback', subtitle: 'Privacy policy and support', icon: HelpCircle },
  { id: 'invite', title: 'Invite a friend', subtitle: 'Share your chat app', icon: UserPlus }
];

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setAuthLoading(false);
      return undefined;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (!hasSupabaseConfig) return <SetupScreen />;
  if (authLoading) return <div className="screen-center"><span className="loader" /> Loading chat...</div>;
  return session ? <Chat session={session} /> : <AuthScreen />;
}

function SetupScreen() {
  return (
    <main className="setup-shell">
      <section className="setup-hero">
        <span className="app-badge"><MessageCircle size={18} /> Small Chat</span>
        <h1>Connect Supabase to open your chat app.</h1>
        <p>Create <strong>client/.env</strong> with the browser-safe Supabase URL and anon key, then restart the dev server.</p>
        <div className="env-card">
          <code>VITE_SUPABASE_URL=https://your-project-id.supabase.co</code>
          <code>VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key</code>
          <code>VITE_API_URL=http://localhost:4000</code>
        </div>
      </section>
      <section className="setup-panel">
        <SetupStep icon={<KeyRound size={20} />} title="Project Settings" text="Copy Project URL and anon/publishable key." />
        <SetupStep icon={<ShieldCheck size={20} />} title="SQL Editor" text="Run supabase/schema.sql once." />
        <SetupStep icon={<Wifi size={20} />} title="Restart Vite" text="Use Ctrl+C, then npm run dev." />
      </section>
    </main>
  );
}

function SetupStep({ icon, title, text }) {
  return (
    <div className="setup-step">
      {icon}
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setStatus('');

    const authCall = mode === 'signup'
      ? supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName || email.split('@')[0] },
            emailRedirectTo: window.location.origin
          }
        })
      : supabase.auth.signInWithPassword({ email, password });

    const { error } = await authCall;
    setLoading(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    if (mode === 'signup') {
      setStatus('Account created. Check your inbox if email confirmation is enabled.');
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-copy">
        <span className="app-badge"><MessageCircle size={18} /> Small Chat</span>
        <h1>Private realtime chats for a small team.</h1>
        <p>A clean Socket.IO messenger backed by Supabase Auth and Postgres.</p>
        <div className="feature-grid">
          <span><CheckCircle2 size={18} /> Email login</span>
          <span><Wifi size={18} /> Live messages</span>
          <span><ShieldCheck size={18} /> Supabase RLS</span>
        </div>
      </section>
      <section className="auth-panel">
        <div className="panel-heading">
          <div className="brand-mark"><MessageCircle size={26} /></div>
          <span>
            <h2>{mode === 'signup' ? 'Create account' : 'Welcome back'}</h2>
            <p>{mode === 'signup' ? 'Set up your profile in a few seconds.' : 'Sign in to continue your chats.'}</p>
          </span>
        </div>

        <div className="mode-tabs" role="tablist">
          <button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>Sign in</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Create account</button>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && (
            <label>
              Display name
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" />
            </label>
          )}
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" required />
          </label>
          <button className="primary-button" disabled={loading}>{loading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}</button>
        </form>

        {status && <p className="form-status">{status}</p>}
      </section>
    </main>
  );
}

function Chat({ session }) {
  const token = session.access_token;
  const currentUserId = session.user.id;
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);
  const messageListRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const typingTimerRef = useRef(null);
  const activeIdRef = useRef(null);
  const readMessageIdsRef = useRef(new Set());
  const loadedConversationRef = useRef(null);
  const conversationsRef = useRef([]);

  const [profile, setProfile] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesCursor, setMessagesCursor] = useState(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [newChatQuery, setNewChatQuery] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [sidebarTab, setSidebarTab] = useState('chats');
  const [settingsCategory, setSettingsCategory] = useState('account');
  const [allUsers, setAllUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [notice, setNotice] = useState('');
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [profileModal, setProfileModal] = useState(null);
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem('soundOn') !== 'false');
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [incomingToasts, setIncomingToasts] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const activeConversation = conversations.find((item) => item.id === activeId);
  const activeBuddy = activeConversation ? otherParticipant(activeConversation, currentUserId) : null;

  const visibleConversations = useMemo(() => {
    const value = chatSearch.trim().toLowerCase();
    if (!value) return conversations;
    return conversations.filter((conversation) => conversationLabel(conversation, currentUserId).toLowerCase().includes(value));
  }, [chatSearch, conversations, currentUserId]);

  const visibleUsers = useMemo(() => {
    const value = newChatQuery.trim().toLowerCase();
    if (!value) return allUsers;
    return allUsers.filter((user) => (
      user.display_name?.toLowerCase().includes(value)
      || user.email?.toLowerCase().includes(value)
    ));
  }, [allUsers, newChatQuery]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('soundOn', String(soundOn));
  }, [soundOn]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [meResponse, conversationsResponse] = await Promise.all([
          apiFetch('/api/me', token),
          apiFetch('/api/conversations', token)
        ]);
        setProfile(meResponse.profile);
        setConversations(conversationsResponse.conversations);
        setActiveId(null);
        loadSocialData();
      } catch (error) {
        setNotice(error.message);
      }
    }

    loadInitialData();
  }, [token]);

  useEffect(() => {
    const socket = io(API_URL, { auth: { token } });
    socketRef.current = socket;

    socket.on('connect_error', (error) => setNotice(error.message));
    socket.on('conversation:upsert', (conversation) => {
      setConversations((current) => upsertConversation(current, conversation));
      loadSocialData();
    });
    socket.on('friend-request:new', () => {
      loadSocialData();
      addSimpleNotification({
        type: 'friend-request',
        title: 'New friend request',
        body: 'Open notifications to respond'
      });
      setIncomingToasts((current) => [{
        id: `friend-${Date.now()}`,
        title: 'New friend request',
        body: 'Open All Users to respond'
      }, ...current].slice(0, 3));
    });
    socket.on('friend-request:update', () => {
      loadSocialData();
    });
    socket.on('message:new', (message) => {
      if (message.conversationId === activeIdRef.current) {
        setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
        setTimeout(scrollMessagesToBottom, 0);
      } else if (message.senderId !== currentUserId) {
        setUnreadCounts((current) => ({
          ...current,
          [message.conversationId]: (current[message.conversationId] || 0) + 1
        }));
        addMessageNotification(message);
        showIncomingToast(message);
      }
      if (message.senderId !== currentUserId) playNotify(soundOn);
      if (message.conversationId === activeIdRef.current && message.senderId !== currentUserId) {
        markMessagesRead(activeIdRef.current, [message]);
      }
    });
    socket.on('message:update', (message) => {
      if (message.conversationId === activeIdRef.current) {
        setMessages((current) => current.map((item) => item.id === message.id ? message : item));
      }
    });
    socket.on('receipt:update', ({ readerId, readAt, messageIds }) => {
      setMessages((current) => current.map((message) => (
        messageIds.includes(message.id)
          ? upsertReceipt(message, { profileId: readerId, readAt })
          : message
      )));
    });
    socket.on('typing:start', ({ userId }) => {
      if (userId !== currentUserId) setTypingUsers((current) => new Set([...current, userId]));
    });
    socket.on('typing:stop', ({ userId }) => {
      setTypingUsers((current) => {
        const next = new Set(current);
        next.delete(userId);
        return next;
      });
    });
    socket.on('presence:online', ({ userId }) => {
      setOnlineUsers((current) => new Set([...current, userId]));
    });
    socket.on('presence:offline', ({ userId, lastSeenAt }) => {
      setOnlineUsers((current) => {
        const next = new Set(current);
        next.delete(userId);
        return next;
      });
      if (lastSeenAt) {
        setConversations((current) => updateParticipant(current, userId, { lastSeenAt }));
      }
    });

    return () => socket.disconnect();
  }, [currentUserId, soundOn, token]);

  useEffect(() => {
    if (!activeId || !socketRef.current) {
      setMessages([]);
      setMessagesCursor(null);
      setHasOlderMessages(false);
      return;
    }

    socketRef.current.emit('conversation:join', { conversationId: activeId });
    setUnreadCounts((current) => ({ ...current, [activeId]: 0 }));
    loadedConversationRef.current = activeId;
    readMessageIdsRef.current = new Set();
    apiFetch(`/api/conversations/${activeId}/messages?limit=30`, token)
      .then((response) => {
        if (loadedConversationRef.current !== activeId) return;
        setMessages(response.messages);
        setMessagesCursor(response.nextCursor);
        setHasOlderMessages(response.hasMore);
        markMessagesRead(activeId, response.messages);
        setTimeout(scrollMessagesToBottom, 0);
      })
      .catch((error) => setNotice(error.message));
  }, [activeId, token]);

  useEffect(() => {
    setTimeout(scrollMessagesToBottom, 0);
  }, [activeId]);

  async function startChat(target = newChatQuery) {
    const value = String(target).trim();
    if (!value) return;

    setNotice('');
    try {
      const body = value.includes('@') ? { email: value } : { profileId: value };
      const { conversation } = await apiFetch('/api/conversations/direct', token, {
        method: 'POST',
        body: JSON.stringify(body)
      });
      setConversations((current) => upsertConversation(current, conversation));
      setActiveId(conversation.id);
      setNewChatQuery('');
      setMobileChatOpen(true);
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function loadSocialData() {
    try {
      const [usersResponse, friendsResponse, requestsResponse] = await Promise.all([
        apiFetch('/api/users', token),
        apiFetch('/api/friends', token),
        apiFetch('/api/friend-requests', token)
      ]);
      setAllUsers(usersResponse.users);
      setFriends(friendsResponse.friends);
      setFriendRequests(requestsResponse.requests);
      setNotifications((current) => syncRequestNotifications(current, requestsResponse.requests));
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function sendRequest(recipientId) {
    try {
      await apiFetch('/api/friend-requests', token, {
        method: 'POST',
        body: JSON.stringify({ recipientId })
      });
      await loadSocialData();
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function respondToRequest(requestId, action) {
    try {
      const response = await apiFetch(`/api/friend-requests/${requestId}/${action}`, token, {
        method: 'POST',
        body: JSON.stringify({})
      });
      if (response.conversation) {
        setConversations((current) => upsertConversation(current, response.conversation));
      }
      await loadSocialData();
    } catch (error) {
      setNotice(error.message);
    }
  }

  function openFriendChat(friendId) {
    const conversation = conversations.find((item) => item.participants.some((participant) => participant.id === friendId));
    if (conversation) {
      openConversation(conversation.id);
      return;
    }
    startChat(friendId);
  }

  function openConversation(conversationId) {
    setActiveId(conversationId);
    setMobileChatOpen(true);
    setUnreadCounts((current) => ({ ...current, [conversationId]: 0 }));
    setNotifications((current) => current.filter((item) => item.conversationId !== conversationId));
  }

  async function loadOlderMessages() {
    if (!activeId || !messagesCursor || loadingOlder) return;

    const list = messageListRef.current;
    const previousHeight = list?.scrollHeight || 0;
    setLoadingOlder(true);
    try {
      const response = await apiFetch(`/api/conversations/${activeId}/messages?limit=30&before=${encodeURIComponent(messagesCursor)}`, token);
      setMessages((current) => mergeMessages(response.messages, current));
      setMessagesCursor(response.nextCursor);
      setHasOlderMessages(response.hasMore);
      setTimeout(() => {
        if (list) {
          list.scrollTop = list.scrollHeight - previousHeight;
        }
      }, 0);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoadingOlder(false);
    }
  }

  async function sendMessage(event) {
    event?.preventDefault();
    if (editing) {
      socketRef.current?.emit('message:edit', { messageId: editing.id, body: draft }, handleAck);
      setEditing(null);
      setDraft('');
      return;
    }

    const body = draft.trim();
    if ((!body && !selectedFiles.length) || !activeId || !socketRef.current) return;

    setUploading(true);
    try {
      const attachments = await uploadChatFiles(selectedFiles, currentUserId);
      socketRef.current.emit('message:send', { conversationId: activeId, body, attachments }, handleAck);
      setDraft('');
      setSelectedFiles([]);
      socketRef.current.emit('typing:stop', { conversationId: activeId });
    } catch (error) {
      setNotice(error.message);
    } finally {
      setUploading(false);
    }
  }

  function handleAck(response) {
    if (!response?.ok) {
      setNotice(response?.error || 'Action failed');
    }
  }

  function markMessagesRead(conversationId, candidateMessages) {
    if (!conversationId || !socketRef.current) return;

    const unreadIds = candidateMessages
      .filter((message) => message.senderId !== currentUserId && !message.receipts?.some((receipt) => receipt.profileId === currentUserId))
      .map((message) => message.id)
      .filter((messageId) => !readMessageIdsRef.current.has(messageId));

    if (!unreadIds.length) return;

    unreadIds.forEach((messageId) => readMessageIdsRef.current.add(messageId));
    socketRef.current.emit('message:read', { conversationId, messageIds: unreadIds }, (response) => {
      if (!response?.ok) {
        unreadIds.forEach((messageId) => readMessageIdsRef.current.delete(messageId));
      }
    });
  }

  function scrollMessagesToBottom() {
    const list = messageListRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }

  function showIncomingToast(message) {
    const conversation = conversationsRef.current.find((item) => item.id === message.conversationId);
    const senderName = message.sender?.display_name || message.sender?.email || 'New message';
    const preview = message.deletedAt
      ? 'Message deleted'
      : message.body || message.attachments?.[0]?.name || 'Sent an attachment';
    const toast = {
      id: `${message.id}-${Date.now()}`,
      conversationId: message.conversationId,
      title: conversation ? conversationLabel(conversation, currentUserId) : senderName,
      body: preview
    };

    setIncomingToasts((current) => [toast, ...current].slice(0, 3));
    setTimeout(() => {
      setIncomingToasts((current) => current.filter((item) => item.id !== toast.id));
    }, 4500);
  }

  function addSimpleNotification(notification) {
    playNotify(soundOn);
    const item = {
      id: `${notification.type}-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...notification
    };
    setNotifications((current) => [item, ...current].slice(0, 20));
  }

  function addMessageNotification(message) {
    const conversation = conversationsRef.current.find((item) => item.id === message.conversationId);
    const senderName = message.sender?.display_name || message.sender?.email || 'New message';
    const preview = message.body || message.attachments?.[0]?.name || 'Sent an attachment';
    const item = {
      id: `message-${message.id}`,
      type: 'message',
      conversationId: message.conversationId,
      title: conversation ? conversationLabel(conversation, currentUserId) : senderName,
      body: preview,
      createdAt: message.createdAt || new Date().toISOString()
    };

    setNotifications((current) => [item, ...current.filter((existing) => existing.id !== item.id)].slice(0, 20));
  }

  function handleTyping(value) {
    setDraft(value);
    if (!activeId || !socketRef.current) return;

    socketRef.current.emit('typing:start', { conversationId: activeId });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socketRef.current?.emit('typing:stop', { conversationId: activeId });
    }, 900);
  }

  async function toggleRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => audioChunksRef.current.push(event.data);
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const file = new window.File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
        setSelectedFiles((current) => [...current, file]);
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (error) {
      setNotice(error.message);
    }
  }

  function beginEdit(message) {
    setEditing(message);
    setDraft(message.body);
  }

  function deleteOwnMessage(messageId) {
    socketRef.current?.emit('message:delete', { messageId }, handleAck);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  function refreshCurrentProfile(nextProfile) {
    setProfile(nextProfile);
    setConversations((current) => updateParticipant(current, nextProfile.id, nextProfile));
  }

  const buddyStatus = activeBuddy && onlineUsers.has(activeBuddy.id)
    ? 'Online'
    : activeBuddy?.lastSeenAt
      ? `Last seen ${formatRelative(activeBuddy.lastSeenAt)}`
      : 'Offline';
  const incomingRequestCount = friendRequests.filter((request) => request.direction === 'incoming').length;
  const messageNotificationCount = notifications.filter((item) => item.type !== 'friend-request').length;
  const notificationCount = incomingRequestCount + messageNotificationCount;

  return (
    <main className={`chat-shell ${mobileChatOpen ? 'mobile-chat-open' : ''}`}>
      <aside className="sidebar">
        <header className="sidebar-header">
          <button className={`icon-button menu-toggle ${sidebarTab === 'settings' ? 'active-tool' : ''}`} onClick={() => { setSidebarTab('settings'); setActiveId(null); setMobileChatOpen(false); }} title="Menu" aria-label="Menu">
            <Menu size={18} />
          </button>
          <button className="profile-chip" onClick={() => setProfileModal({ type: 'self', profile })}>
            <Avatar profile={profile} label={profile?.display_name || session.user.email} />
            <span>
              <strong>{profile?.display_name || session.user.email}</strong>
              <small className="eyebrow">Signed in</small>
            </span>
          </button>
          <div className="header-actions">
            <div className="notification-wrap">
              <button className={`icon-button ${sidebarTab === 'notifications' ? 'active-tool' : ''}`} onClick={() => setSidebarTab('notifications')} title="Notifications" aria-label="Notifications">
                <Bell size={18} />
                {notificationCount > 0 && <b className="header-badge">{notificationCount}</b>}
              </button>
            </div>
          </div>
        </header>

        <form className="new-chat" onSubmit={(event) => { event.preventDefault(); setSidebarTab('users'); }}>
          <input value={newChatQuery} onChange={(event) => { setNewChatQuery(event.target.value); setSidebarTab('users'); }} placeholder="Find users to request" />
          <button className="icon-button filled" title="Find users" aria-label="Find users"><Search size={18} /></button>
        </form>

        <div className="sidebar-tabs">
          <button className={sidebarTab === 'chats' ? 'active' : ''} onClick={() => setSidebarTab('chats')}>Chats</button>
          <button className={sidebarTab === 'friends' ? 'active' : ''} onClick={() => setSidebarTab('friends')}>Friends</button>
          <button className={sidebarTab === 'users' ? 'active' : ''} onClick={() => setSidebarTab('users')}>All Users</button>
        </div>

        {sidebarTab === 'settings' && (
          <div className="conversation-list settings-list">
            <div className="settings-profile">
              <Avatar profile={profile} label={profile?.display_name || session.user.email} large />
              <span>
                <strong>{profile?.display_name || session.user.email}</strong>
                <small>{session.user.email}</small>
              </span>
            </div>
            {SETTINGS_SECTIONS.map((section) => {
              const Icon = section.icon;
              return (
                <button key={section.id} className={`settings-row ${settingsCategory === section.id ? 'active' : ''}`} onClick={() => { setSettingsCategory(section.id); setActiveId(null); setMobileChatOpen(true); }}>
                  <Icon size={22} />
                  <span>
                    <strong>{section.title}</strong>
                    <small>{section.subtitle}</small>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {sidebarTab === 'notifications' && (
          <div className="conversation-list notification-section">
            <div className="section-heading">
              <strong>Notifications</strong>
              {messageNotificationCount > 0 && <button onClick={() => setNotifications((current) => current.filter((item) => item.type === 'friend-request'))}>Clear messages</button>}
            </div>
            {friendRequests.filter((request) => request.direction === 'incoming').map((request) => (
              <div key={request.id} className="notification-item request">
                <Avatar profile={request.requester} />
                <span>
                  <strong>{request.requester.display_name}</strong>
                  <small>Sent you a friend request</small>
                </span>
                <button onClick={() => respondToRequest(request.id, 'accept')}>Accept</button>
                <button className="ghost-action" onClick={() => respondToRequest(request.id, 'reject')}>Reject</button>
              </div>
            ))}
            {notifications.filter((item) => item.type !== 'friend-request').map((item) => (
              <button key={item.id} className="notification-item" onClick={() => item.conversationId && openConversation(item.conversationId)}>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.body}</small>
                </span>
              </button>
            ))}
            {!notifications.length && !friendRequests.some((request) => request.direction === 'incoming') && (
              <p className="empty-state compact">No notifications yet.</p>
            )}
          </div>
        )}

        {sidebarTab === 'chats' && (
          <>
            <label className="search-box">
              <Search size={17} />
              <input value={chatSearch} onChange={(event) => setChatSearch(event.target.value)} placeholder="Filter chats" />
            </label>

            <div className="conversation-list">
              {visibleConversations.map((conversation) => {
                const other = otherParticipant(conversation, currentUserId);
                const active = conversation.id === activeId;
                return (
                  <button key={conversation.id} className={`conversation-row ${active ? 'active' : ''}`} onClick={() => openConversation(conversation.id)}>
                    <Avatar profile={other} label={conversationLabel(conversation, currentUserId)} online={other && onlineUsers.has(other.id)} />
                    <span>
                      <strong>{conversationLabel(conversation, currentUserId)}</strong>
                      <small>{other && onlineUsers.has(other.id) ? 'Online' : other?.lastSeenAt ? `Last seen ${formatRelative(other.lastSeenAt)}` : formatDate(conversation.updatedAt)}</small>
                    </span>
                    {Boolean(unreadCounts[conversation.id]) && <b className="unread-badge">{unreadCounts[conversation.id]}</b>}
                  </button>
                );
              })}
              {!visibleConversations.length && <p className="empty-state">No conversations yet.</p>}
            </div>
          </>
        )}

        {sidebarTab === 'friends' && (
          <div className="conversation-list social-list">
            {friends.map((friend) => (
              <div key={friend.id} className="social-row">
                <Avatar profile={friend} online={onlineUsers.has(friend.id)} />
                <span>
                  <strong>{friend.display_name}</strong>
                  <small>{onlineUsers.has(friend.id) ? 'Online' : friend.lastSeenAt ? `Last seen ${formatRelative(friend.lastSeenAt)}` : friend.email}</small>
                </span>
                <button onClick={() => openFriendChat(friend.id)}>Chat</button>
              </div>
            ))}
            {!friends.length && <p className="empty-state">Accepted friends will appear here.</p>}
          </div>
        )}

        {sidebarTab === 'users' && (
          <div className="conversation-list social-list">
            {friendRequests.filter((request) => request.direction === 'incoming').map((request) => (
              <div key={request.id} className="social-row request-row">
                <Avatar profile={request.requester} />
                <span>
                  <strong>{request.requester.display_name}</strong>
                  <small>Wants to connect</small>
                </span>
                <button onClick={() => respondToRequest(request.id, 'accept')}>Accept</button>
                <button className="ghost-action" onClick={() => respondToRequest(request.id, 'reject')}>Reject</button>
              </div>
            ))}
            {visibleUsers.map((user) => (
              <div key={user.id} className="social-row">
                <Avatar profile={user} online={onlineUsers.has(user.id)} />
                <span>
                  <strong>{user.display_name}</strong>
                  <small>{user.email}</small>
                </span>
                <RelationshipAction user={user} onRequest={sendRequest} onChat={openFriendChat} />
              </div>
            ))}
            {!visibleUsers.length && <p className="empty-state">No registered users found.</p>}
          </div>
        )}
      </aside>

      <section className={`chat-panel ${sidebarTab === 'settings' ? 'settings-mode' : ''}`}>
        {sidebarTab === 'settings' ? (
          <SettingsDetail
            category={settingsCategory}
            profile={profile}
            theme={theme}
            setTheme={setTheme}
            soundOn={soundOn}
            setSoundOn={setSoundOn}
            setProfileModal={setProfileModal}
            signOut={signOut}
            onBack={() => setMobileChatOpen(false)}
          />
        ) : activeConversation ? (
          <>
            <header className="chat-header">
              <button className="icon-button mobile-back" onClick={() => setMobileChatOpen(false)} title="Back to chats" aria-label="Back to chats">
                <ArrowLeft size={18} />
              </button>
              <button className="chat-person" onClick={() => setProfileModal({ type: 'buddy', profile: activeBuddy })}>
                <Avatar profile={activeBuddy} label={conversationLabel(activeConversation, currentUserId)} online={activeBuddy && onlineUsers.has(activeBuddy.id)} />
                <span>
                  <strong>{conversationLabel(activeConversation, currentUserId)}</strong>
                  <small><Sparkles size={14} /> {typingUsers.size ? 'typing...' : buddyStatus}</small>
                </span>
              </button>
            </header>

            <div className="message-list" ref={messageListRef}>
              {hasOlderMessages && (
                <button className="load-older" onClick={loadOlderMessages} disabled={loadingOlder}>
                  {loadingOlder ? 'Loading...' : 'Load older messages'}
                </button>
              )}
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  own={message.senderId === currentUserId}
                  isRead={message.senderId === currentUserId && message.receipts?.some((receipt) => receipt.profileId !== currentUserId)}
                  onEdit={beginEdit}
                  onDelete={deleteOwnMessage}
                />
              ))}
            </div>

            {selectedFiles.length > 0 && (
              <div className="attachment-preview">
                {selectedFiles.map((file, index) => (
                  <span key={`${file.name}-${index}`}>
                    {file.type.startsWith('image/') ? <Image size={16} /> : <File size={16} />}
                    {file.name}
                    <button onClick={() => setSelectedFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>x</button>
                  </span>
                ))}
              </div>
            )}

            {editing && (
              <div className="editing-strip">
                <span>Editing message</span>
                <button onClick={() => { setEditing(null); setDraft(''); }}>Cancel</button>
              </div>
            )}

            <form className="composer rich" onSubmit={sendMessage}>
              <input ref={fileInputRef} className="hidden-file" type="file" multiple onChange={(event) => setSelectedFiles([...event.target.files])} />
              <button type="button" className="icon-button" onClick={() => fileInputRef.current?.click()} title="Attach files" aria-label="Attach files"><Paperclip size={18} /></button>
              <button type="button" className="icon-button" onClick={() => setEmojiOpen(!emojiOpen)} title="Emoji" aria-label="Emoji"><Smile size={18} /></button>
              <input value={draft} onChange={(event) => handleTyping(event.target.value)} placeholder={editing ? 'Edit message' : 'Type a message'} />
              <button type="button" className={`icon-button ${recording ? 'danger' : ''}`} onClick={toggleRecording} title="Voice message" aria-label="Voice message"><Mic size={18} /></button>
              <button className="icon-button filled" title="Send" aria-label="Send" disabled={uploading}><Send size={18} /></button>
              {emojiOpen && (
                <div className="emoji-picker">
                  {EMOJIS.map((emoji) => <button type="button" key={emoji} onClick={() => setDraft((value) => value + emoji)}>{emoji}</button>)}
                </div>
              )}
            </form>
          </>
        ) : (
          <div className="no-chat">
            <MessageCircle size={48} />
            <h2>Small Chat</h2>
            <p>Your private friend-circle messenger is ready.</p>
          </div>
        )}
      </section>

      {profileModal && (
        <ProfileModal
          modal={profileModal}
          currentUserId={currentUserId}
          onClose={() => setProfileModal(null)}
          onSaved={refreshCurrentProfile}
          setNotice={setNotice}
        />
      )}

      {notice && <button className="toast" onClick={() => setNotice('')}>{notice}</button>}
      <div className="incoming-toast-stack">
        {incomingToasts.map((toast) => (
          <button key={toast.id} className="incoming-toast" onClick={() => { if (toast.conversationId) openConversation(toast.conversationId); setIncomingToasts((current) => current.filter((item) => item.id !== toast.id)); }}>
            <strong>{toast.title}</strong>
            <span>{toast.body}</span>
          </button>
        ))}
      </div>
    </main>
  );
}

function RelationshipAction({ user, onRequest, onChat }) {
  const relationship = user.relationship || { status: 'none' };

  if (relationship.status === 'friend') {
    return <button onClick={() => onChat(user.id)}>Chat</button>;
  }

  if (relationship.status === 'pending' && relationship.direction === 'outgoing') {
    return <button disabled>Requested</button>;
  }

  if (relationship.status === 'pending' && relationship.direction === 'incoming') {
    return <button disabled>Pending</button>;
  }

  if (relationship.status === 'rejected') {
    return <button onClick={() => onRequest(user.id)}>Request again</button>;
  }

  return <button onClick={() => onRequest(user.id)}>Request</button>;
}

function SettingsDetail({ category, profile, theme, setTheme, soundOn, setSoundOn, setProfileModal, signOut, onBack }) {
  const section = SETTINGS_SECTIONS.find((item) => item.id === category) || SETTINGS_SECTIONS[0];
  const Icon = section.icon;

  return (
    <div className="settings-detail">
      <header>
        <button className="icon-button mobile-back" onClick={onBack} title="Back to settings" aria-label="Back to settings">
          <ArrowLeft size={18} />
        </button>
        <span className="settings-detail-icon"><Icon size={26} /></span>
        <div>
          <h2>{section.title}</h2>
          <p>{section.subtitle}</p>
        </div>
      </header>

      {category === 'account' && (
        <div className="settings-card-list">
          <button className="settings-card" onClick={() => setProfileModal({ type: 'self', profile })}>
            <strong>Edit profile</strong>
            <small>Change display name and profile picture.</small>
          </button>
          <button className="settings-card" onClick={signOut}>
            <strong>Sign out</strong>
            <small>End this session on the current device.</small>
          </button>
          <div className="settings-card muted">
            <strong>Change password</strong>
            <small>Use Supabase password reset flow. This can be wired to email reset next.</small>
          </div>
        </div>
      )}

      {category === 'privacy' && (
        <div className="settings-card-list">
          <div className="settings-card">
            <strong>Friend requests required</strong>
            <small>Only accepted friends can start chats with you.</small>
          </div>
          <div className="settings-card">
            <strong>All users directory</strong>
            <small>Registered users can find each other and send requests.</small>
          </div>
          <div className="settings-card muted">
            <strong>Blocked accounts</strong>
            <small>Planned: block users and hide future requests/messages.</small>
          </div>
        </div>
      )}

      {category === 'chats' && (
        <div className="settings-card-list">
          <div className="settings-card inline-setting">
            <span>
              <strong>Theme</strong>
              <small>Switch between light and dark mode.</small>
            </span>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Light' : 'Dark'}</button>
          </div>
          <div className="settings-card muted">
            <strong>Font size</strong>
            <small>Planned: compact, comfortable, and large message text.</small>
          </div>
          <div className="settings-card muted">
            <strong>Chat wallpaper</strong>
            <small>Planned: choose chat background colors or image.</small>
          </div>
        </div>
      )}

      {category === 'notifications' && (
        <div className="settings-card-list">
          <div className="settings-card inline-setting">
            <span>
              <strong>Notification sound</strong>
              <small>Play a tone for new messages and friend requests.</small>
            </span>
            <button onClick={() => setSoundOn(!soundOn)}>{soundOn ? 'On' : 'Off'}</button>
          </div>
          <div className="settings-card">
            <strong>Notification center</strong>
            <small>Use the bell button to view messages and friend requests.</small>
          </div>
          <div className="settings-card muted">
            <strong>Custom tones</strong>
            <small>Planned: choose different sounds for messages and requests.</small>
          </div>
        </div>
      )}

      {category === 'storage' && (
        <div className="settings-card-list">
          <div className="settings-card">
            <strong>Media storage</strong>
            <small>Profile pictures and chat files are stored in Supabase Storage.</small>
          </div>
          <div className="settings-card muted">
            <strong>Auto-download</strong>
            <small>Planned: control image/file download behavior.</small>
          </div>
        </div>
      )}

      {category === 'accessibility' && (
        <div className="settings-card-list">
          <div className="settings-card">
            <strong>Readable layout</strong>
            <small>Fixed chat height, larger tap targets, and mobile chat navigation are enabled.</small>
          </div>
          <div className="settings-card muted">
            <strong>Reduce motion</strong>
            <small>Planned: disable elastic animations.</small>
          </div>
        </div>
      )}

      {category === 'language' && (
        <div className="settings-card-list">
          <div className="settings-card">
            <strong>English</strong>
            <small>The app currently follows English UI text.</small>
          </div>
          <div className="settings-card muted">
            <strong>More languages</strong>
            <small>Planned: add language files for localization.</small>
          </div>
        </div>
      )}

      {category === 'help' && (
        <div className="settings-card-list">
          <div className="settings-card">
            <strong>Privacy policy</strong>
            <small>Your chats, files, and profiles are stored in your Supabase project.</small>
          </div>
          <div className="settings-card">
            <strong>Support</strong>
            <small>For now, contact the app owner directly for account or data help.</small>
          </div>
        </div>
      )}

      {category === 'invite' && (
        <div className="settings-card-list">
          <div className="settings-card">
            <strong>Invite link</strong>
            <small>Share your deployed Vercel URL with friends so they can register.</small>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message, own, isRead, onEdit, onDelete }) {
  return (
    <article className={`message ${own ? 'own' : ''} ${message.deletedAt ? 'deleted' : ''}`}>
      {message.deletedAt ? (
        <p>This message was deleted</p>
      ) : (
        <>
          {message.body && <p>{message.body}</p>}
          {message.attachments?.map((attachment) => <Attachment key={attachment.url} attachment={attachment} />)}
        </>
      )}
      <footer>
        <time>{formatTime(message.createdAt)}{message.editedAt ? ' edited' : ''}</time>
        {own && <CheckCheck size={14} className={isRead ? 'read' : ''} />}
        {own && !message.deletedAt && (
          <span className="message-actions">
            <button onClick={() => onEdit(message)} title="Edit" aria-label="Edit"><Edit3 size={13} /></button>
            <button onClick={() => onDelete(message.id)} title="Delete" aria-label="Delete"><Trash2 size={13} /></button>
          </span>
        )}
      </footer>
    </article>
  );
}

function Attachment({ attachment }) {
  if (attachment.type.startsWith('image/')) {
    return <a className="attachment image-file" href={attachment.url} target="_blank" rel="noreferrer"><img src={attachment.url} alt={attachment.name} /></a>;
  }

  if (attachment.type.startsWith('audio/')) {
    return <audio className="voice-player" controls src={attachment.url} />;
  }

  return (
    <a className="attachment file-link" href={attachment.url} target="_blank" rel="noreferrer">
      <File size={16} />
      <span>{attachment.name}</span>
    </a>
  );
}

function ProfileModal({ modal, currentUserId, onClose, onSaved, setNotice }) {
  const person = modal.profile || { id: currentUserId, email: '', display_name: 'User', avatar_url: '' };
  const isSelf = person.id === currentUserId;
  const [displayName, setDisplayName] = useState(person.display_name || '');
  const [avatarUrl, setAvatarUrl] = useState(person.avatar_url || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [crop, setCrop] = useState({ zoom: 1, x: 50, y: 50 });
  const [saving, setSaving] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState('');
  const previewUrl = localPreviewUrl || avatarUrl;

  useEffect(() => {
    if (!avatarFile) {
      setLocalPreviewUrl('');
      return undefined;
    }

    const objectUrl = URL.createObjectURL(avatarFile);
    setLocalPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarFile]);

  async function saveProfile(event) {
    event.preventDefault();
    if (!isSelf) return;

    setSaving(true);
    try {
      let nextAvatarUrl = avatarUrl;
      if (avatarFile) {
        const croppedFile = await cropAvatarFile(avatarFile, crop);
        const uploaded = await uploadAvatar(croppedFile, currentUserId);
        nextAvatarUrl = uploaded.url;
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim() || person.email.split('@')[0],
          avatar_url: nextAvatarUrl || null
        })
        .eq('id', currentUserId)
        .select('id, email, display_name, avatar_url, last_seen_at')
        .single();

      if (error) throw error;
      onSaved({
        id: data.id,
        email: data.email,
        display_name: data.display_name,
        avatar_url: data.avatar_url,
        lastSeenAt: data.last_seen_at
      });
      onClose();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="profile-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button close-button" onClick={onClose} title="Close" aria-label="Close"><X size={18} /></button>
        <div className="profile-hero">
          <Avatar profile={{ ...person, avatar_url: previewUrl }} label={displayName || person.email || 'User'} large />
          <div>
            <span className="eyebrow">{isSelf ? 'Your profile' : 'Buddy profile'}</span>
            <h2>{displayName || person.display_name || person.email}</h2>
            <p>{person.email}</p>
          </div>
        </div>

        {isSelf ? (
          <form className="profile-form" onSubmit={saveProfile}>
            <label>
              Display name
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" />
            </label>
            <label>
              Profile picture upload
              <span className="input-with-icon">
                <Camera size={18} />
                <input type="file" accept="image/*" onChange={(event) => setAvatarFile(event.target.files?.[0] || null)} />
              </span>
            </label>
            {previewUrl && (
              <div className="crop-tool">
                <div className="crop-preview">
                  <img
                    src={previewUrl}
                    alt=""
                    style={{
                      transform: `scale(${crop.zoom})`,
                      transformOrigin: `${crop.x}% ${crop.y}%`
                    }}
                  />
                </div>
                <label>
                  Zoom
                  <input type="range" min="1" max="2.8" step="0.05" value={crop.zoom} onChange={(event) => setCrop((value) => ({ ...value, zoom: Number(event.target.value) }))} />
                </label>
                <label>
                  Horizontal
                  <input type="range" min="0" max="100" step="1" value={crop.x} onChange={(event) => setCrop((value) => ({ ...value, x: Number(event.target.value) }))} />
                </label>
                <label>
                  Vertical
                  <input type="range" min="0" max="100" step="1" value={crop.y} onChange={(event) => setCrop((value) => ({ ...value, y: Number(event.target.value) }))} />
                </label>
              </div>
            )}
            <button className="primary-button" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button>
          </form>
        ) : (
          <div className="profile-details">
            <span><strong>Display name</strong><small>{person.display_name || 'Not set'}</small></span>
            <span><strong>Email</strong><small>{person.email}</small></span>
            <span><strong>Status</strong><small>{person.lastSeenAt ? `Last seen ${formatRelative(person.lastSeenAt)}` : 'No recent activity'}</small></span>
          </div>
        )}
      </section>
    </div>
  );
}

function Avatar({ profile, label, online, large }) {
  const displayLabel = label || profile?.display_name || profile?.email || 'User';
  const initials = displayLabel.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <span className={`avatar ${large ? 'large' : ''}`}>
      {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : initials || '?'}
      {online && <i />}
    </span>
  );
}

async function uploadChatFiles(files, userId) {
  const uploads = [];
  for (const file of files) {
    const path = `${userId}/${Date.now()}-${safeFileName(file.name)}`;
    const { error } = await supabase.storage.from('chat-files').upload(path, file, { upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from('chat-files').getPublicUrl(path);
    uploads.push({ name: file.name, type: file.type, size: file.size, url: data.publicUrl });
  }
  return uploads;
}

async function uploadAvatar(file, userId) {
  const path = `${userId}/avatar-${Date.now()}-${safeFileName(file.name)}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return { url: data.publicUrl };
}

async function cropAvatarFile(file, crop) {
  const image = await loadImageFromFile(file);
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');

  const scale = Math.max(size / image.width, size / image.height) * crop.zoom;
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const extraX = Math.max(0, drawWidth - size);
  const extraY = Math.max(0, drawHeight - size);
  const dx = -extraX * (crop.x / 100);
  const dy = -extraY * (crop.y / 100);

  context.fillStyle = '#0f172a';
  context.fillRect(0, 0, size, size);
  context.drawImage(image, dx, dy, drawWidth, drawHeight);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}-avatar.jpg`, { type: 'image/jpeg' });
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    image.src = url;
  });
}

function playNotify(enabled) {
  if (!enabled) return;
  try {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = 760;
    gain.gain.value = 0.04;
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.08);
  } catch {
    // Browsers may block audio until the user interacts with the page.
  }
}

function safeFileName(name) {
  return name.replace(/[^a-z0-9_.-]/gi, '-').toLowerCase();
}

function conversationLabel(conversation, currentUserId) {
  if (conversation.title) return conversation.title;
  const other = otherParticipant(conversation, currentUserId);
  return other?.display_name || other?.email || 'Conversation';
}

function otherParticipant(conversation, currentUserId) {
  return conversation.participants.find((participant) => participant.id !== currentUserId) || conversation.participants[0];
}

function upsertConversation(conversations, conversation) {
  const withoutExisting = conversations.filter((item) => item.id !== conversation.id);
  return [conversation, ...withoutExisting].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function updateParticipant(conversations, userId, patch) {
  return conversations.map((conversation) => ({
    ...conversation,
    participants: conversation.participants.map((participant) => (
      participant.id === userId ? { ...participant, ...patch } : participant
    ))
  }));
}

function syncRequestNotifications(currentNotifications, requests) {
  const incomingRequests = requests.filter((request) => request.direction === 'incoming');
  const requestNotifications = incomingRequests.map((request) => ({
    id: `request-${request.id}`,
    type: 'friend-request',
    requestId: request.id,
    title: request.requester.display_name,
    body: 'Sent you a friend request',
    createdAt: request.createdAt
  }));
  const nonRequestNotifications = currentNotifications.filter((item) => item.type !== 'friend-request');

  return [...requestNotifications, ...nonRequestNotifications].slice(0, 20);
}

function mergeMessages(olderMessages, currentMessages) {
  const byId = new Map();
  for (const message of [...olderMessages, ...currentMessages]) {
    byId.set(message.id, message);
  }

  return [...byId.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function upsertReceipt(message, receipt) {
  const receipts = message.receipts || [];
  return {
    ...message,
    receipts: receipts.some((item) => item.profileId === receipt.profileId)
      ? receipts.map((item) => item.profileId === receipt.profileId ? receipt : item)
      : [...receipts, receipt]
  };
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatRelative(value) {
  const seconds = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return formatDate(value);
}
