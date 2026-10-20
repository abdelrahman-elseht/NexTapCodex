import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

const parser = createRequire(import.meta.url)("vcard-parser");
const origin = "http://127.0.0.1:3137";
async function cardFile(path: string, name: string) {
  const bytes = await readFile(path); const text = bytes.toString("utf8");
  expect(bytes.length).toBeLessThanOrEqual(300 * 1024);
  expect(text.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\n")).toBe(true);
  expect(text.endsWith("END:VCARD\r\n")).toBe(true);
  expect(text.match(/BEGIN:VCARD/g)).toHaveLength(1);
  expect(parser.parse(text).fn[0].value).toBe(name);
  for (const line of text.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  return text;
}

test("Contacts configure, preview, save/reload, publish, download and disable on main and branch", async ({app,screen,browser}) => {
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
    const landline = index ? "02 1234-5679" : "(02) 1234-5678";
    await contact.getByLabel("Primary phone").fill(landline);
    await contact.getByLabel("Primary phone type").selectOption("landline");
    await contact.getByLabel("Organization").fill("Synthetic local QA");
    if (index) {
      await contact.getByRole("button", "Add contact field").tap();
      const phone = contact.getByRole("group").last();
      await phone.getByLabel("Type").selectOption("phone");
      await phone.getByLabel("Phone type").selectOption("mobile");
      await phone.getByLabel("Label", { exact: true }).fill("International mobile");
      await phone.getByLabel("Value", { exact: true }).fill("+44 (0)20-7123-4567");
    }
    await contact.getByRole("button", "Add contact field").tap();
    const row = contact.getByRole("group").last();
    await row.getByLabel("Type").selectOption("email");
    await row.getByLabel("Label", { exact: true }).fill("Work");
    await row.getByLabel("Value", { exact: true }).fill("synthetic@example.test");
    await screen.getByRole("button","Preview",{exact:true}).tap();
    await expect(browser.locator(".editor-phone-screen .contact-download-button")).toHaveCount(1);
    const preview = await browser.waitForDownload(()=>contact.getByRole("button","Test contact download").tap());
    const previewVcard = await cardFile(preview.path, name);
    expect(previewVcard).toContain(`TEL;TYPE=WORK,VOICE:${landline.replace(/[^0-9]/g, "")}`);
    if (index) expect(previewVcard).toContain("TEL;TYPE=CELL:+4402071234567");
    await screen.getByRole("button","Save draft",{exact:true}).tap();
    await expect(browser.locator(".editor-save-status")).toContainText(/saved/i);
    await browser.reload();
    await expect(contact.getByLabel("Display name")).toHaveValue(name);
    await expect(contact.getByRole("group").last().getByLabel("Value",{exact:true})).toHaveValue("synthetic@example.test");
    if (index) await expect(contact.getByRole("group").first().getByLabel("Value", { exact: true })).toHaveValue("+44 (0)20-7123-4567");
    const slug=await screen.getByLabel("Public slug").inputValue();
    await screen.getByRole("button","Publish",{exact:true}).tap();
    await expect(browser.locator(".editor-save-status")).toContainText(/published/i);
    await app.open('/b/'+slug);
    const cta=browser.locator(".contact-download-button");
    await expect(cta).toHaveCount(1);
    const download=await browser.waitForDownload(()=>browser.locator(".contact-download-fallback").tap());
    const publicVcard = await cardFile(download.path, name);
    expect(publicVcard).toContain(`TEL;TYPE=WORK,VOICE:${landline.replace(/[^0-9]/g, "")}`);
    if (index) expect(publicVcard).toContain("TEL;TYPE=CELL:+4402071234567");
    await app.open(editor);
    await contact.getByRole("checkbox","Enable contact download").uncheck();
    await screen.getByRole("button","Publish",{exact:true}).tap();
    await expect(browser.locator(".editor-save-status")).toContainText(/published/i);
    const denied=await fetch(origin+'/b/'+slug+'/contact.vcf',{redirect:"manual"});
    expect(denied.status).toBe(404);
  }
});

test("anonymous draft preview and invalid contact routes are denied",async()=>{
  for(const path of ["/b/contacts-missing-synthetic/contact.vcf","/c/contacts-invalid-synthetic/contact.vcf"]) {
    const response=await fetch(origin+path,{redirect:"manual"}); expect(response.status).toBe(404);
  }
  const response=await fetch(origin+"/api/admin/businesses/contact-preview",{method:"POST",headers:{origin},redirect:"manual"});
  expect(response.status).toBe(404);
});
