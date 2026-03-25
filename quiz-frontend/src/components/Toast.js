import React, { useState, useCallback } from 'react';

/* Bildirim toast'u — useToast hook'u ile kullanılır */
export function useToast() {
  const [toast, setToast] = useState(null);

  const show = useCallback((msg, duration = 3000) => {
    setToast(msg);
    setTimeout(() => setToast(null), duration);
  }, []);

  return { toast, show };
}

export function Toast({ message }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      left: '50%',
      transform: `translateX(-50%) translateY(${message ? 0 : 80}px)`,
      background: 'rgba(44,32,99,0.92)',
      color: 'white',
      padding: '12px 28px',
      borderRadius: 999,
      fontSize: 14,
      fontWeight: 700,
      backdropFilter: 'blur(12px)',
      transition: 'transform 0.4s cubic-bezier(.34,1.56,.64,1)',
      zIndex: 1000,
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
    }}>
      {message || ''}
    </div>
  );
}
