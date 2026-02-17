const subscribeButton = document.getElementById('subscribeButton');
const statusEl = document.getElementById('status');

function setSupportStatus(id, isSupported, title) {
  const el = document.getElementById(id);
  el.textContent = `${title}: ${isSupported ? 'поддерживается' : 'не поддерживается'}`;
}

setSupportStatus('swSupport', 'serviceWorker' in navigator, 'Service Worker API');
setSupportStatus('pushSupport', 'PushManager' in window, 'Push API');
setSupportStatus('notifSupport', 'Notification' in window, 'Notifications API');

function updateStatus(message, isError = false) {
  statusEl.textContent = `Статус: ${message}`;
  statusEl.style.background = isError ? '#fef2f2' : '#eff6ff';
}

function base64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function fetchVapidPublicKey() {
  const response = await fetch('/api/public/vapid-public-key');
  if (!response.ok) {
    throw new Error('Не удалось получить публичный VAPID-ключ');
  }
  const data = await response.json();
  if (!data.publicKey) {
    throw new Error('Сервер не вернул VAPID-ключ');
  }
  return data.publicKey;
}

async function registerSubscription(subscription) {
  const response = await fetch('/api/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription }),
  });

  if (![200, 201].includes(response.status)) {
    const body = await response.text();
    throw new Error(`Ошибка регистрации подписки (${response.status}): ${body}`);
  }

  return response.json();
}

async function subscribe() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    updateStatus('Браузер не поддерживает необходимые API', true);
    return;
  }

  subscribeButton.disabled = true;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      updateStatus('Разрешение на уведомления не выдано', true);
      subscribeButton.disabled = false;
      return;
    }

    const registration = await navigator.serviceWorker.register('/service-worker.js');

    // Получаем текущий VAPID ключ с сервера
    const vapidPublicKey = await fetchVapidPublicKey();
    
    // Проверяем существующую подписку
    let subscription = await registration.pushManager.getSubscription();
    
    // Если подписка существует, отписываемся от неё (она могла быть создана со старыми ключами)
    if (subscription) {
      await subscription.unsubscribe();
      subscription = null;
    }
    
    // Создаём новую подписку с актуальным VAPID ключом
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToUint8Array(vapidPublicKey),
      });
    }

    const result = await registerSubscription(subscription.toJSON());
    updateStatus(`подписка активна (${result.subscriptionId})`);
  } catch (error) {
    updateStatus(error.message || 'Не удалось выполнить подписку', true);
    subscribeButton.disabled = false;
  }
}

subscribeButton.addEventListener('click', subscribe);
