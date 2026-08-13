import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminService } from './admin.service';
import { ViewAsService } from '../auth/view-as.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private adminService: AdminService, private viewAsService: ViewAsService) {}

  // ---------- View as User ----------
  // Both routes live under /admin, where identity substitution never applies:
  // req.user here is always the REAL admin, even if a stale X-View-As header
  // is still attached.

  // 'view-as/end' MUST be declared before 'view-as/:userId' — Nest matches in
  // declaration order, and the param route would otherwise swallow "end".
  @Post('view-as/end')
  endViewAs(@Request() req, @Body() body: { targetUserId?: string }) {
    return this.viewAsService.end(req.user.userId, body?.targetUserId || '');
  }

  @Post('view-as/:userId')
  startViewAs(@Param('userId') userId: string, @Request() req) {
    return this.viewAsService.start(req.user.userId, userId);
  }

  @Get('analytics')
  getAnalytics() {
    return this.adminService.getAnalytics();
  }

  @Get('users')
  getUsers(@Query('role') role?: string) {
    return this.adminService.getUsers(role);
  }

  @Get('validators/pending')
  getPendingValidators() {
    return this.adminService.getPendingValidators();
  }

  @Patch('validators/:id/approve')
  approveValidator(@Param('id') id: string, @Request() req) {
    return this.adminService.approveValidator(id, req.user.userId);
  }

  @Patch('validators/:id/reject')
  rejectValidator(@Param('id') id: string, @Request() req) {
    return this.adminService.rejectValidator(id, req.user.userId);
  }

  @Get('ideas')
  getIdeas() {
    return this.adminService.getIdeas();
  }

  @Delete('ideas/:id')
  deleteIdea(@Param('id') id: string, @Request() req) {
    return this.adminService.deleteIdea(id, req.user.userId);
  }

  @Patch('users/:id/toggle-status')
  toggleUserStatus(@Param('id') id: string, @Request() req) {
    return this.adminService.toggleUserStatus(id, req.user.userId);
  }

  // Irreversible: erases the user and all their data/history. Self-deletion
  // and deleting other ADMIN accounts are refused in the service.
  @Delete('users/:id')
  deleteUser(@Param('id') id: string, @Request() req) {
    return this.adminService.deleteUser(id, req.user.userId);
  }

  @Get('surveys')
  getSurveys() {
    return this.adminService.getSurveys();
  }

  @Patch('surveys/:id/toggle-status')
  toggleSurveyStatus(@Param('id') id: string, @Request() req) {
    return this.adminService.toggleSurveyStatus(id, req.user.userId);
  }

  @Delete('surveys/:id')
  deleteSurvey(@Param('id') id: string, @Request() req) {
    return this.adminService.deleteSurvey(id, req.user.userId);
  }
}
