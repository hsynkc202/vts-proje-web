const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');

const app = express();
app.use(cors());
app.use(express.json());

// MySQL veritabanı bağlantısı
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root', // MySQL kullanıcı adınızı yazın
  password: '', // MySQL şifrenizi yazın
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
  const roleQuery = 'SELECT id FROM roles WHERE name = ?';
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

app.listen(3001, () => {
  console.log('Backend API çalışıyor: http://localhost:3001');
});
