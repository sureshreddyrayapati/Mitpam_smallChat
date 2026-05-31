import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import http from 'node:http';
import { Server } from 'socket.io';
import { requireAuth, socketAuth } from './auth.js';
import {
  createDirectConversation,
  deleteMessage,
  editMessage,
  ensureProfile,
  getConversationForUser,
  listConversations,
  listMessages,
  markConversationRead,
  saveMessage,
  searchProfiles,
  updateLastSeen
} from './chatStore.js';

const PORT = process.env.PORT || 4000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const allowedOrigins = CLIENT_URL.split(',').map((origin) => origin.trim());

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const profile = await ensureProfile(req.user);
    res.json({ profile });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/conversations', requireAuth, async (req, res) => {
  try {
    await ensureProfile(req.user);
    const conversations = await listConversations(req.user.id);
    res.json({ conversations });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/profiles/search', requireAuth, async (req, res) => {
  try {
    await ensureProfile(req.user);
    const profiles = await searchProfiles(req.user.id, String(req.query.q || ''));
    res.json({ profiles });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/conversations/direct', requireAuth, async (req, res) => {
  try {
    await ensureProfile(req.user);
    const target = req.body.email || req.body.profileId;
    if (!target || typeof target !== 'string') {
      return res.status(400).json({ error: 'Email or profileId is required' });
    }

    const conversation = await createDirectConversation(req.user.id, target);
    for (const participant of conversation.participants) {
      io.to(`user:${participant.id}`).emit('conversation:upsert', conversation);
    }

    res.status(201).json({ conversation });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/conversations/:id/messages', requireAuth, async (req, res) => {
  try {
    const messages = await listMessages(req.params.id, req.user.id);
    if (!messages) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ messages });
  } catch (error) {
    handleError(res, error);
  }
});

io.use(socketAuth);

io.on('connection', async (socket) => {
  socket.join(`user:${socket.user.id}`);

  try {
    const conversations = await listConversations(socket.user.id);
    for (const conversation of conversations) {
      socket.join(`conversation:${conversation.id}`);
    }
  } catch (error) {
    socket.emit('server:error', { error: 'Could not join conversation rooms' });
  }

  socket.emit('presence:online', { userId: socket.user.id });
  socket.broadcast.emit('presence:online', { userId: socket.user.id });

  socket.on('conversation:join', async ({ conversationId }, ack) => {
    try {
      const conversation = await getConversationForUser(conversationId, socket.user.id);
      if (!conversation) {
        return ack?.({ ok: false, error: 'Conversation not found' });
      }

      socket.join(`conversation:${conversationId}`);
      ack?.({ ok: true });
    } catch (error) {
      ack?.({ ok: false, error: error.message });
    }
  });

  socket.on('message:send', async ({ conversationId, body, attachments }, ack) => {
    try {
      const { message, conversation } = await saveMessage(conversationId, socket.user.id, body || '', attachments || []);

      io.to(`conversation:${conversationId}`).emit('message:new', message);
      for (const participant of conversation.participants) {
        io.to(`user:${participant.id}`).emit('conversation:upsert', {
          ...conversation,
          updatedAt: new Date().toISOString()
        });
      }

      ack?.({ ok: true, message });
    } catch (error) {
      ack?.({ ok: false, error: error.message });
    }
  });

  socket.on('message:edit', async ({ messageId, body }, ack) => {
    try {
      const { message, conversationId } = await editMessage(messageId, socket.user.id, body || '');
      io.to(`conversation:${conversationId}`).emit('message:update', message);
      ack?.({ ok: true, message });
    } catch (error) {
      ack?.({ ok: false, error: error.message });
    }
  });

  socket.on('message:delete', async ({ messageId }, ack) => {
    try {
      const { message, conversationId } = await deleteMessage(messageId, socket.user.id);
      io.to(`conversation:${conversationId}`).emit('message:update', message);
      ack?.({ ok: true, message });
    } catch (error) {
      ack?.({ ok: false, error: error.message });
    }
  });

  socket.on('message:read', async ({ conversationId }, ack) => {
    try {
      const receipt = await markConversationRead(conversationId, socket.user.id);
      io.to(`conversation:${conversationId}`).emit('receipt:update', {
        conversationId,
        readerId: receipt.readerId,
        readAt: receipt.readAt,
        messageIds: receipt.messageIds
      });
      ack?.({ ok: true });
    } catch (error) {
      ack?.({ ok: false, error: error.message });
    }
  });

  socket.on('typing:start', async ({ conversationId }) => {
    const conversation = await getConversationForUser(conversationId, socket.user.id);
    if (conversation) {
      socket.to(`conversation:${conversationId}`).emit('typing:start', {
        conversationId,
        userId: socket.user.id
      });
    }
  });

  socket.on('typing:stop', async ({ conversationId }) => {
    const conversation = await getConversationForUser(conversationId, socket.user.id);
    if (conversation) {
      socket.to(`conversation:${conversationId}`).emit('typing:stop', {
        conversationId,
        userId: socket.user.id
      });
    }
  });

  socket.on('disconnect', async () => {
    const lastSeenAt = await updateLastSeen(socket.user.id);
    socket.broadcast.emit('presence:offline', { userId: socket.user.id, lastSeenAt });
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

function handleError(res, error) {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || 'Server error' });
}
