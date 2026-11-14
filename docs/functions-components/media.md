# Media Functions

| Export | Source | Reuse contract | Primary verification |
| --- | --- | --- | --- |
| `prepareImage`, `optimizeImage`, `inspectStillRaster` | `src/lib/media/prepare.ts`, `optimize.ts`, `inspect.ts` | Validates and creates optimized image data; current processing uses Node and `sharp` | Media preparation/inspection tests and upload E2E |
| `ImageEdit`, `imageCropRectangle`, `renderImageCrop` | `src/lib/media/image-edit.ts` | Validated crop geometry and server image rendering | Image edit tests and image crop E2E |
| `prepareContactPhoto` | `src/lib/media/contact-photo.ts` | Prepares contact photo bytes for current managed-media flow | Media/contact-photo tests |
| `resolveContactPhoto` | `src/lib/media/resolve-contact-photo.ts` | Resolves the selected current contact photo from business state | Contact and media tests |
| `readManagedObject` | `src/lib/media/read-object.ts` | Bounded read of a managed object through the current storage adapter | Managed-object tests |
| `storeManagedImage` | `src/lib/media/store.ts` | Writes a processed image through current Supabase Storage | Media store and upload tests |
| `isOptimizableImage`, `mediaDisplayUrl` | `src/lib/media/urls.ts` | Validates current managed image URLs and display transformations | Media URL/rendering tests |

Storage functions are legacy adapter contracts unless a target-phase implementation explicitly reuses them. Keep processing, authorization, and storage responsibilities clear when implementing R2 behavior.
