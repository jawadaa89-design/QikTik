/**
 * Re-export logo helpers from the shared venue image storage module.
 * Menu photos and logos both use Vercel Blob in production.
 */
export {
  assertLogoFile,
  assertVenueImageFile,
  MAX_VENUE_IMAGE_BYTES,
  storeVenueLogo,
} from "@/lib/venue-image-storage";
