import { supabase } from './supabase.js';

const profileSelect = 'id, email, display_name, avatar_url, last_seen_at';

const conversationSelect = `
  id,
  is_group,
  title,
  created_at,
  updated_at,
  conversation_participants (
    profile_id,
    profiles (
      ${profileSelect}
    )
  )
`;

const messageSelect = `
  id,
  conversation_id,
  sender_id,
  body,
  message_type,
  attachments,
  edited_at,
  deleted_at,
  created_at,
  profiles!messages_sender_id_fkey (
    ${profileSelect}
  ),
  message_receipts (
    profile_id,
    read_at
  )
`;

export async function ensureProfile(user) {
  const email = user.email || '';
  const fallbackName = email ? email.split('@')[0] : 'User';
  const displayName = user.user_metadata?.display_name || fallbackName;

  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, email, display_name: displayName }, { onConflict: 'id' })
    .select(profileSelect)
    .single();

  if (error) {
    throw error;
  }

  return normalizeProfile(data);
}

export async function listConversations(userId) {
  const { data: memberships, error: membershipError } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('profile_id', userId);

  if (membershipError) {
    throw membershipError;
  }

  const ids = memberships.map((item) => item.conversation_id);
  if (!ids.length) {
    return [];
  }

  const { data, error } = await supabase
    .from('conversations')
    .select(conversationSelect)
    .in('id', ids)
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data.map(normalizeConversation);
}

export async function getConversationForUser(conversationId, userId) {
  const { data: participant, error: participantError } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('conversation_id', conversationId)
    .eq('profile_id', userId)
    .maybeSingle();

  if (participantError) {
    throw participantError;
  }

  if (!participant) {
    return null;
  }

  const { data, error } = await supabase
    .from('conversations')
    .select(conversationSelect)
    .eq('id', conversationId)
    .single();

  if (error) {
    throw error;
  }

  return normalizeConversation(data);
}

export async function listMessages(conversationId, userId) {
  const conversation = await getConversationForUser(conversationId, userId);
  if (!conversation) {
    return null;
  }

  const { data, error } = await supabase
    .from('messages')
    .select(messageSelect)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    throw error;
  }

  return data.map(normalizeMessage);
}

export async function searchProfiles(userId, query) {
  const term = query.trim();
  if (term.length < 2) {
    return [];
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(profileSelect)
    .neq('id', userId)
    .or(`email.ilike.%${term}%,display_name.ilike.%${term}%`)
    .limit(8);

  if (error) {
    throw error;
  }

  return data.map(normalizeProfile);
}

export async function createDirectConversation(currentUserId, emailOrUserId) {
  const normalized = emailOrUserId.trim().toLowerCase();
  const query = supabase.from('profiles').select(profileSelect);
  const { data: otherProfile, error: profileError } = normalized.includes('@')
    ? await query.eq('email', normalized).maybeSingle()
    : await query.eq('id', normalized).maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!otherProfile) {
    const error = new Error('No user found');
    error.status = 404;
    throw error;
  }

  if (otherProfile.id === currentUserId) {
    const error = new Error('You cannot start a chat with yourself');
    error.status = 400;
    throw error;
  }

  const existing = await findDirectConversation(currentUserId, otherProfile.id);
  if (existing) {
    return existing;
  }

  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .insert({ created_by: currentUserId })
    .select('id')
    .single();

  if (conversationError) {
    throw conversationError;
  }

  const { error: participantsError } = await supabase
    .from('conversation_participants')
    .insert([
      { conversation_id: conversation.id, profile_id: currentUserId },
      { conversation_id: conversation.id, profile_id: otherProfile.id }
    ]);

  if (participantsError) {
    throw participantsError;
  }

  return getConversationForUser(conversation.id, currentUserId);
}

export async function saveMessage(conversationId, senderId, body, attachments = []) {
  const conversation = await getConversationForUser(conversationId, senderId);
  if (!conversation) {
    const error = new Error('Conversation not found');
    error.status = 404;
    throw error;
  }

  const text = (body || '').trim();
  const cleanAttachments = normalizeAttachments(attachments);
  if (!text && !cleanAttachments.length) {
    const error = new Error('Message cannot be empty');
    error.status = 400;
    throw error;
  }

  const messageType = getMessageType(cleanAttachments);
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: text,
      attachments: cleanAttachments,
      message_type: messageType
    })
    .select(messageSelect)
    .single();

  if (error) {
    throw error;
  }

  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  return {
    message: normalizeMessage(data),
    conversation
  };
}

