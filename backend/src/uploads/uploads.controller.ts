import { Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UploadsService } from './uploads.service';

@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadsController {
  constructor(private uploadsService: UploadsService) {}

  // Founders only, and rate limited: each call is permission to write one file
  // into our Cloudinary account, so it should never be cheap to farm.
  // The global view-as middleware already blocks this for admins in view mode.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('video-signature')
  @Roles('FOUNDER')
  videoSignature() {
    return this.uploadsService.createVideoUploadSignature();
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('image-signature')
  @Roles('FOUNDER')
  imageSignature() {
    return this.uploadsService.createImageUploadSignature();
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('document-signature')
  @Roles('FOUNDER')
  documentSignature() {
    return this.uploadsService.createDocumentUploadSignature();
  }
}
