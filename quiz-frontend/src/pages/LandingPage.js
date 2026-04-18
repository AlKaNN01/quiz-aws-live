import React, { useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import Background from '../components/Background';
import { Toast, useToast } from '../components/Toast';
import { login, checkNickname } from '../services/api';
import fluffyImage from '../assets/fluffy.png';



// İstemci tarafı basit profanity filtresi (backend de kontrol eder — bu sadece hızlı feedback).
const BLOCKED = ['orospu','sik','yarrak','amk','amına','amina','ibne','pezevenk','fuck','shit','cunt','bitch','asshole','nigger','faggot'];
function isProfane(text) {
  const lower = text.toLowerCase().replace(/\s+/g, '');
  return BLOCKED.some(w => lower.includes(w));
}

export default function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast, show } = useToast();

  const [joinCode, setJoinCode] = useState(() => (searchParams.get('joinCode') || '').toUpperCase());
  // Eğer PlayerPage'den NICKNAME_TAKEN ile dönüldüyse alınan nickname'i önceden doldur
  const [nickname, setNickname] = useState('');
  const [nicknameError, setNicknameError] = useState(
    location.state?.nicknameTaken
      ? `"${location.state.nicknameTaken}" zaten lobide var. Farklı bir nickname dene.`
      : ''
  );
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [hostUser, setHostUser] = useState('');
  const [hostPass, setHostPass] = useState('');
  const [loading, setLoading] = useState('');

  const [joinCodeError, setJoinCodeError] = useState('');
  const [adminUserError, setAdminUserError] = useState('');
  const [adminPassError, setAdminPassError] = useState('');
  const [hostUserError, setHostUserError] = useState('');
  const [hostPassError, setHostPassError] = useState('');

  async function joinGame() {
    const code = joinCode.trim().toUpperCase();
    const nick = nickname.trim();
    let hasError = false;
    if (!code) {
      setJoinCodeError('Oyun kodu boş bırakılamaz.');
      hasError = true;
    } else if (code.length !== 6) {
      setJoinCodeError('Oyun kodu tam 6 hane olmalı.');
      hasError = true;
    } else {
      setJoinCodeError('');
    }
    if (!nick) {
      setNicknameError('Nickname boş bırakılamaz.');
      hasError = true;
    } else if (nick.length < 2) {
      setNicknameError('Nickname en az 2 karakter olmalı.');
      hasError = true;
    } else if (isProfane(nick)) {
      setNicknameError('Bu nickname uygun değil, lütfen başka bir isim dene.');
      hasError = true;
    } else {
      setNicknameError('');
    }
    if (hasError) return;
    setLoading('PLAYER');
    try {
      const { taken } = await checkNickname(code, nick);
      if (taken) {
        setNicknameError(`"${nick}" zaten lobide var. Farklı bir nickname dene.`);
        return;
      }
    } catch {
      // API hatası — devam et, backend WS'te de kontrol eder
    } finally {
      setLoading('');
    }
    navigate(`/player?joinCode=${code}&nickname=${encodeURIComponent(nick)}`);
  }

  async function handleLogin(username, password, expectedRole, path, setUserErr, setPassErr) {
    let hasError = false;
    if (!username) { setUserErr('Kullanıcı adı boş bırakılamaz.'); hasError = true; } else setUserErr('');
    if (!password) { setPassErr('Şifre boş bırakılamaz.'); hasError = true; } else setPassErr('');
    if (hasError) return;
    setLoading(expectedRole);
    try {
      const data = await login(username, password);
      if (data.role !== expectedRole) return show('Yetersiz yetki.');
      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('role', data.role);
      navigate(path);
    } catch {
      show('Kullanici adi veya sifre hatali.');
    } finally {
      setLoading('');
    }
  }

  const cards = [
    {
      id: 'player',
      eyebrow: 'Game Access',
      icon: '01',
      title: 'Oyuncu',
      desc: "Oyuna katil, hizli cevap ver ve siralamada yerini al.",
      accent: '#4FC3F7',
      glow: 'rgba(79,195,247,0.28)',
      button: 'linear-gradient(135deg, #58c6ff 0%, #2387ff 100%)',
      content: (
        <>
          <Field
            value={joinCode}
            onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinCodeError(''); }}
            placeholder="Oyun kodu (6 hane)"
            maxLength={6}
            onKeyDown={e => e.key === 'Enter' && joinGame()}
            error={joinCodeError}
          />
          <Field
            value={nickname}
            onChange={e => { setNickname(e.target.value); setNicknameError(''); }}
            placeholder="Nickname"
            maxLength={20}
            onKeyDown={e => e.key === 'Enter' && joinGame()}
            error={nicknameError}
          />
        </>
      ),
      cta: loading === 'PLAYER' ? 'Bekleniyor...' : 'Oyuna Katil',
      onAction: joinGame,
    },
    {
      id: 'admin',
      eyebrow: 'Control Panel',
      icon: '02',
      title: 'Admin',
      desc: '',
      accent: '#C084FC',
      glow: 'rgba(192,132,252,0.28)',
      button: 'linear-gradient(135deg, #b55bff 0%, #7b2fff 100%)',
      content: (
        <>
          <Field
            value={adminUser}
            onChange={e => { setAdminUser(e.target.value); setAdminUserError(''); }}
            placeholder="Kullanıcı adı"
            onKeyDown={e => e.key === 'Enter' && handleLogin(adminUser, adminPass, 'ADMIN', '/admin', setAdminUserError, setAdminPassError)}
            error={adminUserError}
          />
          <Field
            value={adminPass}
            onChange={e => { setAdminPass(e.target.value); setAdminPassError(''); }}
            placeholder="Şifre"
            type="password"
            onKeyDown={e => e.key === 'Enter' && handleLogin(adminUser, adminPass, 'ADMIN', '/admin', setAdminUserError, setAdminPassError)}
            error={adminPassError}
          />
        </>
      ),
      cta: loading === 'ADMIN' ? 'Bekleniyor...' : 'Admin Paneli',
      onAction: () => handleLogin(adminUser, adminPass, 'ADMIN', '/admin', setAdminUserError, setAdminPassError),
    },
    {
      id: 'host',
      eyebrow: 'Stage Screen',
      icon: '03',
      title: 'Host',
      desc: '',
      accent: '#FF9900',
      glow: 'rgba(255,153,0,0.28)',
      button: 'linear-gradient(135deg, #ffb23f 0%, #ff7b00 100%)',
      content: (
        <>
          <Field
            value={hostUser}
            onChange={e => { setHostUser(e.target.value); setHostUserError(''); }}
            placeholder="Kullanıcı adı"
            onKeyDown={e => e.key === 'Enter' && handleLogin(hostUser, hostPass, 'HOST', '/host', setHostUserError, setHostPassError)}
            error={hostUserError}
          />
          <Field
            value={hostPass}
            onChange={e => { setHostPass(e.target.value); setHostPassError(''); }}
            placeholder="Şifre"
            type="password"
            onKeyDown={e => e.key === 'Enter' && handleLogin(hostUser, hostPass, 'HOST', '/host', setHostUserError, setHostPassError)}
            error={hostPassError}
          />
        </>
      ),
      cta: loading === 'HOST' ? 'Bekleniyor...' : 'Host Ekranı',
      onAction: () => handleLogin(hostUser, hostPass, 'HOST', '/host', setHostUserError, setHostPassError),
    },
  ];

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', background: '#12032a' }}>
      <Background />

      <div style={heroGlow('8%', '10%', 420, 'rgba(118, 57, 255, 0.28)')} />
      <div style={heroGlow('52%', '78%', 360, 'rgba(48, 174, 255, 0.20)')} />
      <div style={heroGlow('72%', '18%', 280, 'rgba(255, 153, 0, 0.18)')} />

      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at top right, rgba(162,90,255,0.24), transparent 28%), linear-gradient(135deg, #12032a 0%, #2a0650 40%, #4f148c 72%, #7594cc 130%)',
      }} />

      <div style={{
        position: 'relative',
        zIndex: 1,
        minHeight: '100vh',
        padding: '28px 18px 44px',
      }}>
        <div style={{
         maxWidth: 1220,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 28,
          alignItems: 'stretch',
        }}>
          <section className="hero-section" style={{
            position: 'relative',
            padding: '28px clamp(22px, 4vw, 44px) 36px',
            borderRadius: 36,
            background: 'linear-gradient(160deg, rgba(18,6,45,0.82), rgba(75,17,132,0.66))',
            border: '1px solid rgba(255,255,255,0.14)',
            boxShadow: '0 30px 80px rgba(5,0,20,0.42)',
            backdropFilter: 'blur(18px)',
            overflow: 'hidden',
          }}>
            <div style={cloudLineStyle}>
              <span style={awsTextStyle}></span>
              <div style={{
                position: 'relative',
                width: 170,
                height: 73,
                marginTop: 7,
              }}>
                <div style={outlineCloudStyle} />
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f6fbff',
                  fontWeight: 900,
                  fontSize: 28,
                  lineHeight: 0.9,
                  letterSpacing: '-0.04em',
                }}>
                  <span>Aws</span>
                  <span>Cloud</span>
                  <span>Club</span>
                </div>
              </div>
              <span style={sparkStyle('8%', '86%')}>✦</span>
              <span style={sparkStyle('22%', '6%')}>✦</span>
              <span style={sparkStyle('72%', '92%')}>✦</span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
              alignItems: 'center',
              marginTop: 18,
            }}>
              <div>
                <div style={pillStyle}>
                  İstanbul Okan Üniversitesi
                </div>

                <h1 style={{
                  marginTop: 18,
                  fontSize: 'clamp(44px, 7vw, 86px)',
                  lineHeight: 0.94,
                  letterSpacing: '-0.06em',
                  color: '#ffffff',
                  fontWeight: 900,
                  maxWidth: 620,
                }}>
                  AWS Cloud Club
                  <span style={{
                    display: 'block',
                    marginTop: 12,
                    color: '#ffd08b',
                    fontSize: 'clamp(22px, 3vw, 34px)',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                  }}>
                    QUIZ NIGHT
                  </span>
                </h1>

                <p style={{
                  marginTop: 18,
                  maxWidth: 610,
                  color: 'rgba(240,245,255,0.82)',
                  fontSize: 18,
                  lineHeight: 1.65,
                  fontWeight: 600,
                }}>
                  AWS Cloud Club ruhunu sahneye taşıyan eğlenceli quizimize hoş geldiniz!
                  Oyuncu olarak katılıp dereceye girersen ödülleri kazanmaya hak kazanabilirsin.
                </p>

                <div style={{
                  marginTop: 26,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 12,
                }}>
                  {['Gerçek Zamanlı Quiz'].map((item) => (
                    <div key={item} style={featurePillStyle}>
                      <span style={{ color: '#ff9900', fontWeight: 900 }}>+</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{
                position: 'relative',
                minHeight: 310,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={pageSparkStyle('14%', '14%', 16, 0.78)}>✦</span>
                <span style={pageSparkStyle('28%', '86%', 18, 0.76)}>✦</span>
                <span style={pageSparkStyle('76%', '20%', 15, 0.72)}>✦</span>
                <span style={pageSparkStyle('86%', '82%', 16, 0.8)}>✦</span>
                <div style={{
                  position: 'absolute',
                  top: 6,
                  left: '8%',
                  width: 120,
                  height: 48,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.8)',
                  filter: 'blur(1px)',
                  boxShadow: '0 10px 30px rgba(178, 218, 255, 0.18)',
                }} />
                <div style={{
                  position: 'absolute',
                  bottom: 42,
                  right: '-2%',
                  width: 140,
                  height: 56,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.76)',
                }} />
                <HotAirBalloon />
                <div style={{
                  position: 'absolute',
                  bottom: 14,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 172,
                  height: 28,
                  background: 'radial-gradient(circle, rgba(6,0,32,0.52) 0%, rgba(6,0,32,0) 70%)',
                }} />
              </div>
            </div>
          </section>

          <section className="role-section" style={{
            position: 'relative',
            padding: '22px',
            borderRadius: 36,
            background: 'linear-gradient(180deg, rgba(11, 9, 34, 0.72), rgba(28, 15, 55, 0.72))',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 24px 70px rgba(5,0,20,0.36)',
            backdropFilter: 'blur(20px)',
          }}>
            <span style={pageSparkStyle('10%', '88%', 18, 0.8)}>✦</span>
            <span style={pageSparkStyle('74%', '6%', 16, 0.7)}>✦</span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 18,
            }}>
              <div>
                <div style={{ color: '#ffb74d', fontSize: 12, fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                  Access Portal
                </div>
                <h2 style={{ color: '#fff', fontSize: 34, lineHeight: 1, marginTop: 8, fontWeight: 900 }}>
                  Role Selection
                </h2>
              </div>
              <div style={{
                width: 88,
                height: 88,
                borderRadius: 28,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06))',
                border: '1px solid rgba(255,255,255,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <LandingFluffyImage size={68} />
              </div>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              {cards.map((card, index) => (
                <AccessCard key={card.id} card={card} delay={0.08 * index} />
              ))}
            </div>
          </section>
        </div>

        <div style={{
          maxWidth: 1220,
          margin: '16px auto 0',
          padding: '0 6px',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          color: 'rgba(235,239,255,0.78)',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.03em',
        }}>
          <span>AWS Cloud Club x İstanbul Okan Üniversitesi</span>
          <span>Fluffy ile güçlendirildi!</span>
        </div>
      </div>

      <Toast message={toast} />

      <style>{`
        @keyframes portalIn {
          from { opacity: 0; transform: translateY(18px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes balloonFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-14px); }
        }

        @media (max-width: 680px) {
          .role-section { order: -1; }
          .hero-section { order: 0; }
        }
      `}</style>
    </div>
  );
}

