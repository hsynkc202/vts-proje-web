import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

const AdminPanel = () => {
  const isAdmin = localStorage.getItem("isAdmin") === "true";
  if (!isAdmin) {
    return <Navigate to="/admin-login" />;
  }
  return (
    <div>
      <h2>Admin Paneli</h2>
      {/* Admin işlemleri burada */}
    </div>
  );
};

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (data.success && data.role === "admin") {
        localStorage.setItem("isAdmin", "true");
        localStorage.setItem("adminToken", data.token);
        navigate("/admin-panel");
      } else {
        setError("E-posta veya şifre yanlış!");
      }
    } catch {
      setError("Sunucu hatası!");
    }
  };

  return (
    <div>
      <h2>Admin Girişi</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="E-posta"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">Giriş Yap</button>
      </form>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
};

export { AdminPanel, AdminLogin };