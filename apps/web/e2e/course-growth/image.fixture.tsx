/** Next's image optimizer is tested on the real landing page, not the Vite harness. */
export default function Image({
  src,
  alt,
  width,
  height,
  className,
  sizes,
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      sizes={sizes}
    />
  );
}