function AccessCard({ card, delay }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        borderRadius: 28,
        padding: '18px 18px 20px',
        background: hovered
          ? 'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.07))'
          : 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05))',
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.12)'}`,
        boxShadow: hovered ? `0 18px 44px ${card.glow}` : 'none',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease',
        animation: `portalIn 0.5s ease ${delay}s both`,
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 14,
      }}>
        <div>
          <div style={{
            color: card.accent,
            fontSize: 11,
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
          }}>
            {card.eyebrow}
          </div>
          <div style={{ color: '#fff', fontSize: 28, fontWeight: 900, marginTop: 6 }}>
            {card.title}
          </div>
        </div>
        <div style={{
          minWidth: 52,
          height: 52,
          borderRadius: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 14,
          fontWeight: 900,
          background: `linear-gradient(180deg, ${card.accent}, rgba(255,255,255,0.08))`,
          boxShadow: `0 10px 26px ${card.glow}`,
        }}>
          {card.icon}
        </div>
      </div>

      <p style={{
        color: 'rgba(235,239,255,0.76)',
        fontSize: 14,
        lineHeight: 1.55,
        fontWeight: 600,
        marginBottom: 14,
      }}>
        {card.desc}
      </p>

      <div style={{ display: 'grid', gap: 10 }}>
        {card.content}
      </div>

      <button
        onClick={card.onAction}
        style={{
          width: '100%',
          marginTop: 14,
          padding: '14px 16px',
          borderRadius: 16,
          border: 'none',
          color: '#fff',
          fontSize: 15,
          fontWeight: 900,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          background: card.button,
          boxShadow: `0 16px 34px ${card.glow}`,
          cursor: 'pointer',
        }}
      >
        {card.cta}
      </button>
    </div>
  );
}

