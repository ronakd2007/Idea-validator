import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ValidationService } from './validation.service';
import { SubmitValidationDto } from './dto/submit-validation.dto';

@Controller('validation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ValidationController {
  constructor(private validationService: ValidationService) {}

  @Post(':ideaId')
  @Roles('VALIDATOR')
  submit(@Param('ideaId') ideaId: string, @Request() req, @Body() body: SubmitValidationDto) {
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

  // Founder-only: rate how useful a review was. Ownership is checked in the
  // service; the global view-as middleware blocks this while an admin is
  // viewing as the founder.
  @Patch(':validationId/rating')
  @Roles('FOUNDER')
  rate(@Param('validationId') validationId: string, @Request() req, @Body() body: { rating: number }) {
    return this.validationService.rateValidation(validationId, req.user.userId, Number(body?.rating));
  }
}
