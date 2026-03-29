export default function ErrorState({ message, onRetry }) {
  return (
    <div className="bg-danger-light border border-danger/30 text-danger px-4 py-3 rounded-lg">
      <p className="text-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 text-sm font-medium underline hover:no-underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}
