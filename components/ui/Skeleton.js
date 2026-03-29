export default function Skeleton({ width, height, rounded = "md", className = "" }) {
  const roundedMap = {
    none: "rounded-none",
    sm: "rounded-sm",
    md: "rounded",
    lg: "rounded-lg",
    xl: "rounded-xl",
    full: "rounded-full",
  };

  return (
    <div
      className={`skeleton-line ${roundedMap[rounded] || roundedMap.md} ${className}`}
      style={{
        width: width || "100%",
        height: height || "1rem",
      }}
    />
  );
}
