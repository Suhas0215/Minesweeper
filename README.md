# Minesweeper

Modern Minesweeper with separate frontend files, optional Google login, and a leaderboard.

## Run locally

```bash
cd /workspace
cp -n .env.example .env  # edit GOOGLE_CLIENT_ID and JWT_SECRET
npm install
npm run dev
# open http://localhost:3000
```

## Structure

- `public/` static frontend
  - `index.html`
  - `styles.css`
  - `main.js` (UI wiring)
  - `game.js` (game logic)
  - `auth.js` (Google login)
  - `api.js` (HTTP client)
- `server.js` Express backend (serves static files, leaderboard API, Google auth)
- `data/leaderboard.db` SQLite database (auto-created) 
