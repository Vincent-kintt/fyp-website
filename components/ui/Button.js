import { FaSpinner } from "react-icons/fa";

export default function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  loading = false,
  ...props
}) {
  const baseStyles = "inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-primary text-text-inverted hover:bg-primary-hover",
    secondary: "bg-background-tertiary text-text-primary hover:bg-surface-active",
    danger: "bg-danger text-text-inverted hover:bg-danger-hover",
    success: "bg-success text-text-inverted hover:bg-success-hover",
    outline: "border-2 border-primary text-primary hover:bg-primary-light",
    ghost: "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
  };

  const sizes = {
    sm: "py-1.5 px-3 text-sm gap-1.5",
    md: "py-2 px-4 text-base gap-2",
    lg: "py-3 px-6 text-lg gap-2.5",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && <FaSpinner className="animate-spin shrink-0" />}
      {children}
    </button>
  );
}
