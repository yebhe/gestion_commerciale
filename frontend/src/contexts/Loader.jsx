import React from "react";

export default function Loader({ fullscreen = true }) {
  return (
    <div className="yebhe-loader-wrapper" style={fullscreen ? { position: 'fixed', inset: 0, zIndex: 9999 } : { minHeight: '80px', height: 'auto' }}>
      <style>{`
        .yebhe-loader-wrapper {
          --glow: color-mix(in srgb, var(--primary-300, #5cb7ae) 55%, transparent);
          width: 100%;
          height: 100%;
          min-height: 260px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--background, #12151a);
        }

        .yebhe-loader {
          position: relative;
          width: 150px;
          height: 150px;
        }

        .yebhe-glow {
          position: absolute;
          inset: 24px;
          border-radius: 50%;
          background: radial-gradient(circle, var(--glow) 0%, rgba(92,183,174,0) 72%);
          filter: blur(6px);
          animation: yebhe-pulse-glow 2.4s ease-in-out infinite;
        }

        @keyframes yebhe-pulse-glow {
          0%, 100% { opacity: 0.55; transform: scale(0.9); }
          50%      { opacity: 1;    transform: scale(1.05); }
        }

        .yebhe-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          padding: 3px;
          background: conic-gradient(
            from 0deg,
            transparent 0deg,
            var(--primary-500, #35645f) 60deg,
            var(--primary-300, #5cb7ae) 140deg,
            var(--primary-100, #ace1dc) 200deg,
            var(--primary-300, #5cb7ae) 260deg,
            transparent 360deg
          );
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
          animation: yebhe-spin 2.6s linear infinite;
        }

        .yebhe-ring--inner {
          inset: 9px;
          padding: 1.5px;
          background: conic-gradient(
            from 90deg,
            transparent 0deg,
            var(--primary-100, #ace1dc) 90deg,
            transparent 200deg
          );
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1.5px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1.5px));
          animation: yebhe-spin-reverse 3.6s linear infinite;
          opacity: 0.8;
        }

        @keyframes yebhe-spin { to { transform: rotate(360deg); } }
        @keyframes yebhe-spin-reverse { to { transform: rotate(-360deg); } }

        .yebhe-comet {
          position: absolute;
          inset: 0;
          animation: yebhe-spin 2.6s linear infinite;
        }
        .yebhe-comet::before {
          content: '';
          position: absolute;
          top: -1.5px;
          left: 50%;
          width: 6px;
          height: 6px;
          margin-left: -3px;
          border-radius: 50%;
          background: var(--primary-100, #ace1dc);
          box-shadow: 0 0 10px 3px var(--glow);
        }

        .yebhe-wordmark {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2px;
        }

        .yebhe-letter {
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 1.5px;
          background: linear-gradient(120deg, var(--primary-100, #ace1dc), var(--primary-300, #5cb7ae), var(--primary-100, #ace1dc));
          background-size: 300% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          opacity: 0;
          transform: translateY(-16px) scale(0.7);
          animation:
            yebhe-drop-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
            yebhe-shimmer 2.6s linear infinite;
        }

        .yebhe-letter:nth-child(1) { animation-delay: 0.05s, 0.8s; }
        .yebhe-letter:nth-child(2) { animation-delay: 0.15s, 0.8s; }
        .yebhe-letter:nth-child(3) { animation-delay: 0.25s, 0.8s; }
        .yebhe-letter:nth-child(4) { animation-delay: 0.35s, 0.8s; }
        .yebhe-letter:nth-child(5) { animation-delay: 0.45s, 0.8s; }

        @keyframes yebhe-drop-in {
          0%   { opacity: 0; transform: translateY(-16px) scale(0.7); }
          60%  { opacity: 1; transform: translateY(2px) scale(1.06); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes yebhe-shimmer {
          0%   { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }

        .yebhe-loader--compact .yebhe-loader {
          width: 40px;
          height: 40px;
        }
        .yebhe-loader-wrapper:has(.yebhe-loader--compact) {
          min-height: 80px;
        }
        .yebhe-loader--compact .yebhe-glow { inset: 6px; }
        .yebhe-loader--compact .yebhe-ring--inner { inset: 3px; padding: 1px; }
        .yebhe-loader--compact .yebhe-wordmark { display: none; }
        .yebhe-loader--compact .yebhe-comet::before {
          width: 3px; height: 3px; margin-left: -1.5px;
        }
      `}</style>

      <div className={fullscreen ? 'yebhe-loader' : 'yebhe-loader yebhe-loader--compact'}>
        <div className="yebhe-glow" />
        <div className="yebhe-ring" />
        <div className="yebhe-ring yebhe-ring--inner" />
        <div className="yebhe-comet" />

        {fullscreen && (
          <div className="yebhe-wordmark">
            {"YEBHE".split("").map((char, i) => (
              <span className="yebhe-letter" key={i}>
                {char}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}