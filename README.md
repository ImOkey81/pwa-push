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

## Переменные окружения

- `PORT` — порт сервера (по умолчанию `3000`)
- `ADMIN_TOKEN` — токен для админ API (по умолчанию `changeme-admin-token`)
- `VAPID_SUBJECT` — subject для VAPID (по умолчанию `mailto:admin@example.com`)
- `VAPID_PUBLIC_KEY` и `VAPID_PRIVATE_KEY` — VAPID-ключи.

Если `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` не заданы, сервер генерирует их при старте (эпhemeral, только для демо).

> Важно: если сервер был перезапущен с другими VAPID-ключами, старые push-подписки в браузере станут невалидными.
> Клиент в этом проекте автоматически перевыпускает подписку при несовпадении ключа, но для стабильной работы
> всё равно рекомендуется использовать постоянные `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`.

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

## Ограничения MVP

- Нет авторизации пользователей.
- Нет БД, очередей и ретраев.
- Подписки теряются при перезапуске.
- Решение не для production.