function Field({ error, ...props }) {
  const [focused, setFocused] = useState(false);
  const hasError = !!error;

  return (
    <div style={{ display: 'grid', gap: 5 }}>
      <input
        {...props}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          padding: '13px 15px',
          borderRadius: 15,
          border: hasError
            ? '1px solid rgba(255,107,107,0.70)'
            : `1px solid ${focused ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.12)'}`,
          background: hasError
            ? 'rgba(255,107,107,0.08)'
            : focused ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)',
          color: '#fff',
          outline: 'none',
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: props.maxLength === 6 ? '0.18em' : '0.01em',
          textTransform: props.maxLength === 6 ? 'uppercase' : 'none',
          boxShadow: hasError
            ? '0 0 0 3px rgba(255,107,107,0.12)'
            : focused ? '0 0 0 3px rgba(255,255,255,0.06)' : 'none',
          transition: 'border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease',
          boxSizing: 'border-box',
        }}
      />
      {hasError && (
        <div style={{
          color: '#ffb3b3',
          fontSize: 12,
          fontWeight: 700,
          paddingLeft: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          ⚠ {error}
        </div>
      )}
    </div>
  );
}

function HotAirBalloon() {
  return (
    <div style={{ position: 'relative', animation: 'balloonFloat 5s ease-in-out infinite' }}>
      <svg width="230" height="300" viewBox="0 0 230 300" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="balloonBody" x1="115" y1="18" x2="115" y2="226" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#2f8bff" />
            <stop offset="0.56" stopColor="#5fd5ff" />
            <stop offset="1" stopColor="#2767d6" />
          </linearGradient>
          <linearGradient id="balloonWave" x1="49" y1="104" x2="180" y2="158" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#dff8ff" />
            <stop offset="1" stopColor="#9fe8ff" />
          </linearGradient>
        </defs>
        <path d="M115 20C63 20 33 60 33 124C33 176 66 214 115 235C164 214 197 176 197 124C197 60 167 20 115 20Z" fill="url(#balloonBody)" />
        <path d="M53 116C86 92 126 101 178 127V158C137 140 94 141 51 167L53 116Z" fill="url(#balloonWave)" opacity="0.95" />
        <path d="M92 235H138L144 260H86L92 235Z" fill="#2d57aa" />
        <path d="M84 260H146L140 286H90L84 260Z" fill="#8b5c2d" />
        <path d="M95 20C80 59 74 112 79 178" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.92" />
        <path d="M135 20C150 59 156 112 151 178" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.92" />
        <path d="M64 34C95 76 110 125 106 198" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.92" />
        <path d="M166 34C135 76 120 125 124 198" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.92" />
        <path d="M100 260L92 240" stroke="#fff" strokeWidth="2" />
        <path d="M130 260L138 240" stroke="#fff" strokeWidth="2" />
        <path d="M100 260L98 286" stroke="#3f2a1f" strokeWidth="2" />
        <path d="M130 260L132 286" stroke="#3f2a1f" strokeWidth="2" />
      </svg>
      <div style={{ position: 'absolute', left: '50%', top: 102, transform: 'translateX(-50%) scale(0.8)' }}>
        <LandingFluffyImage size={74} />
      </div>
    </div>
  );
}

