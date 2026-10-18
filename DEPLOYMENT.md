# Oumama Tours deployment

## 1. Prepare MySQL

Create the `oumama_tours` database, then import `backend/schema.sql` in phpMyAdmin to create the `bookings`, `contacts`, and `notification_outbox` tables. For an existing installation, run the updated schema so the notification queue table is created. Keep database credentials only in the hosting provider's environment variables.

## 2. Configure the backend

Configure these variables in Hostinger's Node.js application settings (do not commit a `.env` file):

- `PORT`: the port supplied by the hosting provider, when required.
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`: production MySQL credentials.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`: Hostinger SMTP server and mailbox credentials.
- `NOTIFICATION_EMAIL`: administrator address that receives contact and booking notifications.
- `ADMIN_API_KEY`: a long random secret for reading bookings and contact messages.
- `ALLOWED_ORIGINS`: `https://oumamatours.site` when the frontend and API use the same domain.

Never commit `backend/.env`.

## 3. Build and start

Configure Hostinger to run the Node.js application from the `backend` directory and use its start command:

```text
npm ci
npm start
```

Use Node.js 20 or newer in Hostinger's application settings (required by the patched Nodemailer release).

The Express server serves both the static site in `backend/public` and its API on the same origin. The contact and booking forms send JSON to `/api/contacts` and `/api/bookings`; the legacy PHP files outside `backend/public` are not used by this deployment. Verify:

```text
GET /api/health
GET /index.html
```

`GET /api/health` must return HTTP 200 before the public forms can save data. If it returns 500, check the Hostinger MySQL values and confirm that `backend/schema.sql` was imported into the selected database.

Each form submission and its notification queue item are saved in one MySQL transaction. The Express process retries queued messages indefinitely with increasing delays (up to six hours between attempts) after SMTP errors; queued items survive process restarts. Delivery is at-least-once, so a restart during SMTP acknowledgement may result in a duplicate notification. The queue stores only the related contact or booking ID, not another copy of the form data. Check Hostinger's Node.js logs for sanitized notification error codes; SMTP secrets and error messages are not logged.

## 4. Admin API

The public forms use `POST /api/bookings` and `POST /api/contacts`. Reading customer data requires the admin header:

```text
x-admin-key: your ADMIN_API_KEY
```

Use HTTPS in production and rotate this key if it is exposed.

## 5. Before launch

Replace the placeholder WhatsApp number, phone number, email address, social links, privacy policy, and terms links in the HTML files. Test one booking and one contact message against the production database, then remove or restrict any temporary test records.
