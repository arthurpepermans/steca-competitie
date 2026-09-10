// Alleen push, geen HTML-cache: updates van de app blijven direct beschikbaar.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch { /* Ook een ongeldig bericht blijft zichtbaar. */ }
  event.waitUntil(self.registration.showNotification(data.title || 'Steca Juniors Clubapp', {
    body: data.body || 'Er staat een nieuwe melding in de app.', icon: './icon-retro-192.png',
    tag: data.tag || 'steca-club', data: { url: data.url || self.location.origin + '/#/meldingen' }
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/#/meldingen', self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil((async () => {
    const vensters = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const open = vensters.find(c => new URL(c.url).origin === url.origin);
    if (open) { await open.navigate(url.href); await open.focus(); }
    else await self.clients.openWindow(url.href);
  })());
});
