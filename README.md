# PWA Push MVP

Минимальный механизм push-уведомлений для PWA на Node.js + Express + web-push.

## Что реализовано

- Регистрация `service-worker.js` и подписка через Push API.
- Запрос разрешения на уведомления в браузере.
- Отправка `PushSubscription` на сервер.
- Хранение подписок в памяти процесса (без БД).
- Админ API для отправки push по аудитории:
  - `all` — всем подписчикам;
  - `byId` — выбранному `subscriptionId`.
- Удаление подписки при ответе push-сервиса `410 Gone`.
- Обработка `push` и `notificationclick` в service worker.

## Запуск

```bash
npm install
npm start
```

Сервер запускается на `http://localhost:3000`.

По умолчанию приложение слушает `0.0.0.0`, поэтому его можно открыть с другого устройства в той же сети (например, с телефона).

## Переменные окружения

- `PORT` — порт сервера (по умолчанию `3000`)
- `HOST` — хост для bind (по умолчанию `0.0.0.0`)
- `ADMIN_TOKEN` — токен для админ API (по умолчанию `changeme-admin-token`)
- `VAPID_SUBJECT` — subject для VAPID (по умолчанию `mailto:admin@example.com`)
- `VAPID_PUBLIC_KEY` и `VAPID_PRIVATE_KEY` — VAPID-ключи.

Если `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` не заданы, сервер генерирует их при старте (эпhemeral, только для демо).

## API

### Публичный API регистрации подписки

`POST /api/subscriptions`

Тело:

```json
{
  "subscription": {
    "endpoint": "https://...",
    "expirationTime": null,
    "keys": {
      "p256dh": "string",
      "auth": "string"
    }
  }
}
```

Ответ:

- `201 Created` — новая подписка
- `200 OK` — подписка с таким endpoint уже была

### Публичный ключ VAPID

`GET /api/public/vapid-public-key`

Ответ:

```json
{
  "publicKey": "..."
}
```

### Админ API отправки push

`POST /api/admin/push/send`

Заголовок:

```text
X-Admin-Token: <ADMIN_TOKEN>
```

Тело:

```json
{
  "audience": { "type": "all" },
  "notification": {
    "title": "Maintenance",
    "body": "Сервис будет недоступен 5 минут",
    "actionUrl": "/status"
  }
}
```

Ответ:

```json
{
  "ok": true,
  "sent": 10,
  "failed": 1
}
```

### Список подписок (вспомогательный демо-эндпоинт)

`GET /api/admin/subscriptions`

Заголовок:

```text
X-Admin-Token: <ADMIN_TOKEN>
```

## Пример отправки push (curl)

```bash
curl -X POST http://localhost:3000/api/admin/push/send \
  -H 'Content-Type: application/json' \
  -H 'X-Admin-Token: changeme-admin-token' \
  -d '{
    "audience": { "type": "all" },
    "notification": {
      "title": "Maintenance",
      "body": "Сервис будет недоступен 5 минут",
      "actionUrl": "/status"
    }
  }'
```

## Как протестировать на телефоне

1. Запустите сервер на ноутбуке/ПК:

   ```bash
   npm start
   ```

2. Посмотрите в логах строку `LAN URL`, например `http://192.168.1.20:3000`.
3. Убедитесь, что телефон и компьютер в одной Wi‑Fi сети.
4. Откройте `LAN URL` на телефоне.

### Важно про Push API

Для подписки на push нужен **secure context** (HTTPS), кроме special-case `localhost`.

- На ПК `http://localhost:3000` работает как secure context.
- На телефоне `http://192.168.x.x:3000` обычно **не** считается secure context, поэтому push-подписка может не работать.

Чтобы реально проверить push на телефоне, используйте HTTPS:

- через туннель (например, Cloudflare Tunnel / ngrok) и откройте HTTPS-URL на телефоне;
- или поднимите локальный HTTPS с доверенным сертификатом.

После этого можно отправлять push обычным запросом к `/api/admin/push/send`.

## Ограничения MVP

- Нет авторизации пользователей.
- Нет БД, очередей и ретраев.
- Подписки теряются при перезапуске.
- Решение не для production.
