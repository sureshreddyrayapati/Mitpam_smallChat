import { getUserFromToken } from './supabase.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = await getUserFromToken(token);

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.user = user;
  next();
}

export async function socketAuth(socket, next) {
  const token = socket.handshake.auth?.token;
  const user = await getUserFromToken(token);

  if (!user) {
    return next(new Error('Unauthorized'));
  }

  socket.user = user;
  next();
}
