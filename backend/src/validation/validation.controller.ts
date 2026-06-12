import { Controller, Post, Get, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ValidationService } from './validation.service';

@Controller('validation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ValidationController {
  constructor(private validationService: ValidationService) {}

  @Post(':ideaId')
  @Roles('VALIDATOR')
  submit(@Param('ideaId') ideaId: string, @Request() req, @Body() body: any) {
    return this.validationService.submitValidation(ideaId, req.user.userId, body);
  }

  @Get('history')
  @Roles('VALIDATOR')
  getHistory(@Request() req) {
    return this.validationService.getValidatorHistory(req.user.userId);
  }

  @Get('check/:ideaId')
  @Roles('VALIDATOR')
  checkValidated(@Param('ideaId') ideaId: string, @Request() req) {
    return this.validationService.checkAlreadyValidated(ideaId, req.user.userId);
  }
}
