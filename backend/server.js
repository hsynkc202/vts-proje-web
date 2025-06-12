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
        const user = results[0];
        res.json({ success: true, role: role, message: 'Giriş başarılı!', user: { id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email, role_id: user.role_id } });
      } else {
        res.status(401).json({ success: false, message: 'Geçersiz bilgiler!' });
      }
    });
  });
});

// Kayıt ol endpointi
app.post('/api/register', (req, res) => {
  const { first_name, last_name, email, password } = req.body;
  // Sadece user rolünün id'sini bul
  const roleQuery = "SELECT id FROM roles WHERE rol = 'user'";
  db.query(roleQuery, (err, roleResults) => {
    if (err || roleResults.length === 0) {
      return res.status(400).json({ success: false, message: 'Kullanıcı rolü bulunamadı!' });
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
      // Yeni eklenen kullanıcıyı çek
      db.query('SELECT * FROM users WHERE id = ?', [result.insertId], (err, userResults) => {
        if (err || userResults.length === 0) {
          return res.status(500).json({ success: false, message: 'Kullanıcı eklenemedi!' });
        }
        const user = userResults[0];
        res.json({ success: true, message: 'Kayıt başarılı!', user: { id: user.id, first_name: user.first_name, last_name: user.last_name, email: user.email, role_id: user.role_id } });
      });
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
  db.query('SELECT id FROM users WHERE email = ?', [tenant_email], (err, userResults) => {
    if (err || userResults.length === 0) {
      return res.status(400).json({ success: false, message: 'Kiracı bulunamadı!' });
    }
    const tenant_id = userResults[0].id;
    // Önce ilgili listing_id ve price kontrolü
    db.query('SELECT price FROM listings WHERE id = ?', [listing_id], (err, listingResults) => {
      if (err || listingResults.length === 0) {
        return res.status(400).json({ success: false, message: 'İlan bulunamadı veya silinmiş!' });
      }
      const price = listingResults[0].price;
      if (price === null || price === undefined) {
        return res.status(400).json({ success: false, message: 'İlan fiyatı eksik! Lütfen ilanı güncelleyin.' });
      }
      const insertQuery = `INSERT INTO reservations (tenant_id, listing_id, start_date, end_date) VALUES (?, ?, ?, ?)`;
      db.query(insertQuery, [tenant_id, listing_id, start_date, end_date], (err, result) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Rezervasyon eklenemedi!' });
        }
        // Rezervasyon eklendiyse ödeme kaydı oluştur
        const reservationId = result.insertId;
        db.query('CALL add_payment_for_reservation(?)', [reservationId], (err2, result2) => {
          console.log('add_payment_for_reservation result:', result2);
          if (err2) {
            console.error('Ödeme kaydı eklenemedi HATA:', err2); // Hata detayını logla
            return res.status(500).json({ success: false, message: 'Ödeme kaydı eklenemedi!', error: err2 });
          }
          res.json({ success: true, message: 'Rezervasyon ve ödeme kaydı oluşturuldu!' });
        });
      });
    });
  });
});

// Admin: Tüm ödemeleri listele
app.get('/api/admin/payments', (req, res) => {
  db.query('SELECT * FROM admin_payments_view', (err, results) => {
    if (err) {
      // Hata varsa, tablo yoksa veya veri yoksa boş dizi dön
      return res.json({ success: true, payments: [] });
    }
    res.json({ success: true, payments: results });
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
    const query = `SELECT r.*, l.title, u.first_name AS tenant_first, u.last_name AS tenant_last FROM reservations r JOIN listings l ON r.listing_id = l.id JOIN users u ON r.tenant_id = u.id WHERE l.owner_id = ? AND r.status != 'cancelled' ORDER BY r.created_at DESC`;
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

// Admin tüm rezervasyonları görür (duruma ve ev sahibi adına göre filtrelenebilir)
app.get('/api/admin/reservations', (req, res) => {
  const { status, owner } = req.query;
  let query = `SELECT r.*, l.title, l.location, o.first_name AS owner_first, o.last_name AS owner_last, u.first_name AS tenant_first, u.last_name AS tenant_last FROM reservations r JOIN listings l ON r.listing_id = l.id JOIN users o ON l.owner_id = o.id JOIN users u ON r.tenant_id = u.id`;
  const params = [];
  const filters = [];
  if (status && status !== 'all') {
    filters.push('r.status = ?');
    params.push(status);
  }
  if (owner && owner.trim() !== '') {
    filters.push('(o.first_name LIKE ? OR o.last_name LIKE ? OR CONCAT(o.first_name, " ", o.last_name) LIKE ?)');

    params.push(`%${owner}%`, `%${owner}%`, `%${owner}%`);
  }
  if (filters.length > 0) {
    query += ' WHERE ' + filters.join(' AND ');
  }
  query += ' ORDER BY r.created_at DESC';
  db.query(query, params, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Rezervasyonlar alınamadı!' });
    }
    res.json({ success: true, reservations: results });
  });
});

// Kiracı rezervasyonunu günceller (sadece kendi rezervasyonu ve pending durumunda)
app.put('/api/reservations/:id', (req, res) => {
  const reservationId = req.params.id;
  const { tenant_email, start_date, end_date } = req.body;
  // Önce rezervasyonun sahibini ve durumunu kontrol et
  db.query('SELECT r.*, u.email FROM reservations r JOIN users u ON r.tenant_id = u.id WHERE r.id = ?', [reservationId], (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).json({ success: false, message: 'Rezervasyon bulunamadı!' });
    }
    const reservation = results[0];
    if (reservation.email !== tenant_email) {
      return res.status(403).json({ success: false, message: 'Sadece kendi rezervasyonunuzu güncelleyebilirsiniz!' });
    }
    if (reservation.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Sadece beklemede olan rezervasyon güncellenebilir!' });
    }
    // Güncelle
    db.query('UPDATE reservations SET start_date = ?, end_date = ? WHERE id = ?', [start_date, end_date, reservationId], (err, result) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Rezervasyon güncellenemedi!' });
      }
      res.json({ success: true, message: 'Rezervasyon güncellendi!' });
    });
  });
});

