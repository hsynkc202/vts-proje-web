-- Tiny House Rezervasyon ve Yönetim Sistemi MySQL Scripti
-- ER diyagramına uygun temel tablo ve constraint yapısı

CREATE DATABASE IF NOT EXISTS tinyhouse_db;
USE tinyhouse_db;

-- Roller Tablosu
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rol VARCHAR(50) NOT NULL UNIQUE
);

-- Varsayılan roller ekle
INSERT INTO roles (rol) VALUES ('admin'), ('user')
    ON DUPLICATE KEY UPDATE rol=rol;

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

-- Gecelik fiyata göre ödeme hesaplayan fonksiyon
DELIMITER //
CREATE FUNCTION calculate_payment_amount(listing_id INT, start_date DATE, end_date DATE) RETURNS DECIMAL(10,2)
    DETERMINISTIC
BEGIN
    DECLARE nights INT;
    DECLARE price DECIMAL(10,2);
    SELECT price INTO price FROM listings WHERE id = listing_id;
    SET nights = DATEDIFF(end_date, start_date);
    IF nights < 1 THEN SET nights = 1; END IF;
    RETURN price * nights;
END;//
DELIMITER ;

-- Rezervasyon için ödeme kaydı ekleyen prosedür
DELIMITER //
CREATE PROCEDURE add_payment_for_reservation(IN res_id INT)
BEGIN
    DECLARE l_id INT;
    DECLARE s_date DATE;
    DECLARE e_date DATE;
    DECLARE amount DECIMAL(10,2);
    SELECT listing_id, start_date, end_date INTO l_id, s_date, e_date FROM reservations WHERE id = res_id;
    SET amount = calculate_payment_amount(l_id, s_date, e_date);
    INSERT INTO payments (reservation_id, amount, status) VALUES (res_id, amount, 'pending');
END;//
DELIMITER ;

-- Admin için ödemeleri gösteren view
CREATE OR REPLACE VIEW admin_payments_view AS
SELECT p.id, p.reservation_id, p.amount, p.payment_date, p.status, r.tenant_id, r.listing_id, r.start_date, r.end_date
FROM payments p
JOIN reservations r ON p.reservation_id = r.id;

-- Rezervasyon iptalinde ödeme durumunu güncelleyen trigger
DELIMITER //
CREATE TRIGGER update_payment_on_cancel
AFTER UPDATE ON reservations
FOR EACH ROW
BEGIN
    IF NEW.status = 'cancelled' THEN
        UPDATE payments SET status = 'refunded' WHERE reservation_id = NEW.id;
    END IF;
END;//
DELIMITER ;

-- Rezervasyon tarihi güncellenirse ödeme tutarını otomatik güncelleyen trigger
DELIMITER //
CREATE TRIGGER update_payment_on_reservation_update
AFTER UPDATE ON reservations
FOR EACH ROW
BEGIN
    IF (NEW.start_date <> OLD.start_date OR NEW.end_date <> OLD.end_date) THEN
        DECLARE l_id INT;
        DECLARE new_amount DECIMAL(10,2);
        SET l_id = NEW.listing_id;
        SET new_amount = calculate_payment_amount(l_id, NEW.start_date, NEW.end_date);
        UPDATE payments SET amount = new_amount WHERE reservation_id = NEW.id;
    END IF;
END;//
DELIMITER ;
