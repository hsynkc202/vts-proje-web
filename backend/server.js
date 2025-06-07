const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');

const app = express();
app.use(cors());
app.use(express.json());

// MySQL veritabanı bağlantısı
const db = mysql.createConnection({
  host: 'localhost',
  user: 'vtsuser', // Yeni MySQL kullanıcı adı
  password: 'vts1234', // Yeni MySQL şifresi
  database: 'tinyhouse_db'
});

db.connect((err) => {
  if (err) {
    console.error('Veritabanı bağlantı hatası:', err);
  } else {
    console.log('MySQL veritabanına bağlanıldı!');
  }
});

// Giriş endpointi (veritabanı üzerinden)
app.post('/api/login', (req, res) => {
  const { email, password, role } = req.body;
  // role bilgisini almak için önce roles tablosundan id'yi bul
  const roleQuery = 'SELECT id FROM roles WHERE rol = ?';
  db.query(roleQuery, [role], (err, roleResults) => {
    if (err || roleResults.length === 0) {
      return res.status(401).json({ success: false, message: 'Geçersiz rol!' });
    }
    const roleId = roleResults[0].id;
    // Kullanıcıyı sorgula
    const userQuery = 'SELECT * FROM users WHERE email = ? AND password = ? AND role_id = ? AND status = \'active\'';
    db.query(userQuery, [email, password, roleId], (err, results) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Sunucu hatası!' });
      }
      if (results.length > 0) {
        res.json({ success: true, role: role, message: 'Giriş başarılı!' });
      } else {
        res.status(401).json({ success: false, message: 'Geçersiz bilgiler!' });
      }
    });
  });
});

// Kayıt ol endpointi
app.post('/api/register', (req, res) => {
  const { first_name, last_name, email, password } = req.body;
  console.log('Kayıt isteği:', req.body); // Gelen veriyi logla
  // Sadece user rolünün id'sini bul
  const roleQuery = "SELECT id FROM roles WHERE rol = 'user'";
  db.query(roleQuery, (err, roleResults) => {
    if (err || roleResults.length === 0) {
      console.error('Rol sorgu hatası:', err, roleResults);
      return res.status(400).json({ success: false, message: 'Kullanıcı rolü bulunamadı!' });
    }
    const roleId = roleResults[0].id;
    console.log('Bulunan user rol id:', roleId);
    // Kullanıcıyı ekle
    const insertQuery = 'INSERT INTO users (first_name, last_name, email, password, role_id) VALUES (?, ?, ?, ?, ?)';
    db.query(insertQuery, [first_name, last_name, email, password, roleId], (err, result) => {
      if (err) {
        console.error('Kullanıcı ekleme hatası:', err);
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ success: false, message: 'Bu e-posta ile zaten bir kullanıcı var!' });
        }
        return res.status(500).json({ success: false, message: 'Sunucu hatası!' });
      }
      console.log('Kullanıcı başarıyla eklendi:', result);
      res.json({ success: true, message: 'Kayıt başarılı!' });
    });
  });
});