export async function editMessage(messageId, senderId, body) {
  const current = await getMessageForSender(messageId, senderId);
  const text = (body || '').trim();
  if (!text) {
    const error = new Error('Message cannot be empty');
    error.status = 400;
    throw error;
  }

  const { data, error } = await supabase
    .from('messages')
    .update({ body: text, edited_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('sender_id', senderId)
    .select(messageSelect)
    .single();

  if (error) {
    throw error;
  }

  return { message: normalizeMessage(data), conversationId: current.conversation_id };
}

export async function deleteMessage(messageId, senderId) {
  const current = await getMessageForSender(messageId, senderId);
  const { data, error } = await supabase
    .from('messages')
    .update({
      body: '',
      attachments: [],
      deleted_at: new Date().toISOString()
    })
    .eq('id', messageId)
    .eq('sender_id', senderId)
    .select(messageSelect)
    .single();

  if (error) {
    throw error;
  }

  return { message: normalizeMessage(data), conversationId: current.conversation_id };
}

export async function markConversationRead(conversationId, profileId) {
  const conversation = await getConversationForUser(conversationId, profileId);
  if (!conversation) {
    const error = new Error('Conversation not found');
    error.status = 404;
    throw error;
  }

  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select('id, sender_id')
    .eq('conversation_id', conversationId)
    .neq('sender_id', profileId)
    .is('deleted_at', null)
    .limit(100);

  if (messagesError) {
    throw messagesError;
  }

  const now = new Date().toISOString();
  const rows = messages.map((message) => ({
    message_id: message.id,
    profile_id: profileId,
    read_at: now
  }));

  if (rows.length) {
    const { error } = await supabase
      .from('message_receipts')
      .upsert(rows, { onConflict: 'message_id,profile_id' });

    if (error) {
      throw error;
    }
  }

  return {
    conversation,
    readerId: profileId,
    messageIds: rows.map((row) => row.message_id),
    readAt: now
  };
}

export async function updateLastSeen(profileId) {
  const lastSeenAt = new Date().toISOString();
  await supabase
    .from('profiles')
    .update({ last_seen_at: lastSeenAt })
    .eq('id', profileId);

  return lastSeenAt;
}

export async function findDirectConversation(userA, userB) {
  const { data, error } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .in('profile_id', [userA, userB]);

  if (error) {
    throw error;
  }

  const counts = new Map();
  for (const row of data) {
    counts.set(row.conversation_id, (counts.get(row.conversation_id) || 0) + 1);
  }

  const matchingIds = [...counts.entries()]
    .filter(([, count]) => count === 2)
    .map(([id]) => id);

  if (!matchingIds.length) {
    return null;
  }

  const { data: conversations, error: conversationsError } = await supabase
    .from('conversations')
    .select(conversationSelect)
    .in('id', matchingIds)
    .eq('is_group', false)
    .limit(1);

  if (conversationsError) {
    throw conversationsError;
  }

  return conversations[0] ? normalizeConversation(conversations[0]) : null;
}

async function getMessageForSender(messageId, senderId) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, deleted_at')
    .eq('id', messageId)
    .eq('sender_id', senderId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data || data.deleted_at) {
    const notFound = new Error('Message not found');
    notFound.status = 404;
    throw notFound;
  }

  return data;
}

function normalizeAttachments(attachments) {
  if (!Array.isArray(attachments)) {
    return [];
  }

  return attachments
    .slice(0, 4)
    .map((attachment) => ({
      name: String(attachment.name || 'Attachment').slice(0, 160),
      url: String(attachment.url || ''),
      type: String(attachment.type || 'application/octet-stream'),
      size: Number(attachment.size || 0)
    }))
    .filter((attachment) => attachment.url);
}

function getMessageType(attachments) {
  const firstType = attachments[0]?.type || '';
  if (firstType.startsWith('image/')) return 'image';
  if (firstType.startsWith('audio/')) return 'audio';
  if (attachments.length) return 'file';
  return 'text';
}

export function normalizeConversation(conversation) {
  const participants = conversation.conversation_participants.map((participant) => normalizeProfile(participant.profiles));

  return {
    id: conversation.id,
    isGroup: conversation.is_group,
    title: conversation.title,
    createdAt: conversation.created_at,
    updatedAt: conversation.updated_at,
    participants
  };
}

export function normalizeProfile(profile) {
  return {
    id: profile.id,
    email: profile.email,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    lastSeenAt: profile.last_seen_at
  };
}

export function normalizeMessage(message) {
  return {
    id: message.id,
    conversationId: message.conversation_id,
    senderId: message.sender_id,
    body: message.body || '',
    type: message.message_type,
    attachments: message.attachments || [],
    editedAt: message.edited_at,
    deletedAt: message.deleted_at,
    createdAt: message.created_at,
    sender: message.profiles ? normalizeProfile(message.profiles) : null,
    receipts: (message.message_receipts || []).map((receipt) => ({
      profileId: receipt.profile_id,
      readAt: receipt.read_at
    }))
  };
}
