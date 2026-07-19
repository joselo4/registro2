# Cloudflare Pages Migration

## Where each secret goes
### Browser / Vite client
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_KEY`

### Cloudflare Pages Functions
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL`

## Secrets to rotate
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID` if you want to move to a new channel/bot
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

## Deploy steps
1. Push the repo to GitHub/GitLab.
2. Create a Cloudflare Pages project from the repo.
3. Build command: `npm run build`
4. Build output directory: `dist`
5. Add the environment variables above in Production and Preview.
6. Run the Supabase SQL script from the SQL Editor, not in local files:
   - `setup_security.sql`
   - this creates/refreshes `verify_admin_login`, `get_all_admins`, and `manage_admin_user`
   - the app now syncs staff/Auth through the Pages Function, so these RPCs are fallback or legacy support
7. Make sure the admin user that changes staff passwords is signed in with Supabase Auth so the Pages Function can reuse its JWT.
8. Deploy.

## Local preview
- Use `npm run dev` for the UI.
- To test `/api/admin-auth-user` in local dev, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
- Use Cloudflare Pages Functions locally with `wrangler pages dev` if you want the `/api/*` routes available.
- If you only use Vite, `/api/admin-auth-user`, `/api/telegram`, and `/api/r2-upload` will not exist locally.

## Notes
- The browser no longer talks to Telegram or R2 directly.
- Admin passwords should not be stored in `localStorage`.
- `staffUsers` is included in the backup export/import now.
- To verify the RPCs exist, run:
  ```sql
  select routine_name
  from information_schema.routines
  where routine_schema = 'public'
    and routine_name in ('verify_admin_login', 'get_all_admins', 'manage_admin_user');
  ```
- Keep `order_...` keys hard to guess, which the app now does with UUID-based IDs.
