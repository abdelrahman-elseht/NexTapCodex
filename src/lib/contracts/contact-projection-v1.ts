import { z } from "zod";

const projectionText = z.string().max(2000).refine(
  value => new TextEncoder().encode(value).byteLength <= 8192 && !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(value),
  "Use plain text without control characters.",
);

const phoneTypeSchema = z.enum(["mobile", "landline", "work", "other"]);
const contactFieldSchema = z.object({
  kind: z.enum(["phone", "email", "website", "address", "whatsapp", "social", "hours", "notes", "custom"]),
  label: projectionText.refine(value => value.length <= 100, "Labels must be at most 100 characters."),
  value: projectionText,
  phoneType: phoneTypeSchema.optional(),
}).strict();

export const contactProjectionV1Schema = z.object({
  version: z.literal(1),
  enabled: z.literal(true),
  displayName: projectionText,
  organization: projectionText,
  primaryPhone: projectionText,
  primaryPhoneType: phoneTypeSchema.optional(),
  fields: z.array(contactFieldSchema).max(30),
  photoPath: z.string().max(2048).optional(),
  showDownloadLink: z.boolean().optional(),
}).strict();

export type ContactProjectionV1 = z.infer<typeof contactProjectionV1Schema>;
