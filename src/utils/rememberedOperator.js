const KEY = 'friozo_saved_operator_login';

export function readRememberedOperator(storage) {
  if (!storage) return '';
  try {
    const saved = storage.getItem(KEY);
    if (!saved) return '';
    const parsed = JSON.parse(saved);
    const user = typeof parsed?.user === 'string' ? parsed.user : '';
    if (!user) {
      storage.removeItem(KEY);
      return '';
    }
    if (Object.keys(parsed).length !== 1) storage.setItem(KEY, JSON.stringify({ user }));
    return user;
  } catch {
    try { storage.removeItem(KEY); } catch { /* storage may be blocked */ }
    return '';
  }
}
