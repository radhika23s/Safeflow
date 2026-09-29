import { cn } from "@/lib/utils";

export interface LogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "deep" | "navy";
  rounded?: "lg" | "xl";
  className?: string;
  showLabel?: boolean;
  label?: string;
  sublabel?: string;
  containerClassName?: string;
  shadow?: boolean;
}

export function Logo({
  size = "md",
  variant = "deep",
  rounded = "lg",
  className,
  showLabel = true,
  label = "Safe Flow",
  sublabel = "Digital Investigator",
  containerClassName,
  shadow = false,
}: LogoProps) {
  const sizeMap = {
    sm: "size-8",
    md: "size-9",
    lg: "size-12",
  };

  const imgSizeMap = {
    sm: "size-4",
    md: "size-4",
    lg: "size-5",
  };

  const bgColorMap = {
    deep: "bg-deep",
    navy: "bg-navy",
  };

  const roundedMap = {
    lg: "rounded-lg",
    xl: "rounded-xl",
  };

  return (
    <div className={cn("flex items-center gap-2.5", containerClassName)}>
      <div
        className={cn(
          "flex items-center justify-center text-teal",
          sizeMap[size],
          bgColorMap[variant],
          roundedMap[rounded],
          shadow && "shadow-xs",
          className,
        )}
      >
        <img
          src="/main_logo.png"
          alt="Smart Horizon"
          className={cn("object-contain", imgSizeMap[size])}
        />
      </div>
      {showLabel && (
        <div>
          <p className="text-sm font-semibold tracking-[0.16em] text-foreground">
            {label}
          </p>
          {sublabel && (
            <p className="eyebrow text-[0.6rem] text-muted-foreground">
              {sublabel}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
