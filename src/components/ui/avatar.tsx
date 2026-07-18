"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback?: string;
  className?: string;
}

function AvatarImage({ src, alt, onError }: { src: string; alt: string; onError: () => void }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="aspect-square h-full w-full object-cover" onError={onError} />;
}

function Avatar({ src, alt = "", fallback = "?", className }: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
        className
      )}
    >
      {src && !imgError ? (
        <AvatarImage src={src} alt={alt} onError={() => setImgError(true)} />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium">
          {fallback}
        </div>
      )}
    </div>
  );
}

export { Avatar };