// ADMIN GİRİŞ ENDPOINTİ: Sadece adminler giriş yapabilsin
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  // Admin rolünün id'sini bul
  db.query("SELECT id FROM roles WHERE rol = 'admin'", (err, roleResults) => {
    if (err || roleResults.length === 0) {
      console.error('Admin rolü bulunamadı!', err, roleResults); // LOG
      return res.status(500).json({ success: false, message: 'Admin rolü bulunamadı!' });
    }
    const adminRoleId = roleResults[0].id;
    // Sadece admin rolüne sahip kullanıcıyı sorgula
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, userResults) => {
      if (err) {
        console.error('Kullanıcı sorgu hatası:', err); // LOG
        return res.status(500).json({ success: false, message: 'Sunucu hatası!' });
      }
      if (userResults.length === 0) {
        console.warn('Admin email bulunamadı:', email); // LOG
        return res.status(401).json({ success: false, message: 'Kullanıcı bulunamadı!' });
      }
      const user = userResults[0];
      console.log('Admin login denemesi:', { email, password, dbPassword: user.password, role_id: user.role_id, status: user.status }); // LOG
      if (user.password !== password) {
        return res.status(401).json({ success: false, message: 'Şifre yanlış!' });
      }
      if (user.role_id !== adminRoleId) {
        return res.status(401).json({ success: false, message: 'Sadece adminler giriş yapabilir!' });
      }
      if (user.status !== 'active') {
        return res.status(401).json({ success: false, message: 'Kullanıcı pasif!' });
      }
      res.json({ success: true, role: 'admin', message: 'Admin girişi başarılı!' });
    });
  });
});

// Kiracı veya ev sahibi yorum ekler veya cevap verir
app.post('/api/reviews', (req, res) => {
  const { reservation_id, user_id, rating, comment, is_owner_reply, reply_to_review_id } = req.body;
  // Aynı kullanıcı aynı rezervasyon için birden fazla yorum yapamaz (cevap hariç)
  if (!is_owner_reply) {
    db.query('SELECT * FROM reviews WHERE reservation_id = ? AND user_id = ? AND is_owner_reply = 0', [reservation_id, user_id], (err, results) => {
      if (err) {
        console.error('Yorum kontrol hatası:', err); // LOG
        return res.status(500).json({ success: false, message: 'Sunucu hatası!' });
      }
      if (results.length > 0) return res.status(400).json({ success: false, message: 'Bu rezervasyon için zaten yorum yaptınız!' });
      // Yorum ekle
      db.query('INSERT INTO reviews (reservation_id, user_id, rating, comment, is_owner_reply) VALUES (?, ?, ?, ?, 0)', [reservation_id, user_id, rating, comment], (err, result) => {
        if (err) {
          console.error('Yorum ekleme hatası:', err); // LOG
          return res.status(500).json({ success: false, message: 'Yorum eklenemedi!' });
        }
        res.json({ success: true, message: 'Yorum eklendi!' });
      });
    });
  } else {
    // Ev sahibi cevap ekliyor, sadece bir kez cevap verebilir
    db.query('SELECT * FROM reviews WHERE id = ? AND is_owner_reply = 0', [reply_to_review_id], (err, parentResults) => {
      if (err || parentResults.length === 0) {
        if (err) console.error('Cevaplanacak yorum kontrol hatası:', err); // LOG
        return res.status(400).json({ success: false, message: 'Cevaplanacak yorum bulunamadı!' });
      }
      db.query('SELECT * FROM reviews WHERE reservation_id = ? AND user_id = ? AND is_owner_reply = 1', [reservation_id, user_id], (err, results) => {
        if (err) {
          console.error('Ev sahibi cevap kontrol hatası:', err); // LOG
          return res.status(500).json({ success: false, message: 'Sunucu hatası!' });
        }
        if (results.length > 0) return res.status(400).json({ success: false, message: 'Bu yoruma zaten cevap verdiniz!' });
        db.query('INSERT INTO reviews (reservation_id, user_id, rating, comment, is_owner_reply, reply_to_review_id) VALUES (?, ?, NULL, ?, 1, ?)', [reservation_id, user_id, comment, reply_to_review_id], (err, result) => {
          if (err) {
            console.error('Ev sahibi cevap ekleme hatası:', err); // LOG
            return res.status(500).json({ success: false, message: 'Cevap eklenemedi!' });
          }
          res.json({ success: true, message: 'Cevap eklendi!' });
        });
      });
    });
  }
});

