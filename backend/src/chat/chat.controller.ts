import { Controller, Get, Post, Delete, Param, Body, Request, Response, UseGuards } from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ChatService } from './chat.service';

// Every route here is founder-only and ownership-checked inside ChatService
// (via the same service calls the report pages themselves use) before any
// data — including SSE headers — is written to the response. The global
// ViewAsReadonlyMiddleware already blocks every non-GET route here while an
// admin is in View-as-User mode, so the assistant can never be driven, only
// read, from that mode.
@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FOUNDER')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('ideas/:ideaId')
  getIdeaConversation(@Param('ideaId') ideaId: string, @Request() req: any) {
    return this.chatService.getConversation(req.user.userId, { ideaId });
  }

  @Post('ideas/:ideaId/messages')
  async sendIdeaMessage(@Param('ideaId') ideaId: string, @Body() body: { content: string }, @Request() req: any, @Response() res: ExpressResponse) {
    await this.chatService.sendMessage(req.user.userId, { ideaId }, body?.content || '', res);
  }

  @Post('ideas/:ideaId/regenerate')
  async regenerateIdeaMessage(@Param('ideaId') ideaId: string, @Request() req: any, @Response() res: ExpressResponse) {
    await this.chatService.regenerate(req.user.userId, { ideaId }, res);
  }

  @Post('ideas/:ideaId/new')
  newIdeaChat(@Param('ideaId') ideaId: string, @Request() req: any) {
    return this.chatService.startNewChat(req.user.userId, { ideaId });
  }

  @Delete('ideas/:ideaId')
  deleteIdeaChat(@Param('ideaId') ideaId: string, @Request() req: any) {
    return this.chatService.deleteConversation(req.user.userId, { ideaId });
  }

  @Get('surveys/:surveyId')
  getSurveyConversation(@Param('surveyId') surveyId: string, @Request() req: any) {
    return this.chatService.getConversation(req.user.userId, { surveyId });
  }

  @Post('surveys/:surveyId/messages')
  async sendSurveyMessage(@Param('surveyId') surveyId: string, @Body() body: { content: string }, @Request() req: any, @Response() res: ExpressResponse) {
    await this.chatService.sendMessage(req.user.userId, { surveyId }, body?.content || '', res);
  }

  @Post('surveys/:surveyId/regenerate')
  async regenerateSurveyMessage(@Param('surveyId') surveyId: string, @Request() req: any, @Response() res: ExpressResponse) {
    await this.chatService.regenerate(req.user.userId, { surveyId }, res);
  }

  @Post('surveys/:surveyId/new')
  newSurveyChat(@Param('surveyId') surveyId: string, @Request() req: any) {
    return this.chatService.startNewChat(req.user.userId, { surveyId });
  }

  @Delete('surveys/:surveyId')
  deleteSurveyChat(@Param('surveyId') surveyId: string, @Request() req: any) {
    return this.chatService.deleteConversation(req.user.userId, { surveyId });
  }
}
