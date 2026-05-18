// Footer — variant-aware. Modal variant shows a Cancel button next to
// Save; panel variant has no Cancel (close is handled by the surrounding
// TaskDetailPanel header + click-outside).

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Footer from "@/components/tasks/taskEditForm/Footer.jsx";

const T = (key) => `T(${key})`;

describe("Footer", () => {
  it("modal variant renders the Cancel button", () => {
    const html = renderToStaticMarkup(
      <Footer
        variant="modal"
        isSubmitting={false}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
        t={T}
      />,
    );
    expect(html).toContain("T(cancel)");
    expect(html).toContain("T(save)");
  });

  it("panel variant omits the Cancel button", () => {
    const html = renderToStaticMarkup(
      <Footer
        variant="panel"
        isSubmitting={false}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
        t={T}
      />,
    );
    expect(html).not.toContain("T(cancel)");
    expect(html).toContain("T(save)");
  });

  it("shows 'saving' label when isSubmitting=true", () => {
    const html = renderToStaticMarkup(
      <Footer
        variant="modal"
        isSubmitting={true}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
        t={T}
      />,
    );
    expect(html).toContain("T(saving)");
    expect(html).not.toContain(">T(save)<");
  });
});
