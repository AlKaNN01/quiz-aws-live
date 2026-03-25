import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Background from '../components/Background';
import Fluffy from '../components/Fluffy';
import { Toast, useToast } from '../components/Toast';
import { login } from '../services/api';

/* Landing page — oyuncu, admin ve host girişi */
export default function LandingPage() {
  const navigate = useNavigate();
  const { toast, show } = useToast();

  const [joinCode, setJoinCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [hostUser, setHostUser] = useState('');
  const [hostPass, setHostPass] = useState('');
  const [loading, setLoading] = useState('');

  function joinGame() {
    const code = joinCode.trim().toUpperCase();
    const nick = nickname.trim();
    if (!code) return show('⚠️ Oyun kodunu gir!');
    if (!nick) return show('⚠️ Nickname gir!');
    navigate(`/player?joinCode=${code}&nickname=${encodeURIComponent(nick)}`);
  }

  async function handleLogin(username, password, expectedRole, path) {
    if (!username) return show('⚠️ Kullanıcı adını gir!');
    if (!password) return show('⚠️ Şifreyi gir!');
    setLoading(expectedRole);
    try {
      const data = await login(username, password);
      if (data.role !== expectedRole) return show('❌ Yetersiz yetki!');
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role);
      navigate(path);
    } catch {
      show('❌ Kullanıcı adı veya şifre hatalı!');
    } finally {
      setLoading('');
    }
  }

  const cards = [
    {
      id: 'player',
      icon: '🎮',
      title: 'Oyuncu Girişi',
      desc: "Quiz'e katıl, sorulara cevap ver ve liderlik tablosuna gir!",
      color: 'linear-gradient(135deg, #7ec8e3, #5ba8d4)',
      iconBg: 'linear-gradient(135deg, #c5e8f5, #a5d8f0)',
      btnColor: 'linear-gradient(135deg, #7ec8e3, #5ba8d4)',
      shadow: 'rgba(91,168,212,0.35)',
      content: (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Oyun kodu (örn: 64EE36)" maxLength={8}
            style={{ letterSpacing: '0.12em', textTransform: 'uppercase' }}
            onKeyDown={e => e.key === 'Enter' && joinGame()} accentColor="rgba(91,168,212,0.5)" />
          <Input value={nickname} onChange={e => setNickname(e.target.value)}
            placeholder="Nickname'ini gir" maxLength={20}
            onKeyDown={e => e.key === 'Enter' && joinGame()} accentColor="rgba(91,168,212,0.5)" />
        </div>
      ),
      btnLabel: loading === 'PLAYER' ? '...' : 'Oyuna Katıl ✨',
      onAction: joinGame,
    },
    {
      id: 'admin',
      icon: '⚡',
      title: 'Admin Girişi',
      desc: 'Quiz oluştur, soruları yönet ve oyunu kontrol et.',
      color: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
      iconBg: 'linear-gradient(135deg, #ddd6fe, #c4b5fd)',
      btnColor: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
      shadow: 'rgba(124,58,237,0.3)',
      content: (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Input value={adminUser} onChange={e => setAdminUser(e.target.value)}
            placeholder="Kullanıcı adı" accentColor="rgba(124,58,237,0.5)"
            onKeyDown={e => e.key === 'Enter' && handleLogin(adminUser, adminPass, 'ADMIN', '/admin')} />
          <Input value={adminPass} onChange={e => setAdminPass(e.target.value)}
            placeholder="Şifre" type="password" accentColor="rgba(124,58,237,0.5)"
            onKeyDown={e => e.key === 'Enter' && handleLogin(adminUser, adminPass, 'ADMIN', '/admin')} />
        </div>
      ),
      btnLabel: loading === 'ADMIN' ? '...' : 'Admin Paneli 🛡️',
      onAction: () => handleLogin(adminUser, adminPass, 'ADMIN', '/admin'),
    },
    {
      id: 'host',
      icon: '📡',
      title: 'Host Girişi',
      desc: 'Projektöre yansıt, QR kodu göster ve oyunu izle.',
      color: 'linear-gradient(135deg, #FF9900, #e8820a)',
      iconBg: 'linear-gradient(135deg, #fde8d8, #fed7aa)',
      btnColor: 'linear-gradient(135deg, #FF9900, #e8820a)',
      shadow: 'rgba(255,153,0,0.35)',
      content: (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Input value={hostUser} onChange={e => setHostUser(e.target.value)}
            placeholder="Kullanıcı adı" accentColor="rgba(255,153,0,0.5)"
            onKeyDown={e => e.key === 'Enter' && handleLogin(hostUser, hostPass, 'HOST', '/host')} />
          <Input value={hostPass} onChange={e => setHostPass(e.target.value)}
            placeholder="Şifre" type="password" accentColor="rgba(255,153,0,0.5)"
            onKeyDown={e => e.key === 'Enter' && handleLogin(hostUser, hostPass, 'HOST', '/host')} />
        </div>
      ),
      btnLabel: loading === 'HOST' ? '...' : 'Host Ekranı 🎯',
      onAction: () => handleLogin(hostUser, hostPass, 'HOST', '/host'),
    },
  ];

  return (
    <div style={{ position: 'relative', minHeight: '100vh', zIndex: 1 }}>
      <Background />

      <div style={{
        position: 'relative', zIndex: 1,
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '32px 16px 48px',
      }}>
        {/* AWS Badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)',
          borderRadius: 999, padding: '6px 16px 6px 10px',
          fontSize: 12, fontWeight: 700, color: '#5b5490',
          border: '1.5px solid rgba(255,255,255,0.8)',
          boxShadow: '0 2px 12px rgba(167,139,250,0.15)',
          marginBottom: 12,
          animation: 'slideDown 0.6s cubic-bezier(.34,1.56,.64,1) both',
        }}>
          <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: '#FF9900' }}>aws</span>
          Cloud Club · İstanbul Okan University
        </div>

        {/* Fluffy */}
        <Fluffy size={150} />
        <div style={{
          width: 100, height: 16,
          background: 'radial-gradient(ellipse, rgba(167,139,250,0.25) 0%, transparent 70%)',
          borderRadius: '50%', margin: '-4px auto 8px',
          animation: 'shadowPulse 4s ease-in-out infinite',
        }} />

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 8, animation: 'slideDown 0.7s cubic-bezier(.34,1.56,.64,1) 0.1s both' }}>
          <h1 style={{
            fontFamily: "'Baloo 2', cursive",
            fontSize: 'clamp(30px, 7vw, 54px)',
            fontWeight: 800, lineHeight: 1.1,
            color: '#2d2063', letterSpacing: '-0.02em',
          }}>
            Merhaba! Ben{' '}
            <span style={{
              background: 'linear-gradient(135deg, #a78bfa, #7ec8e3)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>Fluffy</span>
            {' '}👋
          </h1>
          <p style={{ fontSize: 15, color: '#5b5490', fontWeight: 600, marginTop: 4 }}>
            AWS Cloud Club Quiz'e hoş geldin ☁️
          </p>
        </div>

        {/* Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 20, width: '100%', maxWidth: 920,
          marginTop: 28,
        }}>
          {cards.map((card, i) => (
            <Card key={card.id} card={card} delay={0.15 + i * 0.1} />
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 48, textAlign: 'center', color: '#9b97c0', fontSize: 12, fontWeight: 600 }}>
          Fluffy ile güçlendirildi ☁️ &nbsp;|&nbsp;
          <span style={{ color: '#FF9900', fontWeight: 800 }}>AWS Cloud Club</span>
          {' '}· İstanbul Okan University
        </div>
      </div>

      <Toast message={toast} />

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shadowPulse {
          0%,100% { transform: scaleX(1); opacity: 0.6; }
          50%      { transform: scaleX(0.7); opacity: 0.3; }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(28px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

function Card({ card, delay }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(16px)',
        borderRadius: 28,
        padding: '32px 28px 28px',
        border: '2px solid rgba(255,255,255,0.9)',
        boxShadow: hovered
          ? '0 20px 48px rgba(100,80,200,0.18), 0 4px 16px rgba(0,0,0,0.08)'
          : '0 8px 32px rgba(100,80,200,0.1), 0 2px 8px rgba(0,0,0,0.05)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        transform: hovered ? 'translateY(-8px) scale(1.02)' : 'translateY(0) scale(1)',
        transition: 'transform 0.25s cubic-bezier(.34,1.56,.64,1), box-shadow 0.25s ease',
        animation: `cardIn 0.6s cubic-bezier(.34,1.56,.64,1) ${delay}s both`,
      }}
    >
      {/* Icon */}
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: card.iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36,
      }}>{card.icon}</div>

      {/* Title */}
      <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: '#2d2063' }}>
        {card.title}
      </div>

      {/* Desc */}
      <div style={{ fontSize: 13.5, color: '#9b97c0', textAlign: 'center', lineHeight: 1.5, fontWeight: 600 }}>
        {card.desc}
      </div>

      {/* Inputs */}
      {card.content}

      {/* Button */}
      <button
        onClick={card.onAction}
        style={{
          marginTop: 4, width: '100%', padding: '13px',
          borderRadius: 14, border: 'none',
          background: card.btnColor,
          color: 'white', fontSize: 15, fontWeight: 800,
          boxShadow: `0 4px 16px ${card.shadow}`,
          transition: 'transform 0.15s, box-shadow 0.15s',
          letterSpacing: '0.02em',
        }}
        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        {card.btnLabel}
      </button>
    </div>
  );
}

function Input({ accentColor, style: extraStyle, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%', padding: '12px 16px',
        borderRadius: 12,
        border: `2px solid ${focused ? accentColor || 'rgba(167,139,250,0.6)' : 'rgba(167,139,250,0.2)'}`,
        background: 'rgba(255,255,255,0.8)',
        fontSize: 14, fontWeight: 700, color: '#2d2063',
        outline: 'none',
        boxShadow: focused ? `0 0 0 3px ${accentColor ? accentColor.replace('0.5', '0.1') : 'rgba(167,139,250,0.1)'}` : 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        ...extraStyle,
      }}
    />
  );
}
