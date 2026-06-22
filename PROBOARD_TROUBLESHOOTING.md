# ProBoard — Troubleshooting & Known Issues Log

> Last updated: June 22, 2026  
> Server: `192.168.31.253` | Board: `:8090` | API: `:3001`

---

## Architecture Overview

```
Browser/TV → nginx (8090) → index.html + admin.html
                ↓
         Express API (3001)
                ↓
         PostgreSQL evolution_db → database: proboard → table: employees
```

---

## Issue 1 — Tailwind CSS not loading (unstyled page)

**Symptom:** Page loads but has no styling — raw HTML, no dark theme, no layout.

**Root cause:** The server has no internet access, so `cdn.tailwindcss.com` fails to load.

**Fix:** Make sure `index.html` and `admin.html` use the CDN script tag (not a local file):
```html
<script src="https://cdn.tailwindcss.com"></script>
```

If the TV/display machine has no internet, the only real fix is to build Tailwind locally:
```bash
# On a machine WITH internet, inside the project folder:
npx tailwindcss@3.4.1 --content "./index.html,./admin.html,./js/*.js" --output css/tailwind.min.css --minify
```
Then replace the CDN script tag with:
```html
<link rel="stylesheet" href="/css/tailwind.min.css">
```
Then commit and push.

> ⚠️ The built CSS will only include classes actually used in HTML/JS files. Dynamic classes injected via JS strings may be missing. If styling breaks after adding new Tailwind classes in JS, rebuild.

---

## Issue 2 — Board shows "Loading..." / "Waiting for first sync"

**Symptom:** Board page loads but champion zone is empty, footer says "Waiting for first sync".

**Root cause:** The Express API (`proboard_api` container) failed to connect to PostgreSQL on startup — PostgreSQL was still initializing when the API started.

**Fix:**
```bash
docker restart proboard_api
docker logs proboard_api --tail 10
```
Should show: `ProBoard API running on port 3001` with no DB errors.

**Prevention:** Add a health check or retry loop in `api/server.js` so it retries the DB connection instead of crashing silently.

---

## Issue 3 — Admin panel shows 404

**Symptom:** Going to `192.168.31.253:8090/admin` returns nginx 404.

**Root cause:** The file is `admin.html` not a directory named `admin`.

**Fix:** Use the correct URL:
```
http://192.168.31.253:8090/admin.html
```

---

## Issue 4 — Champion avatar is rectangle not circle

**Symptom:** Employee photo shows as a square/rectangle instead of a circle.

**Root cause:** The `img` element has `rounded-full` but its container is missing `overflow: hidden`.

**Fix in `js/renderer.js`:** Wrap the `img` tag in a div with `overflow: hidden`:
```js
return `
  <div class="rounded-full overflow-hidden ${imgCls}">
    <img src="${employee.avatar}" alt="${employee.name}"
         class="w-full h-full object-cover"
         onerror="this.parentElement.style.display='none';this.parentElement.nextElementSibling.style.display='flex';">
  </div>
  <div class="avatar-circle ${sizeCls}" style="background:${color};display:none;">${initials}</div>
`;
```

---

## Issue 5 — Champion card too wide / no side margins

**Symptom:** Champion card stretches full width of left column with no breathing room.

**Fix in `js/renderer.js`:** Add `max-width: 320px` and `margin: auto` to the champion card div:
```js
<div class="champion-card champion-border champion-glow rounded-2xl p-8 flex flex-col items-center justify-center text-center"
     style="background: linear-gradient(...); max-width: 320px; margin: auto;">
```

---

## Issue 6 — Responsive layout broke everything

**Symptom:** After applying responsive/clamp CSS changes, the layout collapsed — avatar became rectangle, right column disappeared, header unstyled.

**Root cause:** `clamp()` values and Tailwind breakpoint overrides conflicted with the existing fixed layout.

**Fix — revert via git:**
```bash
cd "/home/khaled/Desktop/pro engineers/proboard"
git log --oneline -10   # find the last good commit hash
git checkout <GOOD_COMMIT_HASH> -- index.html css/board.css js/renderer.js
git add index.html css/board.css js/renderer.js
git commit -m "revert: restore working layout"
git push origin main
```
Then on the server:
```bash
cd ~/proboard && git pull && docker compose restart board
```

> ⚠️ Do NOT attempt responsive layout changes without first testing on a local browser at 1920×1080. The TV layout uses fixed px values that break when clamp() is applied incorrectly.

---

## Issue 7 — Git push fails: "src refspec main does not match any"

**Symptom:** `git push -u origin main` returns error.

**Root cause:** Git initialized the branch as `master` not `main`.

**Fix:**
```bash
git branch -m master main
git push -u origin main
```

---

## Issue 8 — GitHub clone fails with "Invalid username or token"

**Symptom:** `git clone https://github.com/KRU4/proboard.git` asks for password and rejects it.

**Root cause:** GitHub no longer accepts passwords — requires Personal Access Token. Also happens if repo is private.

**Fix Option A:** Make the repo public on GitHub → Settings → Change visibility → Public.

**Fix Option B:** Generate a PAT at `https://github.com/settings/tokens/new` with `repo` scope, then use it as the password when cloning.

---

## Issue 9 — `docker compose up` fails: proboard container name conflict

**Symptom:** Error: `container name "proboard" is already in use`.

**Fix:**
```bash
docker stop proboard
docker rm proboard
docker compose up -d --build
```

---

## Issue 10 — API DB error on startup: "the database system is starting up"

**Symptom:** `docker logs proboard_api` shows `DB init error: the database system is starting up`.

**Root cause:** `proboard_api` starts before `evolution_db` is fully ready.

**Fix (immediate):**
```bash
docker restart proboard_api
```

**Fix (permanent) in `api/server.js`:** Add a retry loop:
```js
async function connectWithRetry(retries = 10, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('DB connected');
      return;
    } catch (err) {
      console.log(`DB not ready, retrying in ${delay}ms... (${i + 1}/${retries})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Could not connect to DB after retries');
}
```

---

## Deployment Checklist (after any code change)

```bash
# On laptop — commit and push
cd "/home/khaled/Desktop/pro engineers/proboard"
git add .
git commit -m "your message"
git push origin main

# On server — pull and restart
cd ~/proboard
git pull
docker compose restart board      # for frontend-only changes
docker compose up -d --build      # for API or Dockerfile changes
```

---

## Server Quick Reference

| Service | Container | Port | Command to restart |
|---|---|---|---|
| Frontend (nginx) | proboard | 8090 | `docker compose restart board` |
| Backend (Express) | proboard_api | 3001 | `docker restart proboard_api` |
| Database (Postgres) | evolution_db | 5432 | `docker restart evolution_db` |

**Check all logs:**
```bash
docker logs proboard --tail 20
docker logs proboard_api --tail 20
docker logs evolution_db --tail 20
```

**Check DB directly:**
```bash
docker exec -it evolution_db psql -U evolution_user -d proboard
SELECT * FROM employees ORDER BY score DESC;
\q
```
