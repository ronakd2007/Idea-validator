import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'crypto';

// Pitch videos are uploaded straight from the founder's browser to Cloudinary.
// The file never passes through this server — Render's free tier has 512MB of
// RAM and an ephemeral disk, so proxying (or storing) a 200MB video here would
// be both slow and pointless. This service only hands out a short-lived signed
// permission slip; the API secret never leaves the backend.
@Injectable()
export class UploadsService {
  // Everything lands under one folder so it's easy to find, meter, or purge.
  private static readonly FOLDER = 'ideavalidator/pitch-videos';
  private static readonly IMAGE_FOLDER = 'ideavalidator/startup-logos';

  // Cloudinary's scheme: sort the signed params alphabetically, join as
  // k=v&k=v, append the API secret, SHA-1 the result.
  private sign(params: Record<string, string | number>, apiSecret: string): string {
    const toSign = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');
    return createHash('sha1').update(toSign + apiSecret).digest('hex');
  }

  // Shared by every upload kind — only the destination folder differs.
  private createSignature(folder: string, unavailableMessage: string) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException(unavailableMessage);
    }

    // Signature is valid for ~1 hour on Cloudinary's side, which is ample for
    // a single upload and short enough that a leaked slip is near-useless.
    const timestamp = Math.floor(Date.now() / 1000);
    return {
      cloudName,
      apiKey,
      timestamp,
      folder,
      signature: this.sign({ folder, timestamp }, apiSecret),
    };
  }

  createVideoUploadSignature() {
    return this.createSignature(
      UploadsService.FOLDER,
      'Video uploads are not configured on the server yet. You can paste a video link instead.'
    );
  }

  // Startup logos. Separate folder so images and pitch videos stay easy to
  // meter and purge independently.
  createImageUploadSignature() {
    return this.createSignature(
      UploadsService.IMAGE_FOLDER,
      'Image uploads are not configured on the server yet.'
    );
  }
}
