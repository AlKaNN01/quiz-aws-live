import React from 'react';

export default function Fluffy({ size = 160, animate = true }) {
  return (
    <div style={{
      display: 'inline-block',
      animation: animate ? 'fluffyFloat 4s ease-in-out infinite' : 'none',
    }}>
      <style>{`
        @keyframes fluffyFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 200 200" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* === ARKA PLAN === */}
        <rect width="200" height="200" rx="20" fill="#5A94C6" />

        {/* === BULUT GÖVDESİ === */}
        {/* Pofuduk lobları görseldeki gibi asimetrik ve yuvarlak olarak ayarladım */}
        <path 
          d="
            M 55 130
            C 25 125, 25 85, 45 80
            C 40 55, 75 45, 85 60
            C 85 30, 125 30, 125 60
            C 135 45, 170 55, 165 80
            C 185 85, 185 125, 155 130
            C 140 145, 70 145, 55 130 Z
          " 
          fill="#FFF6E5" 
          stroke="#3E2723" 
          strokeWidth="5" 
          strokeLinejoin="round" 
        />

        {/* === ELLER / PATİLER === */}
        {/* Patilerin iç içe geçmiş W/V şeklini oluşturmak için iki ayrı path kullandım */}
        {/* Sol Pati */}
        <path 
          d="M 60 132 C 75 110, 105 115, 105 135 C 105 145, 95 155, 80 148 C 70 143, 60 138, 60 132 Z" 
          fill="#FFF6E5" 
          stroke="#3E2723" 
          strokeWidth="5" 
          strokeLinejoin="round"
        />
        {/* Sağ Pati */}
        <path 
          d="M 150 132 C 135 110, 105 115, 105 135 C 105 145, 115 155, 130 148 C 140 143, 150 138, 150 132 Z" 
          fill="#FFF6E5" 
          stroke="#3E2723" 
          strokeWidth="5" 
          strokeLinejoin="round"
        />

        {/* === YÜZ DETAYLARI === */}
        
        {/* Pembe Yanaklar */}
        <ellipse cx="70" cy="105" rx="9" ry="6" fill="#FFAAA5" />
        <ellipse cx="140" cy="105" rx="9" ry="6" fill="#FFAAA5" />

        {/* Gözler */}
        <circle cx="85" cy="95" r="5.5" fill="#3E2723" />
        <circle cx="125" cy="95" r="5.5" fill="#3E2723" />

        {/* Gülümseme */}
        <path 
          d="M 98 103 C 98 112, 112 112, 112 103" 
          fill="none" 
          stroke="#3E2723" 
          strokeWidth="5" 
          strokeLinecap="round" 
        />
      </svg>
    </div>
  );
}