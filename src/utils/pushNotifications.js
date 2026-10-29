// Staff push alerts: the phone subscribes once and the server notifies it about new
// orders and table calls, even with the screen locked or the panel closed.
import { supabase } from './supabaseClient';
import { currentSession } from './apiClient';

const decodeKey = (value) => {
  const text = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(text + '='.repeat((4 - (text.length % 4)) % 4));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
};

export const isPushSupported = () =>
  typeof window !== 'undefined' &&
  window.isSecureContext &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

const authorizedPost = async (body) => {
  const session = supabase ? await currentSession(supabase) : null;
  if (!session?.access_token) throw new Error('Inicia sesión en el panel para activar los avisos.');
  const response = await fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo actualizar los avisos.');
  return data;
};

const registration = () => navigator.serviceWorker.register('/sw.js', { scope: '/' });

export async function getPushStatus() {
  if (!isPushSupported()) return { supported: false, configured: false, subscribed: false, permission: 'unsupported' };
  const config = await fetch('/api/push').then(response => response.json()).catch(() => ({}));
  const reg = await navigator.serviceWorker.getRegistration('/');
  const subscription = reg ? await reg.pushManager.getSubscription() : null;
  return { supported: true, configured: Boolean(config.configured), subscribed: Boolean(subscription), permission: Notification.permission };
}

export async function enablePush() {
  if (!isPushSupported()) throw new Error('Este navegador no permite avisos push. Usa Chrome y añade la tienda a la pantalla de inicio.');
  const config = await fetch('/api/push').then(response => response.json());
  if (!config.configured || !config.publicKey) throw new Error('Los avisos push aún no están configurados en el servidor.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permite las notificaciones para este sitio en los ajustes del navegador.');
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const subscription = existing || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(config.publicKey) });
  await authorizedPost({ action: 'subscribe', subscription: subscription.toJSON() });
  return true;
}

export async function disablePush() {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const subscription = reg ? await reg.pushManager.getSubscription() : null;
  if (!subscription) return;
  await authorizedPost({ action: 'unsubscribe', endpoint: subscription.endpoint }).catch(() => {});
  await subscription.unsubscribe();
}

export const sendTestPush = () => authorizedPost({ action: 'test' });
