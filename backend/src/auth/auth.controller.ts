import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('send-otp')
  sendOtp(@Body() body: { phone: string }) {
    return this.authService.sendOtp(body.phone);
  }

  @Post('register/founder')
  registerFounder(@Body() body: { name: string; email: string; password: string; phone: string; otp: string }) {
    return this.authService.registerFounder(body);
  }

  @Post('register/validator')
  registerValidator(
    @Body()
    body: {
      name: string;
      email: string;
      password: string;
      phone: string;
      otp: string;
      occupation: string;
      yearsOfExperience: number;
      areasOfExpertise: string[];
      linkedinUrl: string;
      contactPreferences: string[];
    },
  ) {
    return this.authService.registerValidator(body);
  }

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return this.authService.getProfile(req.user.userId);
  }
}
