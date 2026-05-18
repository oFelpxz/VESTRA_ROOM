import Link from "next/link";

export function Logo({
  tone = "dark",
  className = "",
}: {
  tone?: "dark" | "light";
  className?: string;
}) {
  const stroke = tone === "light" ? "#F4F1EA" : "#0B0B0B";

  return (
    <Link
      href="/"
      aria-label="VESTRA ROOM — início"
      className={`group inline-flex items-center gap-2.5 ${className}`}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 64 64"
        fill="none"
        className="shrink-0"
        aria-hidden="true"
      >
        <path
          d="M14 18 L32 47 L50 18"
          stroke={stroke}
          strokeWidth="7"
          strokeLinecap="square"
        />
        <circle
          cx="55"
          cy="13"
          r="4"
          fill="#B6FF4D"
          className="transition-transform duration-300 group-hover:scale-125"
        />
      </svg>
      <span className="font-heading text-lg font-bold uppercase leading-none tracking-[0.2em]">
        VESTRA<span className="text-muted-foreground"> ROOM</span>
      </span>
    </Link>
  );
}
