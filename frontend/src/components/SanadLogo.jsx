/**
 * Ruang Sanad brand logo — uses uploaded PNG.
 * `variant="mark"`  → only the calligraphy graphic (top portion of the logo).
 * `variant="full"`  → the full lockup (calligraphy + "RUANG SANAD" text).
 */
export default function SanadLogo({ size = 48, variant = "mark", className = "" }) {
  const src = "/brand/ruang-sanad-logo.png";

  if (variant === "full") {
    return (
      <img
        src={src}
        alt="Ruang Sanad"
        style={{ height: size, width: "auto" }}
        className={`shrink-0 object-contain ${className}`}
        draggable={false}
      />
    );
  }

  // Mark-only: the logo image is roughly 1000×1400px with calligraphy occupying the top ~62%.
  // We render the full image scaled to a tall height then clip the container to show only the graphic.
  const boxH = size;
  const boxW = size * 0.7;
  const imgH = size / 0.6; // enlarge so calligraphy fills the box
  return (
    <div
      aria-label="Ruang Sanad"
      role="img"
      className={`shrink-0 overflow-hidden ${className}`}
      style={{ height: boxH, width: boxW }}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        style={{
          height: imgH,
          width: "auto",
          maxWidth: "none",
          display: "block",
          objectFit: "cover",
          objectPosition: "center top",
          marginLeft: "50%",
          transform: "translateX(-50%)",
        }}
      />
    </div>
  );
}
