CREATE TABLE IF NOT EXISTS contacts (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NULL,
    subject VARCHAR(255) NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bookings (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    pickup_location VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    travel_date DATE NOT NULL,
    pickup_time TIME NOT NULL,
    passengers VARCHAR(50) NOT NULL,
    vehicle_type VARCHAR(100) NOT NULL,
    return_trip TINYINT(1) NOT NULL DEFAULT 0,
    flight_number VARCHAR(100) NULL,
    hotel VARCHAR(255) NULL,
    additional_requests TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
