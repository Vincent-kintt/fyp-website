// Status + priority grids. The status grid uses `isValidStatusTransition`
// to disable invalid choices — keeps users from clicking themselves into
// states the API would reject anyway (e.g. SNOOZED -> COMPLETED needs a
// restore step first).

import {
  REMINDER_STATUSES,
  getStatusConfig,
  isValidStatusTransition,
} from "@/lib/utils";
import { getPriorityColor, PriorityDot, SectionLabel, StatusIcon } from "./parts.jsx";

const PRIORITY_LEVELS = ["high", "medium", "low"];

export default function DetailsSection({
  formData,
  onSelectStatus,
  onSelectPriority,
  t,
}) {
  return (
    <div className="space-y-3">
      <SectionLabel>{t("details")}</SectionLabel>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span
            className="text-[12px] font-medium mb-1.5 block"
            style={{ color: "var(--text-muted)" }}
          >
            {t("status")}
          </span>
          <div className="grid grid-cols-1 gap-1.5">
            {REMINDER_STATUSES.map((s) => {
              const config = getStatusConfig(s);
              const isCurrent = formData.status === s;
              const isValid =
                isCurrent || isValidStatusTransition(formData.status, s);
              return (
                <button
                  key={s}
                  type="button"
                  disabled={!isValid}
                  onClick={() => isValid && onSelectStatus(s)}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[13px] font-medium border-2 transition-all ${
                    isCurrent
                      ? config.color
                      : isValid
                        ? "border-transparent bg-gray-500/10 hover:bg-gray-500/20"
                        : "border-transparent bg-gray-500/5 opacity-40 cursor-not-allowed"
                  }`}
                  style={{
                    color: isCurrent ? undefined : "var(--text-secondary)",
                  }}
                >
                  <StatusIcon status={s} className="w-3 h-3" />
                  {config.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span
            className="text-[12px] font-medium mb-1.5 block"
            style={{ color: "var(--text-muted)" }}
          >
            {t("priority")}
          </span>
          <div className="flex flex-col gap-1.5">
            {PRIORITY_LEVELS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onSelectPriority(p)}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] font-medium capitalize border-2 transition-all ${
                  formData.priority === p
                    ? getPriorityColor(p)
                    : "border-transparent bg-gray-500/10 hover:bg-gray-500/20"
                }`}
                style={{
                  color:
                    formData.priority === p ? undefined : "var(--text-primary)",
                }}
              >
                <PriorityDot level={p} />
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
