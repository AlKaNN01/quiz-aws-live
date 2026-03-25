import React from 'react';

/* Arka planda yüzen bulutlar ve parıltılar */
export default function Background() {
  return (
    <>
      <style>{`
        .bg-cloud-shape {
          position: fixed;
          pointer-events: none;
          z-index: 0;
          opacity: 0.12;
          animation: bgCloudFloat linear infinite;
        }
        @keyframes bgCloudFloat {
          0%   { transform: translateX(0) translateY(0); }
          25%  { transform: translateX(30px) translateY(-15px); }
          50%  { transform: translateX(60px) translateY(5px); }
          75%  { transform: translateX(30px) translateY(-10px); }
          100% { transform: translateX(0) translateY(0); }
        }
        .sparkle {
          position: fixed;
          pointer-events: none;
          z-index: 0;
          animation: sparkleAnim ease-in-out infinite;
          font-size: 14px;
        }
        @keyframes sparkleAnim {
          0%,100% { opacity: 0.2; transform: scale(0.8); }
          50%      { opacity: 0.9; transform: scale(1.3); }
        }
      `}</style>

      {/* Floating clouds */}
      {[
        { top: '8%',  left: '-100px', w: 200, color: '#a78bfa', dur: '28s', delay: '0s'   },
        { top: '28%', right: '-80px', w: 160, color: '#7ec8e3', dur: '22s', delay: '-8s'  },
        { top: '58%', left: '-80px',  w: 170, color: '#FF9900', dur: '32s', delay: '-15s' },
        { top: '78%', right: '-60px', w: 130, color: '#a78bfa', dur: '20s', delay: '-5s'  },
        { top: '42%', left: '48%',    w: 140, color: '#7ec8e3', dur: '35s', delay: '-20s' },
      ].map((c, i) => (
        <svg
          key={i}
          className="bg-cloud-shape"
          style={{ top: c.top, left: c.left, right: c.right, width: c.w, animationDuration: c.dur, animationDelay: c.delay }}
          viewBox="0 0 200 100"
        >
          <ellipse cx="100" cy="70" rx="88" ry="35" fill={c.color}/>
          <ellipse cx="68"  cy="55" rx="44" ry="36" fill={c.color}/>
          <ellipse cx="132" cy="52" rx="40" ry="33" fill={c.color}/>
          <ellipse cx="100" cy="48" rx="34" ry="28" fill={c.color}/>
        </svg>
      ))}

      {/* Sparkles */}
      {[
        { top: '12%', left: '14%',  dur: '2.1s', delay: '0s',    color: '#a78bfa' },
        { top: '20%', right: '17%', dur: '1.8s', delay: '0.5s',  color: '#7ec8e3' },
        { top: '68%', left: '7%',   dur: '2.5s', delay: '1s',    color: '#FF9900' },
        { top: '54%', right: '9%',  dur: '2s',   delay: '0.3s',  color: '#a78bfa' },
        { top: '84%', left: '44%',  dur: '1.6s', delay: '0.8s',  color: '#7ec8e3' },
        { top: '35%', left: '30%',  dur: '2.3s', delay: '1.2s',  color: '#FF9900' },
      ].map((s, i) => (
        <span
          key={i}
          className="sparkle"
          style={{ top: s.top, left: s.left, right: s.right, color: s.color, animationDuration: s.dur, animationDelay: s.delay }}
        >✦</span>
      ))}
    </>
  );
}
