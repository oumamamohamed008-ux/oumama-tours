<?php

header('Content-Type: application/json; charset=utf-8');

$config = require __DIR__ . '/config.php';

try {
    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $required = [
        'full_name', 'email', 'phone', 'pickup_location', 'destination',
        'travel_date', 'pickup_time', 'passengers', 'vehicle_type'
    ];

    foreach ($required as $field) {
        if (!isset($input[$field]) || trim((string)$input[$field]) === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Please fill in all required fields.']);
            exit;
        }
    }

    if (!filter_var($input['email'], FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Please enter a valid email address.']);
        exit;
    }

    $dsn = "mysql:host={$config['host']};port={$config['port']};dbname={$config['database']};charset=utf8mb4";
    $pdo = new PDO($dsn, $config['username'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $statement = $pdo->prepare(
        'INSERT INTO bookings (full_name, email, phone, pickup_location, destination, travel_date, pickup_time, passengers, vehicle_type, return_trip, flight_number, hotel, additional_requests) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $statement->execute([
        trim((string)$input['full_name']), trim((string)$input['email']), trim((string)$input['phone']),
        trim((string)$input['pickup_location']), trim((string)$input['destination']), $input['travel_date'],
        $input['pickup_time'], (string)$input['passengers'], trim((string)$input['vehicle_type']),
        !empty($input['return_trip']) ? 1 : 0, trim((string)($input['flight_number'] ?? '')) ?: null,
        trim((string)($input['hotel'] ?? '')) ?: null, trim((string)($input['additional_requests'] ?? '')) ?: null
    ]);

    $mailSubject = 'New booking request - Oumama Tours';
    $mailBody = "Name: {$input['full_name']}\nEmail: {$input['email']}\nPhone: {$input['phone']}\nPickup: {$input['pickup_location']}\nDestination: {$input['destination']}\nDate: {$input['travel_date']}\nTime: {$input['pickup_time']}\nPassengers: {$input['passengers']}\nVehicle: {$input['vehicle_type']}\nReturn trip: " . (!empty($input['return_trip']) ? 'Yes' : 'No') . "\nFlight: " . ($input['flight_number'] ?? '') . "\nHotel: " . ($input['hotel'] ?? '') . "\n\nAdditional requests:\n" . ($input['additional_requests'] ?? '');
    $mailHeaders = "From: Oumama Tours <contact@oumamatours.site>\r\nReply-To: " . filter_var($input['email'], FILTER_SANITIZE_EMAIL) . "\r\nContent-Type: text/plain; charset=UTF-8\r\n";
    if (!mail($config['notification_email'], $mailSubject, $mailBody, $mailHeaders)) {
        error_log('Booking notification email could not be sent.');
    }

    http_response_code(201);
    echo json_encode(['success' => true, 'message' => 'Booking submitted successfully.']);
} catch (Throwable $error) {
    error_log('Booking error: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error while creating booking.']);
}
