import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GoogleAuthDto, LoginDto, RegisterFounderDto, RegisterValidatorDto, SendOtpDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('send-otp')
  sendOtp(@Body() body: SendOtpDto) {
    return this.authService.sendOtp(body.phone);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register/founder')
  registerFounder(@Body() body: RegisterFounderDto) {
    return this.authService.registerFounder(body);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register/validator')
  registerValidator(@Body() body: RegisterValidatorDto) {
    return this.authService.registerValidator(body);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('google')
  loginWithGoogle(@Body() body: GoogleAuthDto) {
    return this.authService.loginWithGoogle(body.idToken);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('google/register-founder')
  registerFounderWithGoogle(@Body() body: GoogleAuthDto) {
    return this.authService.registerFounderWithGoogle(body.idToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return this.authService.getProfile(req.user.userId);
  }
}
