export function ProductImage({
  src,
  alt,
  className = ""
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div className={`menu-photo ${className}`}>
      {/* Restaurant-owned menu photographs supplied through screenshots. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" />
    </div>
  );
}