// İlan ekle endpointi
app.post('/api/listings', (req, res) => {
  const { owner_email, title, description, price, location, photo_url, available_from, available_to } = req.body;
  // Önce owner_id'yi bul
  const userQuery = 'SELECT id FROM users WHERE email = ?';
  db.query(userQuery, [owner_email], (err, userResults) => {
    if (err || userResults.length === 0) {
      return res.status(400).json({ success: false, message: 'Ev sahibi bulunamadı!' });
    }
    const owner_id = userResults[0].id;
    const insertQuery = `INSERT INTO listings (owner_id, title, description, price, location, photo_url, available_from, available_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    db.query(insertQuery, [owner_id, title, description, price, location, photo_url, available_from, available_to], (err, result) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'İlan eklenemedi!' });
      }
      res.json({ success: true, message: 'İlan başarıyla eklendi!' });
    });
  });
});

// Tüm ilanları listele endpointi
app.get('/api/listings', (req, res) => {
  const query = `SELECT l.*, u.first_name, u.last_name FROM listings l JOIN users u ON l.owner_id = u.id WHERE l.status = 'active' ORDER BY l.created_at DESC`;
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'İlanlar alınamadı!' });
    }
    res.json({ success: true, listings: results });
  });
});

// Kiracı rezervasyon oluşturur
app.post('/api/reservations', (req, res) => {
  const { tenant_email, listing_id, start_date, end_date } = req.body;
  // tenant_id'yi bul
  db.query('SELECT id FROM users WHERE email = ?', [tenant_email], (err, userResults) => {
    if (err || userResults.length === 0) {
      return res.status(400).json({ success: false, message: 'Kiracı bulunamadı!' });
    }
    const tenant_id = userResults[0].id;
    // Rezervasyon ekle
    const insertQuery = `INSERT INTO reservations (tenant_id, listing_id, start_date, end_date) VALUES (?, ?, ?, ?)`;
    db.query(insertQuery, [tenant_id, listing_id, start_date, end_date], (err, result) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Rezervasyon eklenemedi!' });
      }
      res.json({ success: true, message: 'Rezervasyon talebiniz iletildi!' });
    });
  });
});

// Ev sahibi: Kendi ilanlarına gelen rezervasyonları görür
app.get('/api/owner/reservations', (req, res) => {
  const { owner_email } = req.query;
  db.query('SELECT id FROM users WHERE email = ?', [owner_email], (err, userResults) => {
    if (err || userResults.length === 0) {
      return res.status(400).json({ success: false, message: 'Ev sahibi bulunamadı!' });
    }
    const owner_id = userResults[0].id;
    const query = `SELECT r.*, l.title, u.first_name AS tenant_first, u.last_name AS tenant_last FROM reservations r JOIN listings l ON r.listing_id = l.id JOIN users u ON r.tenant_id = u.id WHERE l.owner_id = ? ORDER BY r.created_at DESC`;
    db.query(query, [owner_id], (err, results) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Rezervasyonlar alınamadı!' });
      }
      res.json({ success: true, reservations: results });
    });
  });
});

// Kiracı: Kendi rezervasyonlarını görür
app.get('/api/tenant/reservations', (req, res) => {
  const { tenant_email } = req.query;
  db.query('SELECT id FROM users WHERE email = ?', [tenant_email], (err, userResults) => {
    if (err || userResults.length === 0) {
      return res.status(400).json({ success: false, message: 'Kiracı bulunamadı!' });
    }
    const tenant_id = userResults[0].id;
    const query = `SELECT r.*, l.title, l.location FROM reservations r JOIN listings l ON r.listing_id = l.id WHERE r.tenant_id = ? ORDER BY r.created_at DESC`;
    db.query(query, [tenant_id], (err, results) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Rezervasyonlar alınamadı!' });
      }
      res.json({ success: true, reservations: results });
    });
  });
});

// Ev sahibi rezervasyonu onaylar
app.post('/api/reservations/:id/approve', (req, res) => {
  const reservationId = req.params.id;
  db.query('UPDATE reservations SET status = "approved" WHERE id = ?', [reservationId], (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Onaylanamadı!' });
    }
    res.json({ success: true, message: 'Rezervasyon onaylandı!' });
  });
});

// Ev sahibi rezervasyonu reddeder
app.post('/api/reservations/:id/reject', (req, res) => {
  const reservationId = req.params.id;
  db.query('UPDATE reservations SET status = "rejected" WHERE id = ?', [reservationId], (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Reddedilemedi!' });
    }
    res.json({ success: true, message: 'Rezervasyon reddedildi!' });
  });
});

// Kiracı veya admin rezervasyonu iptal eder
app.post('/api/reservations/:id/cancel', (req, res) => {
  const reservationId = req.params.id;
  db.query('UPDATE reservations SET status = "cancelled" WHERE id = ?', [reservationId], (err, result) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'İptal edilemedi!' });
    }
    res.json({ success: true, message: 'Rezervasyon iptal edildi!' });
  });
});

// Admin tüm rezervasyonları görür
app.get('/api/admin/reservations', (req, res) => {
  const query = `SELECT r.*, l.title, l.location, o.first_name AS owner_first, o.last_name AS owner_last, u.first_name AS tenant_first, u.last_name AS tenant_last FROM reservations r JOIN listings l ON r.listing_id = l.id JOIN users o ON l.owner_id = o.id JOIN users u ON r.tenant_id = u.id ORDER BY r.created_at DESC`;
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Rezervasyonlar alınamadı!' });
    }
    res.json({ success: true, reservations: results });
  });
});

app.listen(3001, () => {
  console.log('Backend API çalışıyor: http://localhost:3001');
});
