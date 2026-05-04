/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        background: "#F7F3F0", // sand beige
        foreground: "#2D3748", // slate-ish (low contrast black)
        primary: {
          DEFAULT: "#4A5568", // indigo blue (muted)
          foreground: "#F7F3F0",
        },
        accent: {
          DEFAULT: "#D4A373", // mustard
          foreground: "#2D3748",
        },
        rose: {
          DEFAULT: "#B28471", // dusty rose
        },
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(0,0,0,0.06)",
      },
      fontFamily: {
        sans: ["Noto Sans KR", "Noto Sans", "system-ui", "sans-serif"],
        display: ["Nunito", "Noto Sans KR", "Noto Sans", "system-ui", "sans-serif"],
      },
    },
  },
};

