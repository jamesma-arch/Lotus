# The Last Toast at Lotus House — Netlify Edition

This project contains the guest phone app, private role confirmation/scoring, and an optional shared public QR link. There are **seven guests**, with Jack an innocent participant. It uses the original black-and-gold visuals and scoring logic. It does not randomly choose a murderer.

## Free deployment

1. **Extract the ZIP** and upload the contents of `lotus_house_netlify/` to a GitHub repository. Do **not** upload only the ZIP. If the directory remains nested under `lotus_house_netlify/`, set that directory as Netlify's **Base directory**, or move the directory contents to the repository root.
2. In Netlify, **Add new project → Import an existing project → GitHub**. Select the correct repository and branch. Use **Base directory** `lotus_house_netlify` if your repo contains this folder; otherwise leave it blank. Build command: `npm run build`; Publish directory: `public` (relative to base). The included `netlify.toml` configures Functions and API redirects.
3. **Create or connect a PostgreSQL database.** Netlify Database is available on credit-based Free accounts, but uses account credits while active. A separate free-tier PostgreSQL provider such as Neon may also work. You must obtain a connection string (database provision is NOT automatic just by uploading this ZIP). Read current plan limits and avoid enabling paid auto-recharge. Do not put the connection string in source code.
4. Under **Project configuration → Environment variables**, add `DATABASE_URL` (your PostgreSQL connection string), `PIN_PEPPER` (a random secret ≥16 characters), and `SETUP_SECRET` (a DIFFERENT random secret). Scope must include Functions. Redeploy after adding variables.
5. Visit `https://YOUR-SITE.netlify.app/api/health`: if configured it returns JSON with `ok: true` and `initialised:false` before setup. Next visit `/setup.html`, enter `SETUP_SECRET`, and securely save the seven generated PINs. Setup is once per database. **Do not send the setup secret to guests.**
6. Open the main site, sign in as Jack, and send the same public URL and each player's *own* PIN via WhatsApp. Use the Show QR code button only once your public URL is live. If you share the website on WhatsApp, send the public URL, not a local `file://` address.

## Game integrity and limitations

- Only the individual **already assigned** murderer should visit the Murderer page and confirm their role. The app itself does **not** verify possession of the paper role card; participants must follow the honour system. It is not an anti-cheat guarantee.
- One guest can accuse once; seven submissions unlock the murderer's separate scoring page. The murderer validates motive/clue/mission scores; final reveal becomes available when scoring is complete.
- The murderer earns 7/5/3/1 points depending on the number accusing them (0–1/2/3/4+), 2 for the clean astrolabe criterion and 3 for missions. Detectives earn 5/2/2/2/1 by the established rules.
- Character PINs are stored hashed, and the PIN is held in the browser session. **One-time setup PINs appear only once**. Preserve the PIN list securely; a code change won't reset the database. Never use public demo mode as proof that the live database works.
- `/setup.html` is publicly reachable but requires the private setup secret. The site is designed for a friendly private game, not financial or highly sensitive use. You should not share setup screenshots containing PINs or secrets.
- The first database request creates the schema using `CREATE TABLE IF NOT EXISTS`; it never wipes scores. Keep a backup of important results if you plan to delete your Netlify database.

## Local tests

Run `npm install` then `npm test`. Opening `public/index.html` locally runs **demo mode only**, not shared multi-phone testing. Actual shared play must be tested on your live Netlify URL after connecting the database.
