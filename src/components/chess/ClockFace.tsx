import { formatClockMs } from "@/lib/clocks";

export default function ClockFace(props: {
  ms: number;
  active?: boolean;
  incrementSeconds?: number;
}) {
  const { ms, active = false, incrementSeconds = 0 } = props;
  const urgent = active && ms < 10_000;
  const tone = urgent ? "text-red-400" : active ? "text-gold" : "text-white";

  return (
    <span className={`inline-flex items-baseline gap-1 font-mono tabular-nums ${tone}`}>
      <span className="text-lg">{formatClockMs(ms)}</span>
      {incrementSeconds > 0 ? (
        <span className="text-[10px] font-sans text-white/40">+{incrementSeconds}</span>
      ) : null}
    </span>
  );
}
