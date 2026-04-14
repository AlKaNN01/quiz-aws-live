import React, { useState, useCallback } from "react";

/**
 * useToast hook - Notification management with type support (success/error/warning/info)
 * Usage: const { toast, show, error, success } = useToast();
 */
export function useToast() {
  const [toast, setToast] = useState(null);

  const show = useCallback((msg, type = "info", duration = 3000) => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), duration);
  }, []);

  const success = useCallback(
    (msg, duration = 3000) => {
      show(msg, "success", duration);
    },
    [show],
  );

  const error = useCallback(
    (msg, duration = 5000) => {
      show(msg, "error", duration);
    },
    [show],
  );

  const warning = useCallback(
    (msg, duration = 4000) => {
      show(msg, "warning", duration);
    },
    [show],
  );

  const info = useCallback(
    (msg, duration = 3000) => {
      show(msg, "info", duration);
    },
    [show],
  );

  return { toast, show, success, error, warning, info };
}

/**
 * Toast Component - Displays notifications with type-based styling
 */
export function Toast({ message, type = "info" }) {
  if (!message) return null;

  const getStyles = (toastType) => {
    const baseStyle = {
      position: "fixed",
      bottom: 24,
      left: "50%",
      transform: `translateX(-50%) translateY(${message ? 0 : 80}px)`,
      padding: "12px 28px",
      borderRadius: 999,
      fontSize: 14,
      fontWeight: 700,
      backdropFilter: "blur(12px)",
      transition: "transform 0.4s cubic-bezier(.34,1.56,.64,1)",
      zIndex: 1000,
      whiteSpace: "nowrap",
      pointerEvents: "none",
    };

    const typeStyles = {
      success: {
        background: "rgba(76, 175, 80, 0.92)",
        color: "white",
      },
      error: {
        background: "rgba(211, 47, 47, 0.92)",
        color: "white",
      },
      warning: {
        background: "rgba(255, 152, 0, 0.92)",
        color: "white",
      },
      info: {
        background: "rgba(44, 32, 99, 0.92)",
        color: "white",
      },
    };

    return { ...baseStyle, ...typeStyles[toastType] };
  };

  const getIcon = (toastType) => {
    const icons = {
      success: "✓",
      error: "✕",
      warning: "⚠",
      info: "ℹ",
    };
    return icons[toastType] || "";
  };

  return (
    <div style={getStyles(type)}>
      {getIcon(type)} {message}
    </div>
  );
}
