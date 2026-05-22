// ReminderCard a11y — edit/delete icon buttons must expose aria-label so
// screen readers announce them as labelled controls (Bug #6).
//
// Rendered with renderToStaticMarkup so we don't need a DOM. next-intl is
// mocked to return the zh-TW string for the keys under test, matching the
// project's default locale.

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Mock next-intl so useTranslations / useLocale work without a provider.
vi.mock("next-intl", () => ({
  useTranslations: (namespace) => (key) => {
    const dict = {
      taskItem: {
        editReminder: "編輯提醒",
        deleteReminder: "刪除提醒",
      },
      reminders: {
        updated: "已更新",
      },
      status: {
        pending: "待辦",
      },
    };
    return dict[namespace]?.[key] ?? `${namespace}.${key}`;
  },
  useLocale: () => "zh-TW",
}));

// Stub EditReminderModal — it pulls in TaskEditForm + portals and is
// irrelevant to the aria-label assertion.
vi.mock("@/components/reminders/EditReminderModal", () => ({
  default: () => null,
}));

// Stub Card — it lives in components/ui/Card.js (.js with JSX) which
// vite can't transform under our test config. The shell wrapper isn't
// relevant to the a11y assertion; render children directly.
vi.mock("@/components/ui/Card", () => ({
  default: ({ children }) => children,
}));

// sonner toast is referenced at module scope via the toast import; the
// component only calls it inside handleSave which the test never triggers.
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import ReminderCard from "@/components/reminders/ReminderCard.jsx";

const baseReminder = {
  id: "r-1",
  title: "Submit report",
  description: "Quarterly report",
  dateTime: "2026-05-22T10:00",
  status: "pending",
  tags: ["work"],
  category: "work",
  duration: 30,
  completed: false,
};

describe("ReminderCard a11y — edit/delete buttons", () => {
  it("renders without throwing for a typical reminder", () => {
    const html = renderToStaticMarkup(
      <ReminderCard
        reminder={baseReminder}
        onDelete={() => {}}
        onUpdate={() => {}}
      />,
    );
    expect(html).toContain("Submit report");
  });

  it("edit button has aria-label set to taskItem.editReminder", () => {
    const html = renderToStaticMarkup(
      <ReminderCard
        reminder={baseReminder}
        onDelete={() => {}}
        onUpdate={() => {}}
      />,
    );
    expect(html).toMatch(/<button[^>]*aria-label="編輯提醒"/);
  });

  it("delete button has aria-label set to taskItem.deleteReminder", () => {
    const html = renderToStaticMarkup(
      <ReminderCard
        reminder={baseReminder}
        onDelete={() => {}}
        onUpdate={() => {}}
      />,
    );
    expect(html).toMatch(/<button[^>]*aria-label="刪除提醒"/);
  });
});
