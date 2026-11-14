# Media

## Managed image uploads and AVIF

- **Symptom:** The admin picker rejected AVIF before upload, and large AVIF files could be rejected by browser/server checks even though Sharp can decode them.
- **Verified cause:** The picker `accept` setting, browser header inspection, and server optimizer maintained separate JPEG/PNG/WebP allowlists.
- **Solution:** AVIF is listed in the picker/help text, recognized by bounded ISO-BMFF `ispe` inspection, accepted by Sharp, and covered by real-byte unit tests. The server still verifies bytes, dimensions, animation state, and the 5 MiB limit.
- **Regression guard:** When changing formats, update picker, header inspection, optimizer, and tests together; use generated real-image tests. Do not trust filename extensions or MIME declarations.
