import fs from 'fs';
import path from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { OAuth2Client } from 'google-auth-library';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

const __dirnameLocal = path.resolve();
const publicDir = path.join(__dirnameLocal, 'public');

// Ensure data dir and db
const dataDir = path.join(__dirnameLocal, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'leaderboard.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at INTEGER NOT NULL,
    mode TEXT NOT NULL,
    time_seconds INTEGER NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    mines INTEGER NOT NULL,
    user_id TEXT,
    display_name TEXT,
    picture_url TEXT,
    is_guest INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX IF NOT EXISTS idx_scores_mode_time ON scores (mode, time_seconds);
`);

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(publicDir, { extensions: ['html'] }));

function readSession(req) {
  const token = req.cookies?.session || '';
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload?.user || null;
  } catch {
    return null;
  }
}

function setSession(res, user) {
  const token = jwt.sign({ user }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

app.get('/api/config', (req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID });
});

app.get('/api/session', (req, res) => {
  const user = readSession(req);
  res.json({ user });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('session');
  res.json({ ok: true });
});

app.post('/api/auth/google', async (req, res) => {
  try {
    if (!googleClient || !GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: 'Google login not configured' });
    }
    const { idToken } = req.body || {};
    if (!idToken) return res.status(400).json({ error: 'Missing idToken' });
    const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const user = {
      userId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
    setSession(res, user);
    res.json({ user });
  } catch (err) {
    console.error('Google auth failed:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.get('/api/leaderboard', (req, res) => {
  const mode = (req.query.mode || 'beginner').toString();
  const limit = Math.min(parseInt(req.query.limit || '25', 10), 100);
  const stmt = db.prepare(`
    SELECT id, created_at as createdAt, mode, time_seconds as timeSeconds, width, height, mines, user_id as userId, display_name as displayName, picture_url as pictureUrl, is_guest as isGuest
    FROM scores
    WHERE mode = ?
    ORDER BY time_seconds ASC, created_at ASC
    LIMIT ?
  `);
  const rows = stmt.all(mode, limit);
  res.json({ items: rows });
});

app.post('/api/score', (req, res) => {
  const user = readSession(req);
  const { mode, timeSeconds, width, height, mines, displayName } = req.body || {};
  if (!mode || typeof timeSeconds !== 'number') return res.status(400).json({ error: 'Missing fields' });

  // Basic validation bounds
  const validModes = new Set(['beginner', 'intermediate', 'expert']);
  if (!validModes.has(mode)) return res.status(400).json({ error: 'Invalid mode' });
  if (timeSeconds < 1 || timeSeconds > 9999) return res.status(400).json({ error: 'Invalid time' });

  const insert = db.prepare(`
    INSERT INTO scores (created_at, mode, time_seconds, width, height, mines, user_id, display_name, picture_url, is_guest)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const now = Date.now();
  const isGuest = user ? 0 : 1;
  const name = user?.name || (displayName || 'Guest').toString().slice(0, 40);
  const pic = user?.picture || null;
  const userId = user?.userId || null;

  const info = insert.run(now, mode, Math.round(timeSeconds), width || 0, height || 0, mines || 0, userId, name, pic, isGuest);
  res.json({ ok: true, id: info.lastInsertRowid });
});

// Fallback to index.html for root
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Minesweeper server running on http://localhost:${PORT}`);
});