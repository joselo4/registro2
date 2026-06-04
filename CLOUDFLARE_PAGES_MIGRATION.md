# Cloudflare Pages Migration

## Secrets to rotate
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID` if you want to move to a new channel/bot
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

## Keep public in the client
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_KEY`

## Add in Cloudflare Pages
Set these environment variables in the Pages project:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL`

If later you move any admin/database actions to Pages Functions, add only there:
- `SUPABASE_SERVICE_ROLE_KEY`

## Deploy steps
1. Push the repo to GitHub/GitLab.
2. Create a Cloudflare Pages project from the repo.
3. Build command: `npm run build`
4. Build output directory: `dist`
5. Add the environment variables above in Production and Preview.
6. Deploy.

## Local preview
- Use `npm run dev` for the UI.
- Use Cloudflare Pages Functions locally with `wrangler pages dev` if you want the `/api/*` routes available.

## Notes
- The browser no longer talks to Telegram or R2 directly.
- Admin passwords should not be stored in `localStorage`.
- Update your Supabase SQL/RPCs so `manage_admin_user` and `get_all_admins` rely on `auth.uid()` / JWT claims instead of `p_admin_password`.
- Keep `verify_admin_login` only if you still want a password-backed fallback; the primary login path is Supabase Auth.
- Keep `order_...` keys hard to guess, which the app now does with UUID-based IDs.
