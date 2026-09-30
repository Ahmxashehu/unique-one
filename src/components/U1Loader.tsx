import { useEffect, useState } from "react";

type U1LoaderProps = {
  visible?: boolean;
  minDurationMs?: number;
};

export default function U1Loader({
  visible = false,
  minDurationMs = 700,
}: U1LoaderProps) {
  const [show, setShow] = useState(visible);

  useEffect(() => {
    if (!visible) {
      const timer = window.setTimeout(() => setShow(false), minDurationMs);
      return () => window.clearTimeout(timer);
    }
    setShow(true);
  }, [visible, minDurationMs]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
      role="status"
      aria-label="U1 loading"
    >
      <div className="relative flex h-28 w-28 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full border border-emerald-400/30" />
        <div className="absolute inset-3 animate-[spin_3s_linear_infinite] rounded-full border border-emerald-400/20 border-t-emerald-400/80" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-2xl">
          <span className="text-4xl font-black tracking-[-0.08em] text-black">U1</span>
        </div>
      </div>
    </div>
  );
}
