import { cn } from "@/lib/utils";

type TagProps = React.ComponentProps<"span"> & {
  variant?: "default" | "accent" | "outline";
};

export function Tag({ className, variant = "default", ...props }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]",
        variant === "default" && "bg-foreground text-background",
        variant === "accent" && "bg-acid text-foreground",
        variant === "outline" && "border border-foreground/15 text-foreground/70",
        className,
      )}
      {...props}
    />
  );
}
