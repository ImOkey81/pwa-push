const express = require('express');
const path = require('path');
const webpush = require('web-push');

const app = express();
const port = process.env.PORT || 3000;
const adminToken = process.env.ADMIN_TOKEN || 'changeme-admin-token';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

let activeVapidKeys;

if (vapidPublicKey && vapidPrivateKey) {
  activeVapidKeys = {
    publicKey: vapidPublicKey,
    privateKey: vapidPrivateKey,
  };
} else {
  activeVapidKeys = webpush.generateVAPIDKeys();
  console.warn('VAPID keys were not provided. Generated ephemeral keys for this process.');
  console.warn('Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY for stable subscriptions across restarts.');
}

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
  activeVapidKeys.publicKey,
  activeVapidKeys.privateKey,
);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let seq = 1;
const subscriptionsById = new Map();
const endpointToId = new Map();

const makeSubscriptionId = () => `sub_${(seq++).toString(36).padStart(6, '0')}`;

function isValidSubscription(value) {
  return (
    value
    && typeof value === 'object'
    && typeof value.endpoint === 'string'
    && value.endpoint.length > 0
    && value.keys
    && typeof value.keys === 'object'
    && typeof value.keys.p256dh === 'string'
    && value.keys.p256dh.length > 0
    && typeof value.keys.auth === 'string'
    && value.keys.auth.length > 0
  );
}

function normalizeActionUrl(actionUrl) {
  if (typeof actionUrl !== 'string' || actionUrl.length === 0) {
    return '/';
  }
  return actionUrl;
}

app.get('/api/public/vapid-public-key', (req, res) => {
  res.json({ publicKey: activeVapidKeys.publicKey });
});

app.post('/api/subscriptions', (req, res) => {
  try {
    const { subscription } = req.body || {};

    if (!isValidSubscription(subscription)) {
      return res.status(400).json({ ok: false, error: 'Invalid subscription payload' });
    }

    if (endpointToId.has(subscription.endpoint)) {
      const existingId = endpointToId.get(subscription.endpoint);
      subscriptionsById.set(existingId, subscription);
      return res.status(200).json({ ok: true, subscriptionId: existingId });
    }

    const subscriptionId = makeSubscriptionId();
    endpointToId.set(subscription.endpoint, subscriptionId);
    subscriptionsById.set(subscriptionId, subscription);

    return res.status(201).json({ ok: true, subscriptionId });
  } catch (error) {
    console.error('Failed to register subscription', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

function validateSendRequest(body) {
  if (!body || typeof body !== 'object') return 'Body is required';

  const { audience, notification } = body;

  if (!audience || typeof audience !== 'object' || typeof audience.type !== 'string') {
    return 'audience.type is required';
  }

  if (!['all', 'byId'].includes(audience.type)) {
    return 'audience.type must be one of: all, byId';
  }

  if (audience.type === 'byId' && (typeof audience.subscriptionId !== 'string' || !audience.subscriptionId)) {
    return 'audience.subscriptionId is required for byId';
  }

  if (!notification || typeof notification !== 'object') {
    return 'notification object is required';
  }

  const requiredFields = ['title', 'body', 'actionUrl'];
  for (const field of requiredFields) {
    if (typeof notification[field] !== 'string' || notification[field].length === 0) {
      return `notification.${field} is required`;
    }
  }

  return null;
}

function collectAudience(audience) {
  if (audience.type === 'all') {
    return Array.from(subscriptionsById.entries());
  }

  const subscription = subscriptionsById.get(audience.subscriptionId);
  if (!subscription) {
    return [];
  }
  return [[audience.subscriptionId, subscription]];
}

function removeSubscription(subscriptionId, subscription) {
  subscriptionsById.delete(subscriptionId);
  if (subscription && subscription.endpoint) {
    endpointToId.delete(subscription.endpoint);
  }
}

app.post('/api/admin/push/send', async (req, res) => {
  const token = req.get('X-Admin-Token');
  if (!token || token !== adminToken) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const validationError = validateSendRequest(req.body);
  if (validationError) {
    return res.status(400).json({ ok: false, error: validationError });
  }

  const { audience, notification } = req.body;
  const recipients = collectAudience(audience);

  let sent = 0;
  let failed = 0;

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    actionUrl: normalizeActionUrl(notification.actionUrl),
  });

  await Promise.all(recipients.map(async ([subscriptionId, subscription]) => {
    try {
      await webpush.sendNotification(subscription, payload);
      sent += 1;
    } catch (error) {
      failed += 1;
      const statusCode = error && (error.statusCode || error.status);
      if (statusCode === 410) {
        removeSubscription(subscriptionId, subscription);
      }
      console.error(`Failed to send push to ${subscriptionId}`, error && error.body ? error.body : error);
    }
  }));

  return res.status(200).json({ ok: true, sent, failed });
});

app.get('/api/admin/subscriptions', (req, res) => {
  const token = req.get('X-Admin-Token');
  if (!token || token !== adminToken) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  return res.json({
    ok: true,
    count: subscriptionsById.size,
    subscriptions: Array.from(subscriptionsById.entries()).map(([subscriptionId, subscription]) => ({
      subscriptionId,
      endpoint: subscription.endpoint,
    })),
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
