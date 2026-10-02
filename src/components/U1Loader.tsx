import { useEffect, useState } from "react";

type U1LoaderProps = {
  visible?: boolean;
  minDurationMs?: number;
};

export default function U1Loader({
  visible = true,
  minDurationMs = 650,
}: U1LoaderProps) {
  const [show, setShow] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShow(true);
      return;
    }

    const timer = window.setTimeout(() => setShow(false), minDurationMs);
    return () => window.clearTimeout(timer);
  }, [visible, minDurationMs]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
      role="status"
      aria-label="UniquePlatform loading"
    >
      <style>{`
        @keyframes up-pulse {
          0%, 100% { transform: scale(0.94); opacity: 0.82; }
          50% { transform: scale(1.06); opacity: 1; }
        }
        @keyframes up-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes up-glow {
          0%, 100% { opacity: 0.25; transform: scale(0.9); }
          50% { opacity: 0.75; transform: scale(1.08); }
        }
        @media (prefers-reduced-motion: reduce) {
          .up-motion { animation-duration: 3s !important; }
        }
      `}</style>

      <div className="relative flex h-32 w-32 items-center justify-center">
        <div
          className="up-motion absolute inset-0 rounded-full border border-emerald-400/30"
          style={{ animation: "up-glow 1.35s ease-in-out infinite" }}
        />
        <div
          className="up-motion absolute inset-3 rounded-full border border-emerald-400/25 border-t-emerald-400"
          style={{ animation: "up-spin 1.15s linear infinite" }}
        />
        <div
          className="up-motion relative flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-2xl"
          style={{ animation: "up-pulse 1.15s ease-in-out infinite" }}
        >
          <span className="text-4xl font-black tracking-[-0.08em] text-black">
            UP
          </span>
        </div>
      </div>
    </div>
  );
}