// API: Belirli bir rezervasyonun yorumlarını getir
app.get('/api/get-reviews', (req, res) => {
  const { reservation_id } = req.query;
  db.query('SELECT * FROM reviews WHERE reservation_id = ?', [reservation_id], (err, results) => {
    if (err) return res.json({ success: false, reviews: [] });
    res.json({ success: true, reviews: results });
  });
});

// Aktif kullanıcı sayısını döndüren endpoint
app.get('/api/active-user-count', (req, res) => {
  db.query('CALL get_active_user_count()', (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Sunucu hatası!' });
    }
    // results[0][0].active_user_count ile erişilir
    const count = results && results[0] && results[0][0] ? results[0][0].active_user_count : 0;
    res.json({ success: true, active_user_count: count });
  });
});

// ADMIN: Kullanıcı arama (ad, soyad, email ile)
app.get('/api/admin/users', (req, res) => {
  const { q } = req.query;
  let query = 'SELECT * FROM users';
  const params = [];
  if (q && q.trim() !== '') {
    query += ' WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ?';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Kullanıcılar alınamadı!' });
    res.json({ success: true, users: results });
  });
});

// ADMIN: Kullanıcı ekle
app.post('/api/admin/users', (req, res) => {
  const { first_name, last_name, email, password, role } = req.body;
  db.query('SELECT id FROM roles WHERE rol = ?', [role], (err, roleResults) => {
    if (err || roleResults.length === 0) {
      return res.status(400).json({ success: false, message: 'Rol bulunamadı!' });
    }
    const roleId = roleResults[0].id;
    db.query('INSERT INTO users (first_name, last_name, email, password, role_id) VALUES (?, ?, ?, ?, ?)', [first_name, last_name, email, password, roleId], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ success: false, message: 'Bu e-posta ile zaten bir kullanıcı var!' });
        }
        return res.status(500).json({ success: false, message: 'Kullanıcı eklenemedi!' });
      }
      res.json({ success: true, message: 'Kullanıcı eklendi!' });
    });
  });
});

// ADMIN: Kullanıcıyı aktif/pasif yap
app.put('/api/admin/users/:id/status', (req, res) => {
  const userId = req.params.id;
  const { status } = req.body; // 'active' veya 'passive'
  db.query('UPDATE users SET status = ? WHERE id = ?', [status, userId], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Kullanıcı durumu güncellenemedi!' });
    // Kullanıcı pasif/silindi ise rezervasyonları da pasif yap
    if (status === 'passive') {
      db.query('UPDATE reservations SET status = "cancelled" WHERE tenant_id = ? OR listing_id IN (SELECT id FROM listings WHERE owner_id = ?)', [userId, userId]);
    }
    res.json({ success: true, message: 'Kullanıcı durumu güncellendi!' });
  });
});

// ADMIN: Kullanıcı sil
app.delete('/api/admin/users/:id', (req, res) => {
  const userId = req.params.id;
  // Önce rezervasyonları pasif yap
  db.query('UPDATE reservations SET status = "cancelled" WHERE tenant_id = ? OR listing_id IN (SELECT id FROM listings WHERE owner_id = ?)', [userId, userId], (err) => {
    if (err) return res.status(500).json({ success: false, message: 'Rezervasyonlar pasif yapılamadı!' });
    // Sonra kullanıcıyı sil
    db.query('DELETE FROM users WHERE id = ?', [userId], (err2) => {
      if (err2) return res.status(500).json({ success: false, message: 'Kullanıcı silinemedi!' });
      res.json({ success: true, message: 'Kullanıcı ve rezervasyonları silindi!' });
    });
  });
});

app.listen(3001, () => {
  console.log('Backend API çalışıyor: http://localhost:3001');
});
