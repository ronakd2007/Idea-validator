import { Controller, Get, Post, Param, Body, Request, UseGuards } from '@nestjs/common';
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
  async getSummary(@Param('ideaId') ideaId: string, @Request() req: any) {
    return this.aiService.generateDashboardSummary(ideaId, req.user.userId);
  }

  @Post('generate-survey')
  @Roles('FOUNDER')
  async generateSurvey(@Body() body: { rawText: string }) {
    return this.aiService.generateSurveyFromText(body.rawText);
  }
}
