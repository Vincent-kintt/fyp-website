// Title / description / remark inputs. autoFocus on the title is
// preserved — it's how the modal lands the cursor in the most likely-
// edited field when EditReminderModal opens.

import { SectionLabel } from "./parts.jsx";

export default function ContentSection({ formData, onChange, t }) {
  return (
    <div className="space-y-3">
      <SectionLabel>{t("content")}</SectionLabel>
      <input
        id="edit-title"
        name="title"
        type="text"
        value={formData.title}
        onChange={onChange}
        placeholder={t("titlePlaceholder")}
        className="w-full px-2 py-2 rounded-lg text-[16px] font-semibold bg-transparent border border-transparent outline-none transition-all focus:ring-2 focus:ring-blue-500/30 focus:border-[var(--card-border)] focus:bg-[var(--input-bg)]"
        style={{ color: "var(--text-primary)" }}
        autoFocus
      />
      <textarea
        id="edit-description"
        name="description"
        value={formData.description}
        onChange={onChange}
        placeholder={t("notesPlaceholder")}
        rows="2"
        className="w-full px-3 py-2.5 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-blue-500/50 resize-none text-[14px]"
        style={{
          backgroundColor: "var(--input-bg)",
          borderColor: "var(--card-border)",
          color: "var(--text-primary)",
        }}
      />
      <textarea
        id="edit-remark"
        name="remark"
        value={formData.remark}
        onChange={onChange}
        placeholder={t("remarkPlaceholder")}
        rows="2"
        className="w-full px-3 py-2.5 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-blue-500/50 resize-none text-[14px]"
        style={{
          backgroundColor: "var(--input-bg)",
          borderColor: "var(--card-border)",
          color: "var(--text-primary)",
        }}
      />
    </div>
  );
}
