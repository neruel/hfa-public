import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Pretendard Variable", "Pretendard", "-apple-system", "BlinkMacSystemFont", "Apple SD Gothic Neo", "Noto Sans KR", "sans-serif"],
      },
      colors: {
        primary: {
          DEFAULT: "#059669",
          dark: "#047857",
          light: "#d1fae5",
        },
        danger: "#dc2626",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,.04), 0 4px 16px rgba(15,23,42,.04)",
        float: "0 1px 2px rgba(15,23,42,.05), 0 12px 32px rgba(15,23,42,.08)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up .25s ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;
