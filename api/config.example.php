<?php

return [
    'host' => getenv('DB_HOST') ?: 'localhost',
    'port' => getenv('DB_PORT') ?: '3306',
    'database' => getenv('DB_NAME') ?: 'replace-with-database-name',
    'username' => getenv('DB_USER') ?: 'replace-with-database-user',
    'password' => getenv('DB_PASSWORD') ?: 'replace-with-database-password',
    'notification_email' => getenv('NOTIFICATION_EMAIL') ?: 'contact@oumamatours.site',
];
