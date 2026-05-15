"use client";

import { FaTimes } from "react-icons/fa";
import { Card, t } from "./shared";

export default function DeleteReminderCard({ input, language }) {
  return (
    <Card accent="red">
      <div className="flex items-center gap-2">
        <FaTimes style={{ color: "var(--danger)", fontSize: "12px" }} />
        <span style={{ color: "var(--modal-text)" }}>
          {t(language, "已刪除: ", "Deleted: ")}
          <span className="font-medium">{input?.title || t(language, "提醒", "Reminder")}</span>
        </span>
      </div>
    </Card>
  );
}
