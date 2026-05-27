// Quick-tag toggles + custom-tag input + chip removal. onAddTag /
// onRemoveTag receive raw strings; the hook layer normalises them. Quick
// tags reuse onAddTag rather than touching setFormData directly so the
// hook's dedupe + normalize gates apply uniformly.

import { FaPlus, FaTimes } from "react-icons/fa";
import { getTagClasses, SUGGESTED_TAGS } from "@/lib/utils";
import { SectionLabel } from "./parts.jsx";

export default function TagsSection({
  formData,
  newTag,
  onNewTagChange,
  onTagKeyDown,
  onAddTag,
  onRemoveTag,
  t,
}) {
  return (
    <div className="space-y-2">
      <SectionLabel>{t("tags")}</SectionLabel>

      <div className="flex flex-wrap gap-2">
        {SUGGESTED_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => {
              if (formData.tags.includes(tag)) {
                onRemoveTag(tag);
              } else {
                onAddTag(tag);
              }
            }}
            className={`px-3 py-1.5 rounded-full text-[13px] font-medium border transition-all ${
              formData.tags.includes(tag)
                ? getTagClasses(tag)
                : "border-gray-500/30 bg-gray-500/10 hover:bg-gray-500/20"
            }`}
            style={{
              color: formData.tags.includes(tag)
                ? undefined
                : "var(--text-secondary)",
            }}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newTag}
          onChange={(e) => onNewTagChange(e.target.value)}
          onKeyDown={onTagKeyDown}
          placeholder={t("addCustomTag")}
          className="flex-1 px-3 py-2 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-blue-500/50 text-[13px]"
          style={{
            backgroundColor: "var(--input-bg)",
            borderColor: "var(--card-border)",
            color: "var(--text-primary)",
          }}
        />
        <button
          type="button"
          onClick={() => onAddTag(newTag)}
          disabled={!newTag.trim() || newTag.length < 2}
          className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FaPlus className="w-3.5 h-3.5" />
        </button>
      </div>

      {formData.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {formData.tags.map((tag) => (
            <span
              key={tag}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium border ${getTagClasses(tag)}`}
            >
              {tag}
              <button
                type="button"
                onClick={() => onRemoveTag(tag)}
                className="hover:bg-black/10 rounded-full p-0.5 transition-colors"
              >
                <FaTimes className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
