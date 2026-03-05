/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0d0d0f",
        surface: "#141418",
        border: "#1e1e26",
        accent: "#5b7cf6",
        warn: "#f59e0b",
        text: "#e8e8f0",
        muted: "#6b6b80",
        success: "#22c55e",
        error: "#ef4444"
      },
      borderRadius: {
        sm: "4px",
        md: "6px"
      },
      fontFamily: {
        ui: ["Inter", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"]
      }
    }
  },
  plugins: []
};
