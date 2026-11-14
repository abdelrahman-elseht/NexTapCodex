import { createHash } from "node:crypto";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function verifyR2ObjectReferences({ publications, mediaReferences, objects }) {
  if (!Array.isArray(publications) || !Array.isArray(mediaReferences) || !Array.isArray(objects)) {
    throw new Error("R2 integrity input must contain publication, media-reference, and object arrays.");
  }

  const inventory = new Map();
  for (const object of objects) {
    if (!object || typeof object.key !== "string" || !object.key || inventory.has(object.key)) {
      throw new Error("R2 inventory contains an invalid or duplicate object key.");
    }
    if (object.sha256 !== undefined && !/^[a-f0-9]{64}$/i.test(object.sha256)) {
      throw new Error(`R2 inventory has an invalid SHA-256 for ${object.key}.`);
    }
    inventory.set(object.key, object);
  }

  const required = new Set();
  const publicationIds = new Set();
  for (const publication of publications) {
    if (!publication?.id || !publication.artifact_key || !publication.manifest_json || !publication.manifest_sha256) {
      throw new Error("A restored publication is missing its artifact or manifest integrity fields.");
    }
    if (publicationIds.has(publication.id)) throw new Error(`Duplicate restored publication id: ${publication.id}.`);
    publicationIds.add(publication.id);
    let manifest;
    try { manifest = JSON.parse(publication.manifest_json); }
    catch { throw new Error(`Publication ${publication.id} has invalid manifest JSON.`); }
    if (sha256(publication.manifest_json) !== publication.manifest_sha256.toLowerCase()) {
      throw new Error(`Publication ${publication.id} manifest SHA-256 does not match.`);
    }
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
      throw new Error(`Publication ${publication.id} manifest must be a JSON object.`);
    }
    required.add(publication.artifact_key);
  }

  for (const reference of mediaReferences) {
    if (!reference?.publication_id || !reference.object_key || !/^[a-f0-9]{64}$/i.test(reference.sha256 ?? "")) {
      throw new Error("A publication media reference is missing a valid key or SHA-256.");
    }
    if (!publicationIds.has(reference.publication_id)) {
      throw new Error(`Publication media reference points to missing publication ${reference.publication_id}.`);
    }
    required.add(reference.object_key);
  }

  const missing = [...required].filter((key) => !inventory.has(key));
  if (missing.length) throw new Error(`R2 integrity verification failed; referenced objects are missing: ${missing.join(", ")}.`);

  for (const reference of mediaReferences) {
    const object = inventory.get(reference.object_key);
    if (!object.sha256 || object.sha256.toLowerCase() !== reference.sha256.toLowerCase()) {
      throw new Error(`R2 integrity verification failed; SHA-256 mismatch for ${reference.object_key}.`);
    }
  }

  return {
    references: required.size,
    mediaChecksums: mediaReferences.length,
    manifests: publications.length,
    inventoryObjects: inventory.size,
  };
}
