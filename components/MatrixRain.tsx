"use client";

import { useEffect, useRef } from "react";

// Cyberpunk Matrix Rain — brighter glyphs, mouse interaction glow,
// reduced motion support.
export default function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const glyphs = "01アイウエオABCDEFGHKLMNOPQRSTUVWXYZ#$%&/*+-=<>{}[]|/\\~^";
    const fontSize = 16;
    let columns = 0;
    let drops: number[] = [];
    let mouseX = -1000;
    let mouseY = -1000;
    let animFrame: number;
    let lastTime = 0;
    const interval = 55; // ms per frame

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
      columns = Math.floor(canvas!.width / fontSize);
      drops = new Array(columns).fill(1);
    }
    resize();
    window.addEventListener("resize", resize);

    function onMouseMove(e: MouseEvent) {
      mouseX = e.clientX;
      mouseY = e.clientY;
    }
    window.addEventListener("mousemove", onMouseMove);

    function draw(timestamp: number) {
      if (timestamp - lastTime < interval) {
        animFrame = requestAnimationFrame(draw);
        return;
      }
      lastTime = timestamp;

      // Dark fade trail — cyberpunk deep dark blue-black
      ctx!.fillStyle = "rgba(5, 7, 15, 0.07)";
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height);
      ctx!.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const glyph = glyphs[Math.floor(Math.random() * glyphs.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // Distance from mouse — glow effect
        const dx = x - mouseX;
        const dy = y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const glowRadius = 180;

        let alpha = i % 2 === 0 ? 0.55 : 0.45;
        let color: string;

        if (dist < glowRadius) {
          // Bright glow near cursor — cyan pulse
          const intensity = 1 - dist / glowRadius;
          alpha = Math.min(1, alpha + intensity * 0.6);
          const g = Math.floor(200 + intensity * 55);
          color = `rgba(0, ${g}, 255, ${alpha})`;
        } else {
          color = i % 2 === 0
            ? `rgba(0, 229, 255, ${alpha})`
            : `rgba(255, 45, 120, ${alpha * 0.85})`;
        }

        ctx!.fillStyle = color;
        ctx!.fillText(glyph, x, y);

        // Random bright "hot" glyph occasionally
        if (Math.random() > 0.998) {
          ctx!.fillStyle = `rgba(0, 255, 200, 0.95)`;
          ctx!.fillText(glyph, x, y);
        }

        if (drops[i] * fontSize > canvas!.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }

      animFrame = requestAnimationFrame(draw);
    }

    if (reduceMotion) {
      // Static single frame
      ctx!.fillStyle = "rgba(5, 7, 15, 1)";
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height);
      ctx!.font = `${fontSize}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const glyph = glyphs[Math.floor(Math.random() * glyphs.length)];
        ctx!.fillStyle = i % 2 === 0 ? "rgba(0,229,255,0.4)" : "rgba(255,45,120,0.3)";
        ctx!.fillText(glyph, i * fontSize, drops[i] * fontSize);
        drops[i]++;
      }
      return () => {
        window.removeEventListener("resize", resize);
        window.removeEventListener("mousemove", onMouseMove);
      };
    }

    animFrame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none opacity-[0.13]"
      aria-hidden="true"
    />
  );
}
