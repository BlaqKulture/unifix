# Deploying UniFix (about 30 minutes, all free)

Three free services are used:

| Part | Service | What you get |
|---|---|---|
| Database | **Neon** (neon.tech) | PostgreSQL that does not expire |
| API | **Render** (render.com) | `https://unifix-api-xxxx.onrender.com` |
| Website | **Vercel** (vercel.com) | `https://unifix-xxxx.vercel.app` |

Sign in to Neon and Render **with your GitHub account** so everything is linked.

---

## Step 1 – Put the code on GitHub

1. On github.com click **New repository** → name it `unifix` → Public → **Create**.
2. In a terminal inside the `unifix` folder:

```bash
git init
git add .
git commit -m "UniFix campus maintenance request system"
git branch -M main
git remote add origin https://github.com/<your-username>/unifix.git
git push -u origin main
```

## Step 2 – Create the database on Neon

1. Go to **neon.tech** → Sign up with GitHub → **Create project**.
   Name: `unifix`, Postgres version: latest, Region: closest to you (e.g. *AWS Europe (Frankfurt)*).
2. On the project dashboard click **Connect**, and copy the **connection string**. It looks like:
   `postgresql://neondb_owner:xxxx@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`
3. Keep it somewhere safe. This is your `DATABASE_URL`.

## Step 3 – Deploy the API on Render

1. Go to **render.com** → Sign up with GitHub.
2. Click **New +** → **Web Service** → choose the `unifix` repository.
3. Fill in:

| Setting | Value |
|---|---|
| Name | `unifix-api` |
| Root Directory | `backend` |
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `gunicorn -w 2 -b 0.0.0.0:$PORT wsgi:app` |
| Instance Type | **Free** |

4. Under **Environment Variables** add:

| Key | Value |
|---|---|
| `DATABASE_URL` | the Neon connection string from Step 2 |
| `JWT_SECRET_KEY` | any long random text (e.g. 40+ characters) |
| `SECRET_KEY` | any other long random text |
| `CORS_ORIGINS` | `*` for now (we'll tighten it in Step 5) |
| `AUTO_SEED` | `true` |

5. Click **Create Web Service**. Wait for "Your service is live" (3–5 minutes).
6. Open `https://<your-service>.onrender.com/api/health`. You should see:
   ```json
   {"database": "connected", "engine": "postgresql", "status": "ok", ...}
   ```
   **Screenshot this** – it proves the deployed API is connected to the database.
7. Open `https://<your-service>.onrender.com/api/docs/` – the Swagger page. Screenshot it.

> The tables and demo accounts are created automatically the first time the API starts.
> You can check in Neon → **Tables**: you'll see 10 tables (users, roles, service_requests …).

## Step 4 – Deploy the website on Vercel

1. Go to **vercel.com** → **Add New… → Project** → import the `unifix` repository.
2. Set **Root Directory** to `frontend` (click *Edit*). Framework preset: **Vite** (auto-detected).
3. Open **Environment Variables** and add:

| Key | Value |
|---|---|
| `VITE_API_URL` | your Render URL, e.g. `https://unifix-api-xxxx.onrender.com` (no trailing slash) |

4. Click **Deploy**. After ~1 minute you get `https://unifix-xxxx.vercel.app`.

## Step 5 – Lock CORS to your website

Back on Render → your service → **Environment** → change `CORS_ORIGINS` to your Vercel URL
(e.g. `https://unifix-xxxx.vercel.app`) → **Save, rebuild and deploy**.

## Step 6 – Test the live site

1. Open the Vercel URL, click the **Admin** demo button, log in.
2. Log in as **Student**, report a problem with a photo.
3. Log in as **Admin**, assign it to an officer.
4. Log in as **Officer** (`officer1@unifix.edu.ng` / `Officer1234`), start and complete it.
5. Back as **Student**: the bell shows notifications and the timeline shows every step.

Take screenshots of each step for the report's *Deployment* section.

---

### Good to know

- **Render free tier sleeps after 15 minutes of no traffic.** The first request afterwards
  takes about 50 seconds while it wakes up. Open `/api/health` a minute before a demo or
  before the lecturer is likely to check.
- To reset the demo data: Neon → SQL Editor → `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`
  then on Render click **Manual Deploy → Restart service**.
- Change the demo passwords before sharing the link widely.
