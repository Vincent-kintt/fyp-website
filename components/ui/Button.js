import { forwardRef } from "react";
import { FaSpinner } from "react-icons/fa";
import { Link } from "@/i18n/navigation";

const Button = forwardRef(function Button(
  {
    children,
    onClick,
    type = "button",
    variant = "primary",
    size = "md",
    className = "",
    disabled = false,
    loading = false,
    href,
    ...props
  },
  ref,
) {
  const baseStyles =
    "inline-flex items-center justify-center font-medium rounded-lg transition-[colors,transform] duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

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

  const classes = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`;

  if (href) {
    return (
      <Link ref={ref} href={href} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={classes}
      {...props}
    >
      {loading && <FaSpinner className="animate-spin shrink-0" />}
      {children}
    </button>
  );
});

export default Button;
