import { Controller, Get, Patch, Delete, Param, Query, UseGuards } from '@nestjs/common';
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
  approveValidator(@Param('id') id: string) {
    return this.adminService.approveValidator(id);
  }

  @Patch('validators/:id/reject')
  rejectValidator(@Param('id') id: string) {
    return this.adminService.rejectValidator(id);
  }

  @Get('ideas')
  getIdeas() {
    return this.adminService.getIdeas();
  }

  @Delete('ideas/:id')
  deleteIdea(@Param('id') id: string) {
    return this.adminService.deleteIdea(id);
  }

  @Patch('users/:id/toggle-status')
  toggleUserStatus(@Param('id') id: string) {
    return this.adminService.toggleUserStatus(id);
  }
}
