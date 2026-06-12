import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('validator-profile')
  getValidatorProfile(@Request() req) {
    return this.usersService.getValidatorProfile(req.user.userId);
  }

  @Patch('validator-profile')
  updateValidatorProfile(@Request() req, @Body() body: any) {
    return this.usersService.updateValidatorProfile(req.user.userId, body);
  }
}
