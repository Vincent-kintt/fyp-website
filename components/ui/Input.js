import { useId } from "react";

export default function Input({
  label,
  type = "text",
  name,
  value,
  onChange,
  placeholder,
  required = false,
  error,
  size = "md",
  className = "",
  ...props
}) {
  const generatedId = useId();
  const inputId = name || generatedId;
  const errorId = `${inputId}-error`;

  const sizes = {
    sm: "py-1.5 px-2.5 text-sm",
    md: "py-2 px-3 text-base",
    lg: "py-3 px-4 text-lg",
  };

  return (
    <div className="mb-4">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-text-secondary mb-1">
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}
      <input
        type={type}
        id={inputId}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`w-full ${sizes[size]} border border-input-border rounded-lg bg-input-bg text-text-primary focus-visible:ring-2 focus-visible:ring-input-border-focus focus-visible:border-transparent outline-none transition-all ${
          error ? "border-danger" : ""
        } ${className}`}
        {...props}
      />
      {error && <p id={errorId} className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}
