import { mkdir, copyFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import sharp from "sharp";
import { test } from "@e2e-dev/web";
import { expect } from "e2e";
const origin = "http://127.0.0.1:3137";
process.loadEnvFile(".env.local");

test("Business image crops persist across all image fields", async ({ app, screen, browser }) => {
  if (new URL(app.baseUrl!).origin !== origin || process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://flkakuysakgwfoemgbwn.supabase.co") throw new Error("Staging-only synthetic test");
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const cookies: { name: string; value: string; domain: string; path: string }[] = [];
  const ssr = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { cookies: { getAll: () => [], setAll: values => { for (const value of values) cookies.push({ name: value.name, value: value.value, domain: "127.0.0.1", path: "/" }); } } });
  const auth = { email: process.env.E2E_USER_OWNER_USERNAME!, password: process.env.E2E_USER_OWNER_PASSWORD! };
  if ((await client.auth.signInWithPassword(auth)).error || (await ssr.auth.signInWithPassword(auth)).error) throw new Error("Synthetic Staging owner sign-in failed");
  const bid = randomUUID(), pid = randomUUID(), asset = randomUUID();
  const slug = `image-crop-${Date.now().toString(36)}-${bid.slice(0, 6)}`;
  const owner = (await client.auth.getUser()).data.user!.id;
  const path = `${owner}/${bid}/${asset}.webp`, photoPath = path.replace(".webp", ".contact.jpg");
  const bucket = client.storage.from("business-media");
  const red = await sharp({ create: { width: 200, height: 200, channels: 3, background: "red" } }).png().toBuffer();
  const logo = await sharp({ create: { width: 400, height: 200, channels: 3, background: "blue" } }).composite([{ input: red, left: 0, top: 0 }]).webp().toBuffer();
  const photo = await sharp(logo).resize({ width: 384 }).jpeg().toBuffer();
  async function checked(result: { error: unknown }) { if (result.error) throw new Error("Synthetic Staging fixture operation failed"); }
  await checked(await client.from("businesses").insert({ id: bid, name: "Synthetic Image Crops", category: "QA" }));
  await checked(await bucket.upload(path, logo, { contentType: "image/webp" }));
  await checked(await bucket.upload(photoPath, photo, { contentType: "image/jpeg" }));
  await checked(await client.from("media_assets").insert({ id: asset, business_id: bid, storage_path: path, contact_photo_path: photoPath, mime_type: "image/webp", size_bytes: logo.length }));
  const logoUrl = bucket.getPublicUrl(path).data.publicUrl;
  const fields = ["https://instagram.com/qa_one", "https://instagram.com/qa_two", "https://wa.me/201012345678", "https://www.instapay.me/i?address=qa%40instapay", "https://facebook.com/qa", "https://example.test"].map((value, index) => ({ id: `link-${index}`, kind: "custom", label: `Provider ${index}`, value, enabled: true }));
  const contact = { enabled: true, displayName: "Synthetic Image Crops", organization: "QA", primaryPhone: "01012345678", fields: [...fields, { ...fields[0], id: "duplicate", kind: "social" }, { id: "phone", kind: "phone", label: "Second", value: "+442071234567", enabled: true }, { id: "hours", kind: "hours", label: "Hours", value: "9–5", enabled: true }] };
  await checked(await client.from("business_pages").insert({ id: pid, business_id: bid, slug, template: "professional", contact_config: contact }));
  await checked(await client.from("page_sections").insert([{ page_id: pid, section_key: "hero", kind: "hero", title: "", position: 0, enabled: true, content: { logoUrl, coverUrl: logoUrl, language: "en" } }, { page_id: pid, section_key: "actions", kind: "quick_actions", title: "Actions", position: 1, enabled: true, content: { items: [{ id: "call", provider: "call", label: "Call", value: "01012345678" }] } }]));
  await checked(await client.from("page_sections").insert([
    { page_id: pid, section_key: "find", kind: "contact", title: "Find us", position: 2, enabled: true, content: { address: "Synthetic QA address", mapImageUrl: logoUrl } },
    { page_id: pid, section_key: "gallery", kind: "gallery", title: "Gallery", position: 3, enabled: true, content: { items: [{ id: "gallery-one", label: "Synthetic image", url: logoUrl }] } },
    { page_id: pid, section_key: "payments", kind: "payments", title: "Payments", position: 4, enabled: true, content: { backgroundUrl: logoUrl, items: [{ id: "bank", provider: "bank", label: "Bank", value: "Synthetic instructions" }] } },
  ]));
  await checked(await client.rpc("publish_page", { target_page_id: pid }));
  const editor = `/admin/businesses/${bid}`;
  await browser.setCookies(cookies);
  await app.open(editor);
  const width = await browser.evaluate(() => innerWidth);
  const artifactPath = async (relative: string) => {
    const root = `.e2e/artifacts/${width}`;
    const paths = await readdir(root, { recursive: true });
    const found = paths.find(path => path.replaceAll("\\", "/").endsWith(relative.replaceAll("\\", "/")));
    if (!found) throw new Error(`Missing runner artifact: ${relative}`);
    return join(root, found);
  };
  const dir = "artifacts/image-crop"; await mkdir(dir, { recursive: true });
  const capture = async (label: string) => { await copyFile(await artifactPath(await app.screenshot(label)), `${dir}/${width}-${label}.png`); };
  const original = (await client.rpc("get_published_page", { page_slug: slug })).data;
  const changed: Record<string, string> = {};
  for (const [navigation, label, key] of [["Hero Hero", "Logo image", "logoUrl"], ["Hero Hero", "Hero image", "coverUrl"], ["Find us Find us", "Map image", "mapImageUrl"], ["Gallery Gallery", "Gallery image 1", "url"], ["Payments Payments", "Payments background image", "backgroundUrl"]]) {
    await browser.locator(".editor-navigator").getByRole("button", navigation, { exact: true }).tap();
    const field = browser.locator(".editor-form-pane .image-field").filter({ has: screen.getByLabel(`${label} URL`, { exact: true }) });
    const crop = field.getByRole("group", `${label} crop`, { exact: true });
    await expect(crop.getByRole("button", "Apply crop")).toBeEnabled();
    if (key !== "logoUrl") await crop.getByLabel("Crop shape").selectOption({ label: "Landscape (4:3)" });
    await crop.getByLabel("Zoom", { exact: true }).focus(); await browser.keyboard.press("End");
    await crop.getByRole("button", "Reset", { exact: true }).tap();
    await expect(crop.getByLabel("Zoom", { exact: true })).toHaveValue("1000");
    await crop.getByLabel("Zoom", { exact: true }).focus(); await browser.keyboard.press("End");
    await crop.getByLabel("Horizontal position").focus(); await browser.keyboard.press("End");
    await crop.getByRole("button", "Apply crop").tap();
    await expect(field.getByLabel(`${label} URL`, { exact: true })).not.toHaveValue(logoUrl, { timeout: 30000 });
    const url = await field.getByLabel(`${label} URL`, { exact: true }).inputValue(); changed[key] = url;
    const image = await sharp(Buffer.from(await (await fetch(url)).arrayBuffer())).metadata();
    expect(image.format).toBe("webp"); expect(image.width! / image.height!).toBeCloseTo(key === "logoUrl" ? 1 : 4 / 3, 1);
    const stats = await sharp(Buffer.from(await (await fetch(url)).arrayBuffer())).stats();
    expect(stats.channels[2].mean).toBeGreaterThan(230); expect(stats.channels[0].mean).toBeLessThan(20);
    const count = (await bucket.list(`${owner}/${bid}`)).data!.length;
    await crop.getByRole("button", "Apply crop").tap();
    await expect(field.getByText("This crop is already applied.")).toBeVisible();
    expect((await bucket.list(`${owner}/${bid}`)).data!.length).toBe(count);
    if (key === "logoUrl" || key === "mapImageUrl") { await crop.scrollIntoView(); await capture(key === "logoUrl" ? "logo-editor" : "find-us-editor"); }
  }
  await screen.getByRole("button", "Save draft", { exact: true }).tap();
  await expect(browser.locator(".editor-save-status")).toHaveText("Draft saved", { timeout: 30000 });
  expect((await client.rpc("get_published_page", { page_slug: slug })).data).toEqual(original);
  await browser.reload();
  const rows = (await client.from("page_sections").select("kind,content").eq("page_id", pid)).data!;
  for (const row of rows) {
    for (const [key, edit] of Object.entries(row.content.imageEdits || {})) {
      expect((edit as { sourceUrl: string }).sourceUrl).toBe(logoUrl); expect(row.content[key]).toBe(changed[key]);
    }
    if (row.kind === "gallery") { expect(row.content.items[0].imageEdit.sourceUrl).toBe(logoUrl); expect(row.content.items[0].url).toBe(changed.url); }
  }
  await expect(browser.locator(".editor-form-pane").getByLabel("Logo image URL", { exact: true })).toHaveValue(changed.logoUrl);
  const logoField = browser.locator(".editor-form-pane .image-field").filter({ has: screen.getByLabel("Logo image URL", { exact: true }) });
  await expect(logoField.getByLabel("Zoom", { exact: true })).toHaveValue("4000");
  await screen.getByRole("button", "Publish", { exact: true }).tap();
  await expect(browser.locator(".editor-save-status")).toHaveText("Published", { timeout: 30000 });
  const published = (await client.rpc("get_published_page", { page_slug: slug })).data;
  expect(published.sections.find((section: { kind: string }) => section.kind === "hero").content.logoUrl).toBe(changed.logoUrl);
  expect(Buffer.from(await (await bucket.download(path)).data!.arrayBuffer()).equals(logo)).toBe(true);
  await app.open(`/b/${slug}`);
  await expect(browser.locator(".business-logo img")).toHaveAttribute("src", new RegExp(encodeURIComponent(changed.logoUrl)));
  await capture("published");
  await app.open(editor);
  await logoField.getByRole("button", "Restore original logo image").tap();
  await expect(logoField.getByLabel("Logo image URL", { exact: true })).toHaveValue(logoUrl);
  await screen.getByRole("button", "Save draft", { exact: true }).tap();
  await expect(browser.locator(".editor-save-status")).toHaveText("Draft saved", { timeout: 30000 });
  expect((await client.rpc("get_published_page", { page_slug: slug })).data.sections.find((section: { kind: string }) => section.kind === "hero").content.logoUrl).toBe(changed.logoUrl);
  await browser.reload(); await expect(logoField.getByLabel("Logo image URL", { exact: true })).toHaveValue(logoUrl);
  await writeFile(`${dir}/fixture-${width}.json`, JSON.stringify({ businessId: bid, pageId: pid, slug, staging: true }, null, 2));
  await client.auth.signOut({ scope: "local" });
});
