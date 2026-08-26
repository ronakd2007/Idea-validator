import { Controller, Get, Post, Param, Query, Body, Request, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AiService } from './ai.service';
import { AgentService } from './agent.service';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(private readonly aiService: AiService, private readonly agentService: AgentService) {}

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

  // Assumption Checker: suggest up to 5 testable hypotheses for the founder
  // to review — nothing is saved unless the founder explicitly accepts them.
  @Post('suggest-assumptions')
  @Roles('FOUNDER')
  async suggestAssumptions(@Request() req: any, @Body() body: { ideaId?: string; draft?: any }) {
    return this.aiService.suggestAssumptions(req.user.userId, { ideaId: body?.ideaId, draft: body?.draft });
  }

  // ---------- AI Deep Dive ----------
  //
  // Runs normally start themselves when an idea is paid for. This is the manual
  // entry point: ideas that predate the feature, and retrying a failed run.
  // A run costs real search credits and model calls, hence the tight throttle.
  @Post('agent/run/:ideaId')
  @Roles('FOUNDER')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async runAgent(@Param('ideaId') ideaId: string, @Request() req: any) {
    return this.agentService.startRun(ideaId, req.user.userId, 'manual');
  }

  @Get('agent/latest/:ideaId')
  @Roles('FOUNDER')
  async getAgentLatest(@Param('ideaId') ideaId: string, @Request() req: any) {
    // View-as-User must not write: reconciling an interrupted run is a founder
    // action, not something an admin's page view should trigger.
    return this.agentService.getLatest(ideaId, req.user.userId, { readOnly: !!req.user.viewAs });
  }

  @Get('agent/runs/:ideaId')
  @Roles('FOUNDER')
  async listAgentRuns(@Param('ideaId') ideaId: string, @Request() req: any) {
    return this.agentService.listRuns(ideaId, req.user.userId);
  }
}
