import Image from "next/image";

interface AvatarProps {
  src?: string;
  alt?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Avatar({
  src,
  alt = "",
  size = "md",
  className = "",
}: AvatarProps) {
  const imageSize = size === "sm" ? 8 : size === "md" ? 10 : 12;
  const sizeClass = size === "sm" ? "h-8 w-8" : size === "md" ? "h-10 w-10" : "h-12 w-12";

  return (
    <div className={`relative flex shrink-0 overflow-hidden ${sizeClass} rounded-full border border-zinc-200 dark:border-zinc-600 ${className}`}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={imageSize}
          height={imageSize}
          className="object-cover w-full h-full"
        />
      ) : (
        <div className="flex items-center justify-center h-full w-full bg-primary text-white dark:bg-primary/20 dark:text-primary">
          {alt ? alt.charAt(0).toUpperCase() : "?"}
        </div>
      )}
    </div>
  );
}