function LandingFluffyImage({ size }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      filter: 'drop-shadow(0 10px 26px rgba(19, 7, 53, 0.35))',
    }}>
      <img
        src={fluffyImage}
        alt="Fluffy"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    </div>
  );
}

function heroGlow(top, left, size, color) {
  return {
    position: 'absolute',
    top,
    left,
    width: size,
    height: size,
    borderRadius: '50%',
    background: `radial-gradient(circle, ${color} 0%, rgba(0,0,0,0) 70%)`,
    filter: 'blur(18px)',
    pointerEvents: 'none',
  };
}

const pillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 16px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.08)',
  color: '#f9fbff',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
};

const featurePillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 14px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.10)',
  color: '#f6fbff',
  fontSize: 13,
  fontWeight: 700,
};

const cloudLineStyle = {
  position: 'relative',
  width: 220,
  minWidth: 220,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
};

const awsTextStyle = {
  display: 'block',
  color: '#ffffff',
  fontSize: 32,
  fontWeight: 900,
  lineHeight: 1,
  letterSpacing: '-0.05em',
  textAlign: 'center',
};

const outlineCloudStyle = {
  position: 'absolute',
  inset: 0,
  border: '3px solid rgba(255,255,255,0.96)',
  borderRadius: 999,
  clipPath: 'path("M 25 62 C 12 62 7 54 7 46 C 7 35 16 28 27 28 C 28 12 42 6 53 10 C 59 3 72 1 81 8 C 87 12 90 19 90 28 C 103 28 112 36 112 47 C 112 57 105 64 92 64 L 25 64 Z")',
};

function sparkStyle(top, left) {
  return {
    position: 'absolute',
    top,
    left,
    color: '#dff2ff',
    fontSize: 16,
    opacity: 0.92,
  };
}

function pageSparkStyle(top, left, size, opacity) {
  return {
    position: 'absolute',
    top,
    left,
    color: '#dff2ff',
    fontSize: size,
    opacity,
    textShadow: '0 0 18px rgba(170, 221, 255, 0.28)',
    pointerEvents: 'none',
  };
}
