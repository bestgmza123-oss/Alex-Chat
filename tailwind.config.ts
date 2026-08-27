import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#05070f",
        panel: "#0d1117",
        "panel-raised": "#121a21",
        cyan: "#00e5ff",
        magenta: "#ff2d78",
        text: "#d8f3ff",
        muted: "#5c7078",
        danger: "#ff3860",
        border: "#1d2b33",
      },
      fontFamily: {
        display: ["var(--font-jetbrains)", "monospace"],
        body: ["var(--font-plex)", "var(--font-thai)", "monospace"],
      },
      keyframes: {
        blink: { "0%, 49%": { opacity: "1" }, "50%, 100%": { opacity: "0" } },
        "cyber-glitch": {
          "0%, 100%": { transform: "translate(0)" },
          "10%": { transform: "translate(-2px, 1px)" },
          "20%": { transform: "translate(2px, -1px)" },
          "30%": { transform: "translate(-1px, 0)" },
          "40%": { transform: "translate(1px, 1px)" },
          "50%": { transform: "translate(-1px, -1px)" },
          "60%": { transform: "translate(2px, 0)" },
          "70%": { transform: "translate(0, -2px)" },
          "80%": { transform: "translate(-2px, 1px)" },
          "90%": { transform: "translate(1px, -1px)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 5px rgba(0, 229, 255, 0.2)" },
          "50%": { boxShadow: "0 0 15px rgba(0, 229, 255, 0.4), 0 0 30px rgba(0, 229, 255, 0.1)" },
        },
        "slide-in-from-top": {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        blink: "blink 1s step-end infinite",
        "cyber-glitch": "cyber-glitch 0.3s linear",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        "slide-in-from-top": "slide-in-from-top 0.3s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
