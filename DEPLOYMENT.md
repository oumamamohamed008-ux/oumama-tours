# Oumama Tours deployment

## 1. Prepare MySQL

Create the `oumama_tours` database, then import `backend/schema.sql` in phpMyAdmin to create the `bookings` and `contacts` tables expected by the controllers. Keep database credentials only in the hosting provider's environment variables.

## 2. Configure the backend

Copy `backend/.env.example` to a private environment configuration. Set:

- `PORT`: the port supplied by the hosting provider, when required.
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`: production MySQL credentials.
- `ADMIN_API_KEY`: a long random secret for reading bookings and contact messages.
- `ALLOWED_ORIGINS`: `https://oumamatours.site` when the frontend and API use the same domain.

Never commit `backend/.env`.

## 3. Build and start

From the `backend` directory:

```text
npm ci
npm start
```

The Express server serves both the API and the static site. For a Hostinger static/PHP deployment, the public forms use `api/contact.php` and `api/booking.php`. Verify:

```text
GET /api/health
GET /index.html
```

The PHP endpoints read the same `DB_*` environment variables. If Hostinger does not expose Node.js variables to PHP, copy `api/config.php` to a private location outside `public_html` and configure the database values there, then update the two PHP files to require that private config.

`GET /api/health` must return HTTP 200 before the public forms can save data. If it returns 500, check the Hostinger MySQL values and confirm that `backend/schema.sql` was imported into the selected database.

## 4. Admin API

The public forms use `POST /api/bookings` and `POST /api/contacts`. Reading customer data requires the admin header:

```text
x-admin-key: your ADMIN_API_KEY
```

Use HTTPS in production and rotate this key if it is exposed.

## 5. Before launch

Replace the placeholder WhatsApp number, phone number, email address, social links, privacy policy, and terms links in the HTML files. Test one booking and one contact message against the production database, then remove or restrict any temporary test records.
