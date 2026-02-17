const DEFAULT_NOTIFICATION = {
  title: 'Новое уведомление',
  body: 'У вас есть новое сообщение',
  actionUrl: '/',
};

function normalizePayload(data) {
  if (!data || typeof data !== 'object') {
    return DEFAULT_NOTIFICATION;
  }

  const title = typeof data.title === 'string' && data.title ? data.title : DEFAULT_NOTIFICATION.title;
  const body = typeof data.body === 'string' && data.body ? data.body : DEFAULT_NOTIFICATION.body;
  const actionUrl = typeof data.actionUrl === 'string' && data.actionUrl ? data.actionUrl : DEFAULT_NOTIFICATION.actionUrl;

  return { title, body, actionUrl };
}

self.addEventListener('push', (event) => {
  let payload = DEFAULT_NOTIFICATION;

  if (event.data) {
    try {
      payload = normalizePayload(event.data.json());
    } catch (error) {
      payload = DEFAULT_NOTIFICATION;
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: { actionUrl: payload.actionUrl },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetPath = event.notification.data && event.notification.data.actionUrl
    ? event.notification.data.actionUrl
    : '/';

  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });

    if (allClients.length > 0) {
      const appClient = allClients[0];
      const destination = new URL(targetPath, self.location.origin).toString();
      if ('navigate' in appClient) {
        await appClient.navigate(destination);
      }
      await appClient.focus();
      return;
    }

    await clients.openWindow(targetPath);
  })());
});
