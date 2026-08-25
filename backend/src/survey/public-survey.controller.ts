import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PublicSurveyService } from './public-survey.service';

// Unauthenticated by design — respondents never log in. Every method here
// takes only the public survey id, never an internal id trusted from the client.
@Controller('public/surveys')
export class PublicSurveyController {
  constructor(private publicSurveyService: PublicSurveyService) {}

  @Get(':publicId')
  getPublic(@Param('publicId') publicId: string, @Query('session') session?: string) {
    return this.publicSurveyService.getPublic(publicId, session);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':publicId/sessions')
  startSession(@Param('publicId') publicId: string) {
    return this.publicSurveyService.startSession(publicId);
  }

  @Patch(':publicId/sessions/progress')
  updateProgress(@Param('publicId') publicId: string, @Body() body: { sessionToken: string; questionIndex: number }) {
    return this.publicSurveyService.updateProgress(publicId, body.sessionToken, body.questionIndex);
  }

  // ~15s visible-tab heartbeat feeding SurveySession.activeSeconds — the basis
  // of honest completion-time analytics (wall-clock includes abandoned-tab idle).
  @Patch(':publicId/sessions/heartbeat')
  heartbeat(@Param('publicId') publicId: string, @Body() body: { sessionToken: string }) {
    return this.publicSurveyService.heartbeat(publicId, body.sessionToken);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':publicId/responses')
  submit(
    @Param('publicId') publicId: string,
    @Body() body: {
      sessionToken: string;
      answers: { questionId: string; value: any }[];
      respondentEmail?: string;
      googleCredential?: string; // Google-Forms-style verified email capture
    }
  ) {
    return this.publicSurveyService.submit(publicId, body.sessionToken, body.answers, body.respondentEmail, body.googleCredential);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(':publicId/incentive-entry')
  submitIncentiveEntry(@Param('publicId') publicId: string, @Body() body: { name: string; contact: string }) {
    return this.publicSurveyService.submitIncentiveEntry(publicId, body.name, body.contact);
  }
}
