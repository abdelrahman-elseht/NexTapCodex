import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AdminLoading from "@/app/admin/loading";
import { AdminListLoading } from "@/components/admin/admin-list-loading";

describe("admin loading states", () => {
  it("shows a named busy state while admin data is pending", () => {
    const html = renderToStaticMarkup(React.createElement(AdminLoading));

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="جارٍ تحميل بيانات الإدارة"');
    expect(html).toContain('role="status"');
    expect(html).toContain("جارٍ تحميل بيانات الإدارة");
  });

  it("provides a bilingual list status and hides decorative placeholders", () => {
    const html = renderToStaticMarkup(React.createElement(AdminListLoading));

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('role="status"');
    expect(html).toContain("Loading list · جارٍ تحميل القائمة");
    expect(html).toContain('aria-hidden="true"');
  });
});
