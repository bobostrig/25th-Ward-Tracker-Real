# 25th Ward Temple Tracker

A real-time, shared temple-visit tracker. Everyone who opens the site sees the
same live counter, activity feed, and image reveal — updates from any one
person's device show up instantly for everyone else, thanks to Socket.io.

## How it works

- **Backend**: Node.js + Express + Socket.io (`server.js`)
- **Frontend**: static HTML/CSS/JS in `public/`
- **Shared data**: MongoDB Atlas (free tier) so every visitor sees the same count and history, no matter who's connected or which server instance they hit
- **Local fallback**: if no database is configured, it falls back to a local `visits.json` file — handy for quick local testing, but **not** shared across users once deployed, so don't rely on it in production

## 1. Push this to GitHub

```bash
cd temple-tracker
git init
git add .
git commit -m "Initial commit"
```

Then create a new repo on [github.com/new](https://github.com/new) and follow
the "push an existing repository" instructions it gives you, e.g.:

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

Your `.env` file (real secrets) is excluded by `.gitignore` and will **not**
be pushed — that's intentional. `.env.example` shows what's needed without
exposing anything.

## 2. Set up a shared database (MongoDB Atlas — free)

1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) and create a free account.
2. Create a free "M0" cluster.
3. Under **Database Access**, add a database user with a username/password.
4. Under **Network Access**, add `0.0.0.0/0` (allow access from anywhere) — needed since your host's server IP isn't fixed.
5. Click **Connect > Drivers**, copy the connection string. It looks like:
   `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/`
6. Add a database name at the end, e.g. `.../temple-tracker?retryWrites=true&w=majority`

This connection string is your `MONGODB_URI`.

## 3. Deploy so it's actually live for everyone

GitHub itself only hosts the code — it doesn't run your server. You need a
host that runs Node.js continuously. **Render's free tier** is the easiest:

1. Go to [render.com](https://render.com) and sign up (you can sign in with GitHub).
2. Click **New > Web Service**, and connect the GitHub repo you just pushed.
3. Set:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Under **Environment**, add the environment variables:
   - `MONGODB_URI` = the connection string from step 2
   - `ADMIN_PASSWORD` = whatever password you want for resetting the counter
5. Click **Create Web Service**. Render will build and deploy it, then give you a live URL like `https://temple-tracker.onrender.com`.

Share that URL with your ward — everyone who opens it is connected to the
same live server and the same database, so any visit logged by anyone shows
up for everyone in real time.

**Note on Render's free tier**: free web services spin down after a period of
inactivity and take ~30-60 seconds to wake back up on the next visit. That's
fine for a ward tracker with occasional use; if you want it always-instant,
Render's cheapest paid tier ($7/mo) keeps it always on. Railway and Fly.io
are solid alternatives if you'd rather compare pricing.

## Local development

```bash
npm install
cp .env.example .env
# edit .env and fill in real values
npm start
```

Then open `http://localhost:3000`.
