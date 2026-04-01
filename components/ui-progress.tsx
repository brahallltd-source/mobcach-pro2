
"use client";

export function Progress({ value }: { value: number }) {
  return <div className="h-3 w-full overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-white transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}
