import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Camera,
  CheckCheck,
  CheckCircle2,
  Edit3,
  File,
  Image,
  KeyRound,
  LogOut,
  MessageCircle,
  Mic,
  Moon,
  Paperclip,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Smile,
  Sparkles,
  Sun,
  Trash2,
  Volume2,
  Wifi,
  X,
  Settings
} from 'lucide-react';
import { apiFetch, API_URL } from './lib/api.js';
import { hasSupabaseConfig, supabase } from './lib/supabase.js';

const EMOJIS = ['😀', '😂', '😍', '🔥', '👍', '🙏', '🎉', '❤️', '😎', '😢', '🤝', '🚀'];

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
          options: { data: { display_name: displayName || email.split('@')[0] } }
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

  const [profile, setProfile] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [newChatQuery, setNewChatQuery] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [profileResults, setProfileResults] = useState([]);
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
  const [settingsOpen, setSettingsOpen] = useState(false);

  const activeConversation = conversations.find((item) => item.id === activeId);
  const activeBuddy = activeConversation ? otherParticipant(activeConversation, currentUserId) : null;

  const visibleConversations = useMemo(() => {
    const value = chatSearch.trim().toLowerCase();
    if (!value) return conversations;
    return conversations.filter((conversation) => conversationLabel(conversation, currentUserId).toLowerCase().includes(value));
  }, [chatSearch, conversations, currentUserId]);

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
    async function loadInitialData() {
      try {
        const [meResponse, conversationsResponse] = await Promise.all([
          apiFetch('/api/me', token),
          apiFetch('/api/conversations', token)
        ]);
        setProfile(meResponse.profile);
        setConversations(conversationsResponse.conversations);
        setActiveId(conversationsResponse.conversations[0]?.id || null);
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
    });
    socket.on('message:new', (message) => {
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      if (message.senderId !== currentUserId) playNotify(soundOn);
      if (message.conversationId === activeIdRef.current && message.senderId !== currentUserId) {
        socket.emit('message:read', { conversationId: activeIdRef.current });
      }
    });
    socket.on('message:update', (message) => {
      setMessages((current) => current.map((item) => item.id === message.id ? message : item));
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
      setConversations((current) => updateParticipant(current, userId, { lastSeenAt }));
    });

    return () => socket.disconnect();
  }, [currentUserId, soundOn, token]);

  useEffect(() => {
    if (!activeId || !socketRef.current) {
      setMessages([]);
      return;
    }

    socketRef.current.emit('conversation:join', { conversationId: activeId });
    apiFetch(`/api/conversations/${activeId}/messages`, token)
      .then((response) => {
        setMessages(response.messages);
        socketRef.current?.emit('message:read', { conversationId: activeId });
      })
      .catch((error) => setNotice(error.message));
  }, [activeId, token]);

  useEffect(() => {
    const list = messageListRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages.length, activeId]);

  useEffect(() => {
    const query = newChatQuery.trim();
    if (query.length < 2) {
      setProfileResults([]);
      return undefined;
    }

    const timer = setTimeout(() => {
      apiFetch(`/api/profiles/search?q=${encodeURIComponent(query)}`, token)
        .then((response) => setProfileResults(response.profiles))
        .catch((error) => setNotice(error.message));
    }, 250);

    return () => clearTimeout(timer);
  }, [newChatQuery, token]);

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
      setProfileResults([]);
    } catch (error) {
      setNotice(error.message);
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

  return (
    <main className="chat-shell">
      <aside className="sidebar">
        <header className="sidebar-header">
          <button className="profile-chip" onClick={() => setProfileModal({ type: 'self', profile })}>
            <Avatar profile={profile} label={profile?.display_name || session.user.email} />
            <span>
              <strong>{profile?.display_name || session.user.email}</strong>
              <small className="eyebrow">Signed in</small>
            </span>
          </button>
          <div className="header-actions">
            <button className="icon-button" onClick={() => setSettingsOpen(!settingsOpen)} title="Settings" aria-label="Settings">
              <Settings size={18} />
            </button>
            {settingsOpen && (
              <div className="settings-menu">
                <button onClick={() => setSoundOn(!soundOn)}><Volume2 size={16} /> {soundOn ? 'Sound on' : 'Sound off'}</button>
                <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} {theme === 'dark' ? 'Light theme' : 'Dark theme'}</button>
                <button onClick={signOut}><LogOut size={16} /> Sign out</button>
              </div>
            )}
          </div>
        </header>

        <form className="new-chat" onSubmit={(event) => { event.preventDefault(); startChat(); }}>
          <input value={newChatQuery} onChange={(event) => setNewChatQuery(event.target.value)} placeholder="Search name or email" />
          <button className="icon-button filled" title="Start chat" aria-label="Start chat"><Plus size={18} /></button>
        </form>

        {profileResults.length > 0 && (
          <div className="search-results">
            {profileResults.map((result) => (
              <button key={result.id} onClick={() => startChat(result.id)}>
                <Avatar profile={result} />
                <span>
                  <strong>{result.display_name}</strong>
                  <small>{result.email}</small>
                </span>
              </button>
            ))}
          </div>
        )}

        <label className="search-box">
          <Search size={17} />
          <input value={chatSearch} onChange={(event) => setChatSearch(event.target.value)} placeholder="Filter chats" />
        </label>

        <div className="conversation-list">
          {visibleConversations.map((conversation) => {
            const other = otherParticipant(conversation, currentUserId);
            const active = conversation.id === activeId;
            return (
              <button key={conversation.id} className={`conversation-row ${active ? 'active' : ''}`} onClick={() => setActiveId(conversation.id)}>
                <Avatar profile={other} label={conversationLabel(conversation, currentUserId)} online={other && onlineUsers.has(other.id)} />
                <span>
                  <strong>{conversationLabel(conversation, currentUserId)}</strong>
                  <small>{other && onlineUsers.has(other.id) ? 'Online' : other?.lastSeenAt ? `Last seen ${formatRelative(other.lastSeenAt)}` : formatDate(conversation.updatedAt)}</small>
                </span>
              </button>
            );
          })}
          {!visibleConversations.length && <p className="empty-state">No conversations yet.</p>}
        </div>
      </aside>

      <section className="chat-panel">
        {activeConversation ? (
          <>
            <header className="chat-header">
              <button className="chat-person" onClick={() => setProfileModal({ type: 'buddy', profile: activeBuddy })}>
                <Avatar profile={activeBuddy} label={conversationLabel(activeConversation, currentUserId)} online={activeBuddy && onlineUsers.has(activeBuddy.id)} />
                <span>
                  <strong>{conversationLabel(activeConversation, currentUserId)}</strong>
                  <small><Sparkles size={14} /> {typingUsers.size ? 'typing...' : buddyStatus}</small>
                </span>
              </button>
            </header>

            <div className="message-list" ref={messageListRef}>
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
            <h2>Select or start a conversation</h2>
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
    </main>
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
  const [saving, setSaving] = useState(false);

  async function saveProfile(event) {
    event.preventDefault();
    if (!isSelf) return;

    setSaving(true);
    try {
      let nextAvatarUrl = avatarUrl;
      if (avatarFile) {
        const uploaded = await uploadAvatar(avatarFile, currentUserId);
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
          <Avatar profile={{ ...person, avatar_url: avatarFile ? URL.createObjectURL(avatarFile) : avatarUrl }} label={displayName || person.email || 'User'} large />
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
