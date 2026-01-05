export default function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  className = "",
  disabled = false
}) {
  const baseStyles = "px-4 py-2 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-primary text-text-inverted hover:bg-primary-hover",
    secondary: "bg-background-tertiary text-text-primary hover:bg-surface-active",
    danger: "bg-danger text-text-inverted hover:bg-danger-hover",
    success: "bg-success text-text-inverted hover:bg-success-hover",
    outline: "border-2 border-primary text-primary hover:bg-primary-light"
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
