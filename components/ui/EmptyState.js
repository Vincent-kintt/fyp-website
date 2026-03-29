export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && (
        <div className="w-12 h-12 mb-4 text-text-muted">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-medium text-text-primary mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-text-muted max-w-xs">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
