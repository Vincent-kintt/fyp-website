// Progressive-disclosure subtasks UI. When collapsed, renders a single
// "add subtasks" button; when expanded, shows the input + list.
// onExpand is exposed as a prop so the shell can stay declarative.

import { FaPlus, FaTrash } from "react-icons/fa";
import { SectionLabel } from "./parts.jsx";

export default function SubtasksSection({
  formData,
  newSubtask,
  onNewSubtaskChange,
  onSubtaskKeyDown,
  onAddSubtask,
  onRemoveSubtask,
  showSubtasks,
  onExpand,
  t,
}) {
  if (!showSubtasks) {
    return (
      <button
        type="button"
        onClick={onExpand}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-dashed text-[13px] font-medium transition-colors hover:bg-gray-500/5"
        style={{
          borderColor: "var(--border, var(--card-border))",
          color: "var(--text-muted)",
        }}
      >
        <FaPlus className="w-3 h-3" />
        {t("addSubtasks")}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <SectionLabel>
        {t("subtasks")}
        {formData.subtasks.length > 0 ? ` (${formData.subtasks.length})` : ""}
      </SectionLabel>

      <div className="flex gap-2">
        <input
          type="text"
          value={newSubtask}
          onChange={(e) => onNewSubtaskChange(e.target.value)}
          onKeyDown={onSubtaskKeyDown}
          placeholder={t("addSubtask")}
          className="flex-1 px-3 py-2 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-purple-500/50 text-[13px]"
          style={{
            backgroundColor: "var(--input-bg)",
            borderColor: "var(--card-border)",
            color: "var(--text-primary)",
          }}
        />
        <button
          type="button"
          onClick={() => onAddSubtask(newSubtask)}
          disabled={!newSubtask.trim()}
          className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FaPlus className="w-3.5 h-3.5" />
        </button>
      </div>

      {formData.subtasks.length > 0 && (
        <div className="space-y-1.5 max-h-32 overflow-y-auto">
          {formData.subtasks.map((subtask) => (
            <div
              key={subtask.id}
              className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-gray-500/10"
            >
              <span
                className="text-[13px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {subtask.title}
              </span>
              <button
                type="button"
                onClick={() => onRemoveSubtask(subtask.id)}
                className="p-1 text-red-500 hover:bg-red-500/20 rounded transition-colors"
              >
                <FaTrash className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
