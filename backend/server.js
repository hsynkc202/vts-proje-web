const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

// Basit kullanıcı verisi (örnek)
const users = [
  { id: 1, email: 'admin@site.com', password: 'admin123', role: 'admin' },
  { id: 2, email: 'evsahibi@site.com', password: 'ev123', role: 'owner' },
  { id: 3, email: 'kiraci@site.com', password: 'kiraci123', role: 'tenant' }
];

// Giriş endpointi
app.post('/api/login', (req, res) => {
  const { email, password, role } = req.body;
  const user = users.find(u => u.email === email && u.password === password && u.role === role);
  if (user) {
    res.json({ success: true, role: user.role, message: 'Giriş başarılı!' });
  } else {
    res.status(401).json({ success: false, message: 'Geçersiz bilgiler!' });
  }
});

app.listen(3001, () => {
  console.log('Backend API çalışıyor: http://localhost:3001');
});
