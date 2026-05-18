// Variant-aware footer. The modal variant (EditReminderModal) shows a
// Cancel button to dismiss the modal; the panel variant (TaskDetailPanel)
// hides it because the panel header + click-outside already handle close.

export default function Footer({ variant, isSubmitting, onCancel, onSubmit, t }) {
  return (
    <div className="flex-shrink-0 flex gap-3 p-4 border-t border-[var(--card-border)] bg-[var(--card-bg)]">
      {variant === "modal" && (
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded-lg border transition-colors hover:bg-gray-500/10 text-[14px] font-medium"
          style={{
            borderColor: "var(--card-border)",
            color: "var(--text-secondary)",
          }}
          disabled={isSubmitting}
        >
          {t("cancel")}
        </button>
      )}
      <button
        type="submit"
        onClick={onSubmit}
        className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[14px] font-medium transition-colors disabled:opacity-50"
        disabled={isSubmitting}
      >
        {isSubmitting ? t("saving") : t("save")}
      </button>
    </div>
  );
}
