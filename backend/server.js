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
  const { first_name, last_name, email, password, role } = req.body;
  // Rol id'sini bul
  const roleQuery = 'SELECT id FROM roles WHERE rol = ?';
  db.query(roleQuery, [role], (err, roleResults) => {
    if (err || roleResults.length === 0) {
      return res.status(400).json({ success: false, message: 'Geçersiz rol!' });
    }
    const roleId = roleResults[0].id;
    // Kullanıcıyı ekle
    const insertQuery = 'INSERT INTO users (first_name, last_name, email, password, role_id) VALUES (?, ?, ?, ?, ?)';
    db.query(insertQuery, [first_name, last_name, email, password, roleId], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ success: false, message: 'Bu e-posta ile zaten bir kullanıcı var!' });
        }
        return res.status(500).json({ success: false, message: 'Sunucu hatası!' });
      }
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

app.listen(3001, () => {
  console.log('Backend API çalışıyor: http://localhost:3001');
});
