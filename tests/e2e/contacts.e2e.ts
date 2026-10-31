import { createRequire } from "node:module";
import { test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

const parser = createRequire(import.meta.url)("vcard-parser");
const origin = "http://127.0.0.1:3137";
function localOnly(baseUrl: string | undefined) {
  if (!baseUrl || new URL(baseUrl).origin !== origin || process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:56321" || process.env.E2E_SERVER_MODE !== "production") throw new Error("Contacts tests only run on the isolated local production app and exact local Supabase port.");
}
function cardFile(text: string, name: string) {
  const bytes = Buffer.from(text, "utf8");
  expect(bytes.length).toBeLessThanOrEqual(300 * 1024);
  if (!text.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\n")) throw new Error("VCF response is missing its vCard 3.0 header.");
  if (!text.endsWith("END:VCARD\r\n")) throw new Error("VCF response is missing its vCard terminator.");
  expect(text.match(/BEGIN:VCARD/g)).toHaveLength(1);
  expect(parser.parse(text).fn[0].value).toBe(name);
  for (const line of text.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
}

test("local draft authorization probe does not save", async ({app,browser}) => {
  localOnly(app.baseUrl);
  test.skip(!process.env.E2E_USER_OWNER_USERNAME || !process.env.E2E_USER_OWNER_PASSWORD, "Requires local owner credentials.");
  await browser.route("**", async route => {
    const requestOrigin = new URL(route.request.url).origin;
    if (![origin,"http://127.0.0.1:56321"].includes(requestOrigin)) await route.abort(); else await route.continue();
  });
  await app.open("/login");
  await browser.locator('input[type="email"]').fill(credentials.user("owner").username);
  await browser.locator('input[type="password"]').fill(credentials.user("owner").password);
  await browser.locator('button[type="submit"]').tap();
  await expect(browser).toHaveURL(/\/admin(?:\?.*)?$/);
  const probe = await browser.evaluate(async () => {
    const form = new FormData();
    form.set("mode", "diagnostic-probe");
    form.set("draft", "{}");
    const response = await fetch("/api/admin/businesses/draft", {method:"POST", body:form, redirect:"manual"});
    const body = await response.text();
    let bodyClass = body === "Forbidden" ? "forbidden" : body === "Unauthorized" ? "unauthorized" : "other";
    try {
      const payload = JSON.parse(body) as { error?: unknown };
      if (payload.error === "Invalid save mode.") bodyClass = "invalid-mode";
    } catch { /* Plain-text denial responses are classified above. */ }
    return {status:response.status, requestId:response.headers.get("x-nextap-request-id"), bodyClass};
  });
  console.info("[phase1-draft-probe] " + JSON.stringify(probe));
  expect(probe.status).toBe(400);
  expect(probe.bodyClass).toBe("invalid-mode");
  expect(probe.requestId).toMatch(/^[0-9a-f-]{36}$/i);
});

test("Contacts configure, preview, save/reload, publish, download and disable on main and branch", async ({app,screen,browser}) => {
  localOnly(app.baseUrl);
  test.skip(process.env.E2E_ALLOW_MUTATIONS !== "true", "Requires explicitly enabled disposable local mutations.");
  const business = process.env.E2E_CONTACT_BUSINESS_ID;
  const pages = [process.env.E2E_CONTACT_MAIN_PAGE_ID,process.env.E2E_CONTACT_BRANCH_PAGE_ID];
  test.skip(!business || pages.some(page=>!page) || !process.env.E2E_USER_OWNER_USERNAME || !process.env.E2E_USER_OWNER_PASSWORD, "Requires synthetic owned business with main and branch page fixtures and local owner credentials.");
  await browser.route("**", async route => {
    const requestOrigin = new URL(route.request.url).origin;
    if (![origin,"http://127.0.0.1:56321"].includes(requestOrigin)) await route.abort(); else await route.continue();
  });
  await app.open("/login");
  await browser.locator('input[type="email"]').fill(credentials.user("owner").username);
  await browser.locator('input[type="password"]').fill(credentials.user("owner").password);
  await browser.locator('button[type="submit"]').tap();
  await expect(browser).toHaveURL(/\/admin(?:\?.*)?$/);
  for (const [index,page] of pages.entries()) {
    const editor = '/admin/businesses/'+business+'?page='+page;
    await app.open(editor);
    const contact = browser.locator(".contact-card-editor");
    await contact.getByRole("checkbox","Enable contact download").check();
    const name = 'Synthetic Contacts '+(index ? 'Branch' : 'Main')+' عربي 😀';
    await contact.getByLabel("Display name").fill(name);
    await contact.getByLabel("Primary phone").fill(index ? "+201012345679" : "+201012345678");
    await contact.getByLabel("Organization").fill("Synthetic local QA");
    await contact.getByRole("button","Add contact field").tap();
    const row=contact.getByRole("group").last();
    await row.getByLabel("Type").selectOption("email");
    await row.getByLabel("Label",{exact:true}).fill("Work");
    await row.getByLabel("Value",{exact:true}).fill("synthetic@example.test");
    await screen.getByRole("button","Preview",{exact:true}).tap();
    await expect(browser.locator(".editor-phone-screen .contact-download-button")).toHaveCount(1);
    const previewResponseWait = browser.waitForResponse("**/api/admin/businesses/contact-preview");
    await browser.waitForDownload(()=>contact.getByRole("button","Test contact download").tap());
    const previewResponse = await previewResponseWait;
    expect(previewResponse.status).toBe(200);
    expect(previewResponse.headers["content-type"]).toMatch(/^text\/vcard(?:;|$)/i);
    expect(previewResponse.headers["content-disposition"]).toContain('filename="business-contact.vcf"');
    await screen.getByRole("button","Save draft",{exact:true}).tap();
    await expect(browser.locator(".editor-save-status")).toContainText(/saved/i);
    await browser.reload();
    await expect(contact.getByLabel("Display name")).toHaveValue(name);
    await expect(contact.getByRole("group").last().getByLabel("Value",{exact:true})).toHaveValue("synthetic@example.test");
    const slug=await screen.getByLabel("Public slug").inputValue();
    await screen.getByRole("button","Publish",{exact:true}).tap();
    await expect(browser.locator(".editor-save-status")).toContainText(/published/i);
    await app.open('/b/'+slug);
    const cta=browser.locator(".contact-download-button");
    await expect(cta).toHaveCount(1);
    await browser.waitForDownload(()=>browser.locator(".contact-download-fallback").tap());
    const publicVcf=await fetch(origin+"/b/"+slug+"/contact.vcf?download=1");
    expect(publicVcf.status).toBe(200);
    expect(publicVcf.headers.get("content-type")).toMatch(/^text\/vcard(?:;|$)/i);
    expect(publicVcf.headers.get("content-disposition")).toContain('attachment; filename="business-contact.vcf"');
    cardFile(await publicVcf.text(),name);
    await app.open(editor);
    await contact.getByRole("checkbox","Enable contact download").uncheck();
    await screen.getByRole("button","Publish",{exact:true}).tap();
    await expect(browser.locator(".editor-save-status")).toContainText(/published/i);
    const denied=await fetch(origin+'/b/'+slug+'/contact.vcf',{redirect:"manual"});
    expect(denied.status).toBe(404);
  }
});

test("anonymous draft preview and invalid contact routes are denied",async({app})=>{
  localOnly(app.baseUrl);
  for(const path of ["/b/contacts-missing-synthetic/contact.vcf","/c/contacts-invalid-synthetic/contact.vcf"]) {
    const response=await fetch(origin+path,{redirect:"manual"}); expect(response.status).toBe(404);
  }
  const response=await fetch(origin+"/api/admin/businesses/contact-preview",{method:"POST",headers:{origin},redirect:"manual"});
  expect(response.status).toBe(404);
});
