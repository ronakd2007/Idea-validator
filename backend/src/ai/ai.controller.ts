import { Controller, Get, Post, Param, Query, Body, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AiService } from './ai.service';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('summary/:ideaId')
  @Roles('FOUNDER')
  async getSummary(@Param('ideaId') ideaId: string, @Request() req: any, @Query('refresh') refresh?: string) {
    // In View-as-User mode this GET must stay side-effect free: serve the
    // stored summary but never generate (and bill Groq) on the admin's click.
    const readOnly = !!req.user.viewAs;
    return this.aiService.generateDashboardSummary(ideaId, req.user.userId, refresh === 'true' && !readOnly, readOnly);
  }

  @Post('generate-survey')
  @Roles('FOUNDER')
  async generateSurvey(@Body() body: { rawText: string }) {
    return this.aiService.generateSurveyFromText(body.rawText);
  }

  // Gap-to-Survey: the Weakness Detector names the gap, this builds the
  // survey that closes it — tailored to the founder's own idea.
  @Post('gap-survey')
  @Roles('FOUNDER')
  async generateGapSurvey(@Request() req: any, @Body() body: { ideaId: string; gapKey: string }) {
    return this.aiService.generateGapSurvey(body.ideaId, req.user.userId, body.gapKey || 'DEFAULT');
  }
}
