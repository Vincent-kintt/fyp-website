// dateTime input + duration preset grid + recurring toggle/select.
// onSelectDuration receives the preset value; the parent toggles between
// setting and clearing it. EndTimePreview gates on (dateTime && duration).

import { FaClock, FaSync } from "react-icons/fa";
import { DURATION_PRESETS } from "@/lib/utils";
import { EndTimePreview, SectionLabel } from "./parts.jsx";

export default function ScheduleSection({
  formData,
  onChange,
  onSelectDuration,
  t,
}) {
  return (
    <div className="space-y-3">
      <SectionLabel>{t("schedule")}</SectionLabel>

      <div>
        <label
          htmlFor="edit-dateTime"
          className="flex items-center gap-1.5 text-[13px] font-medium mb-1.5"
          style={{ color: "var(--text-secondary)" }}
        >
          <FaClock className="w-3.5 h-3.5" />
          {t("dateTime")} <span className="text-red-500">*</span>
        </label>
        <input
          id="edit-dateTime"
          name="dateTime"
          type="datetime-local"
          value={formData.dateTime}
          onChange={onChange}
          className="w-full px-3 py-2.5 rounded-lg border outline-none transition-all focus:ring-2 focus:ring-blue-500/50 text-[14px]"
          style={{
            backgroundColor: "var(--input-bg)",
            borderColor: "var(--card-border)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span
            className="text-[13px] font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("duration")}
          </span>
          {formData.duration && (
            <span
              className="text-[11px] bg-gray-500/20 px-1.5 py-0.5 rounded"
              style={{ color: "var(--text-muted)" }}
            >
              {formData.duration} min
            </span>
          )}
          <EndTimePreview
            dateTime={formData.dateTime}
            duration={formData.duration}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {DURATION_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => onSelectDuration(preset.value)}
              className={`px-3.5 py-2 rounded-lg text-[13px] font-medium border transition-all ${
                formData.duration === preset.value
                  ? "border-blue-500 bg-blue-500/20 text-blue-500"
                  : "border-gray-500/30 bg-gray-500/10 hover:bg-gray-500/20"
              }`}
              style={{
                color:
                  formData.duration === preset.value
                    ? undefined
                    : "var(--text-secondary)",
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            name="recurring"
            checked={formData.recurring}
            onChange={onChange}
            className="w-4 h-4 rounded border-gray-500 text-blue-600 focus:ring-blue-500"
          />
          <span
            className="flex items-center gap-1.5 text-[13px] font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            <FaSync className="w-3 h-3" />
            {t("repeat")}
          </span>
        </label>
        {formData.recurring && (
          <select
            name="recurringType"
            value={formData.recurringType}
            onChange={onChange}
            className="px-2.5 py-1.5 rounded-lg border outline-none text-[13px]"
            style={{
              backgroundColor: "var(--input-bg)",
              borderColor: "var(--card-border)",
              color: "var(--text-primary)",
            }}
          >
            <option value="daily">{t("daily")}</option>
            <option value="weekly">{t("weekly")}</option>
            <option value="monthly">{t("monthly")}</option>
            <option value="yearly">{t("yearly")}</option>
          </select>
        )}
      </div>
    </div>
  );
}
