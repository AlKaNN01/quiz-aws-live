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
        viewBox="0 0 220 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="fluffyBody" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(110 92) rotate(90) scale(88 108)">
            <stop offset="0" stopColor="#FFFDF5" />
            <stop offset="0.72" stopColor="#FFF3DD" />
            <stop offset="1" stopColor="#F5DDBE" />
          </radialGradient>
          <radialGradient id="fluffyCheek" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 0) scale(1)">
            <stop offset="0" stopColor="#F7B5B2" />
            <stop offset="1" stopColor="#F7B5B2" stopOpacity="0" />
          </radialGradient>
          <filter id="fluffyShadow" x="0" y="18" width="220" height="150" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>

        <ellipse cx="110" cy="148" rx="60" ry="12" fill="#2F0C52" opacity="0.16" filter="url(#fluffyShadow)" />

        <path
          d="M40 120C24 119 15 107 15 92C15 77 26 67 42 66C41 44 56 31 75 31C82 18 96 12 111 14C126 8 144 11 153 24C173 23 188 36 189 55C205 58 214 72 214 88C214 108 201 120 182 120H40Z"
          fill="url(#fluffyBody)"
          stroke="#3A241A"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d="M71 122C77 113 87 108 97 109C102 110 106 114 106 120C106 131 95 137 84 136C78 136 73 130 71 122Z"
          fill="#FBE8CF"
          stroke="#3A241A"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M149 122C143 113 133 108 123 109C118 110 114 114 114 120C114 131 125 137 136 136C142 136 147 130 149 122Z"
          fill="#FBE8CF"
          stroke="#3A241A"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d="M84 111C90 115 96 123 99 130"
          stroke="#3A241A"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M136 111C130 115 124 123 121 130"
          stroke="#3A241A"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M100 130C103 125 106 122 110 122C114 122 117 125 120 130"
          stroke="#3A241A"
          strokeWidth="4.5"
          strokeLinecap="round"
        />

        <ellipse cx="74" cy="95" rx="10" ry="12" fill="#3A241A" />
        <ellipse cx="146" cy="95" rx="10" ry="12" fill="#3A241A" />
        <path
          d="M94 107C100 116 120 116 126 107"
          stroke="#3A241A"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <ellipse cx="58" cy="107" rx="16" ry="10" fill="url(#fluffyCheek)" />
        <ellipse cx="162" cy="107" rx="16" ry="10" fill="url(#fluffyCheek)" />
      </svg>
    </div>
  );
}
