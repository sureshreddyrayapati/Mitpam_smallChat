# WhatsApp Clone

A small chat app built with React, Node.js, Socket.IO, and Supabase Auth/Postgres.

## Features

- Email/password signup and login with Supabase Auth
- Realtime direct conversations using Socket.IO
- Message history stored in Supabase Postgres
- Online user presence for active sockets
- File, image, and voice-message attachments through Supabase Storage
- Message edit/delete, typing indicators, read receipts, last-seen status, emoji picker, and notification sound
- Free-tier friendly deployment split: static frontend + Node WebSocket backend

## Project Structure

```text
client/       React + Vite frontend
server/       Express + Socket.IO backend
supabase/     Database schema and RLS policies
```

## Local Setup

1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql`.
   - If you already ran the older schema, run the full file again. It includes migration-style updates for attachments, read receipts, last-seen, and Storage buckets.
3. Copy env examples:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

4. Fill in the Supabase values.
5. Install and run:

```bash
npm run install:all
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:4000`

## Free Hosting Suggestion

For a Socket.IO app, use a host that supports long-running Node services and WebSockets.

- Frontend: Vercel, Netlify, Cloudflare Pages, or Render Static Site
- Backend: Render Free Web Service or Koyeb free instance
- Database/Auth: Supabase free tier

Render's free web service supports WebSocket wakeups, but it can spin down after inactivity. That is fine for testing and small personal use, but expect a short cold start. Koyeb also has a small free instance and supports Node services.

Avoid hosting the Socket.IO server as Vercel/Netlify serverless functions. Put the websocket backend on Render/Koyeb and set `VITE_API_URL` in the frontend to that backend URL.

## Environment

Server:

```env
PORT=4000
CLIENT_URL=http://localhost:5173
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Client:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:4000
```

Never expose the service role key in the frontend.
