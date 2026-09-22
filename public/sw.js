// SGA Tata CRM - Web Push Service Worker

self.addEventListener('push', function(event) {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: '🚗 SGA Tata CRM', body: event.data.text() };
    }
  }

  const title = data.title || '🚗 SGA Tata CRM';
  const options = {
    body: data.body || 'New Lead Received!',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'sga-tata-lead-alert',
    renotify: true,
    vibrate: [200, 100, 200],
    data: data.url || '/dashboard',
    actions: [
      { action: 'open', title: 'Open Dashboard' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const urlToOpen = event.notification.data || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes('/dashboard') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
