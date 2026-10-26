import { initials } from "@/lib/labels";

const palettes = [
  ["#DCE9F7", "#0062C4"],
  ["#F6E3D3", "#9A4A12"],
  ["#E6E1F7", "#5B3FC4"],
  ["#E3F4EA", "#00804A"],
  ["#FBEFD0", "#8A6100"],
  ["#E5E8EC", "#3D4656"],
] as const;

function palette(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return palettes[hash % palettes.length]!;
}

export function Avatar({ name, size = 34, online = false, tone = "auto" }: { name: string; size?: number; online?: boolean; tone?: "auto" | "primary" }) {
  const [bg, fg] = tone === "primary" ? (["#0285F712", "#0069C7"] as const) : palette(name);
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size > 40 ? 15.5 : size > 34 ? 14.5 : 12.5 }}
      aria-hidden
    >
      {initials(name)}
      {online && (
        <span
          className="absolute rounded-full bg-success ring-2 ring-white"
          style={{ width: size / 4.2, height: size / 4.2, right: 0, bottom: 0 }}
        />
      )}
    </span>
  );
}
