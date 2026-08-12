import { Controller, Get, Patch, Delete, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private adminService: AdminService) {}

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
