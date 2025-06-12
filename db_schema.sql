-- Tiny House Rezervasyon ve Yönetim Sistemi MySQL Scripti
-- ER diyagramına uygun temel tablo ve constraint yapısı

CREATE DATABASE IF NOT EXISTS tinyhouse_db;
USE tinyhouse_db;

-- Roller Tablosu
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- Varsayılan roller ekle
INSERT INTO roles (name) VALUES ('admin'), ('user')
    ON DUPLICATE KEY UPDATE name=name;

-- Kullanıcılar Tablosu
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role_id INT NOT NULL,
    status ENUM('active','passive') DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Tiny House İlanları Tablosu
CREATE TABLE listings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL CHECK (price > 0),
    location VARCHAR(100) NOT NULL,
    photo_url VARCHAR(255),
    status ENUM('active','passive','deleted') DEFAULT 'active',
    available_from DATE NOT NULL,
    available_to DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Rezervasyonlar Tablosu
CREATE TABLE reservations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    listing_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('pending','approved','rejected','cancelled','completed') DEFAULT 'pending',
    payment_status ENUM('pending','paid','refunded') DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES users(id),
    FOREIGN KEY (listing_id) REFERENCES listings(id)
);

-- Yorumlar Tablosu (Bir rezervasyon için bir kullanıcı bir kez yorum yapabilir, ev sahibi cevap verebilir)
CREATE TABLE reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reservation_id INT NOT NULL,
    user_id INT NOT NULL,
    rating INT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    is_owner_reply BOOLEAN DEFAULT FALSE,
    reply_to_review_id INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reservation_id) REFERENCES reservations(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (reply_to_review_id) REFERENCES reviews(id),
    UNIQUE (reservation_id, user_id, is_owner_reply)
);

-- Ödemeler Tablosu
CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reservation_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending','completed','failed','refunded') DEFAULT 'pending',
    FOREIGN KEY (reservation_id) REFERENCES reservations(id)
);

-- Örnek Trigger
DELIMITER //
CREATE TRIGGER before_insert_reservation
BEFORE INSERT ON reservations
FOR EACH ROW
BEGIN
    IF NEW.start_date < CURDATE() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rezervasyon tarihi geçmiş olamaz!';
    END IF;
END;//
DELIMITER ;

-- Örnek Function
DELIMITER //
CREATE FUNCTION get_active_listing_count(owner INT) RETURNS INT
    DETERMINISTIC
BEGIN
    DECLARE cnt INT;
    SELECT COUNT(*) INTO cnt FROM listings WHERE owner_id = owner AND status = 'active';
    RETURN cnt;
END;//
DELIMITER ;

-- Örnek Stored Procedure
DELIMITER //
CREATE PROCEDURE cancel_reservation(IN res_id INT)
BEGIN
    UPDATE reservations SET status = 'cancelled' WHERE id = res_id;
END;//
DELIMITER ;

DELIMITER //
CREATE PROCEDURE get_active_user_count()
BEGIN
    SELECT COUNT(*) AS active_user_count FROM users WHERE status = 'active';
END;//
DELIMITER ;
