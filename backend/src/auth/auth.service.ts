import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class AuthService {
  private googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  constructor(private prisma: PrismaService, private jwt: JwtService, private activity: ActivityService) {}

  // Fire-and-forget: ActivityService.log never throws, so a failed log can
  // never turn a successful signup or login into an error for the user.
  private logAccount(user: { id: string; name: string; role: string }, action: 'ACCOUNT_SIGNUP' | 'ACCOUNT_LOGIN', method: string) {
    void this.activity.log({
      userId: user.id,
      actorRole: user.role,
      actorLabel: user.name,
      action,
      targetType: 'USER',
      targetId: user.id,
      targetLabel: user.name,
      metadata: { method },
    });
  }

  async sendOtp(phone: string): Promise<{ message: string; otp?: string }> {
    // Invalidate previous unused OTPs for this phone
    await this.prisma.otpVerification.updateMany({
      where: { phone, isUsed: false },
      data: { isUsed: true },
    });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.otpVerification.create({ data: { phone, otp, expiresAt } });

    // No SMS gateway exists yet, so test mode hands the OTP back in the
    // response. In production that means anyone can verify any phone number,
    // so it must be opted into explicitly (set OTP_TEST_MODE=true on Render
    // until an SMS provider is wired up).
    const testMode = process.env.NODE_ENV !== 'production' || process.env.OTP_TEST_MODE === 'true';
    return testMode ? { message: 'OTP generated (test mode)', otp } : { message: 'OTP sent' };
  }

  private async verifyOtp(phone: string, otp: string): Promise<void> {
    const record = await this.prisma.otpVerification.findFirst({
      where: { phone, otp, isUsed: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new BadRequestException('Invalid or expired OTP');
    await this.prisma.otpVerification.update({ where: { id: record.id }, data: { isUsed: true } });
  }

  async registerFounder(data: { name: string; email: string; password: string; phone: string; otp: string }) {
    await this.verifyOtp(data.phone, data.otp);

    const exists = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (exists) throw new ConflictException('Email already registered');

    const hash = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: { name: data.name, email: data.email, password: hash, role: 'FOUNDER', phone: data.phone, phoneVerified: true },
    });
    this.logAccount(user, 'ACCOUNT_SIGNUP', 'PASSWORD');
    return this.signToken(user);
  }

  async registerValidator(data: {
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
  }) {
    if (!data.phone || !data.phone.trim()) throw new BadRequestException('Phone number is required');
    if (!data.linkedinUrl || !data.linkedinUrl.trim()) throw new BadRequestException('LinkedIn profile URL is required');

    await this.verifyOtp(data.phone, data.otp);

    const exists = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (exists) throw new ConflictException('Email already registered');

    const hash = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hash,
        role: 'VALIDATOR',
        phone: data.phone,
        phoneVerified: true,
        validatorProfile: {
          create: {
            occupation: data.occupation,
            yearsOfExperience: data.yearsOfExperience,
            areasOfExpertise: data.areasOfExpertise.join(','),
            linkedinUrl: data.linkedinUrl,
            contactPreferences: JSON.stringify(data.contactPreferences),
          },
        },
      },
    });
    this.logAccount(user, 'ACCOUNT_SIGNUP', 'PASSWORD');
    return {
      message: 'Registration successful. Your profile is pending admin approval.',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  async login(email: string, password: string) {
    if (!email || !password) throw new BadRequestException('Email and password are required');

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { validatorProfile: true },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.password) throw new UnauthorizedException('This account uses Google Sign-In. Please continue with Google.');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (!user.isActive) throw new UnauthorizedException('Account is deactivated');

    if (user.role === 'VALIDATOR' && user.validatorProfile && !user.validatorProfile.isApproved) {
      throw new UnauthorizedException('Your validator profile is pending admin approval');
    }

    this.logAccount(user, 'ACCOUNT_LOGIN', 'PASSWORD');
    return this.signToken(user);
  }

  // Verifies the ID token client-side Google Identity Services handed the
  // frontend — never trusts a client-supplied email/name directly.
  private async verifyGoogleToken(idToken: string): Promise<{ email: string; name: string; googleId: string }> {
    if (!idToken) throw new BadRequestException('Missing Google credential');
    let ticket;
    try {
      ticket = await this.googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    } catch {
      throw new UnauthorizedException('Invalid Google credential');
    }
    const payload = ticket.getPayload();
    if (!payload || !payload.email) throw new UnauthorizedException('Invalid Google credential');
    if (!payload.email_verified) throw new UnauthorizedException('Google account email is not verified');
    return { email: payload.email, name: payload.name || payload.email.split('@')[0], googleId: payload.sub };
  }

  // Used by the login page — logs in an existing account (linking googleId
  // to a matching password account the first time) but never silently
  // creates a new one. A brand-new Google identity is reported back so the
  // frontend can send the person through founder registration instead.
  async loginWithGoogle(idToken: string) {
    const { email, name, googleId } = await this.verifyGoogleToken(idToken);

    let user = await this.prisma.user.findUnique({ where: { googleId }, include: { validatorProfile: true } });
    if (!user) {
      const byEmail = await this.prisma.user.findUnique({ where: { email }, include: { validatorProfile: true } });
      if (byEmail) {
        user = await this.prisma.user.update({ where: { id: byEmail.id }, data: { googleId }, include: { validatorProfile: true } });
      }
    }

    if (!user) return { needsRegistration: true, email, name };

    if (!user.isActive) throw new UnauthorizedException('Account is deactivated');
    if (user.role === 'VALIDATOR' && user.validatorProfile && !user.validatorProfile.isApproved) {
      throw new UnauthorizedException('Your validator profile is pending admin approval');
    }

    this.logAccount(user, 'ACCOUNT_LOGIN', 'GOOGLE');
    return this.signToken(user);
  }

  // Used by the founder registration page — creates a new FOUNDER account
  // with no password and no phone/OTP requirement. If the Google identity
  // already has an account (e.g. they've registered before), this just logs
  // them in instead of erroring, matching how clicking "sign up" when you
  // already have an account should feel.
  async registerFounderWithGoogle(idToken: string) {
    const { email, name, googleId } = await this.verifyGoogleToken(idToken);

    let user = await this.prisma.user.findUnique({ where: { googleId }, include: { validatorProfile: true } });
    if (!user) {
      const byEmail = await this.prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: { googleId },
          include: { validatorProfile: true },
        });
      }
    }

    const isNewAccount = !user;
    if (!user) {
      user = await this.prisma.user.create({
        data: { name, email, googleId, role: 'FOUNDER', phoneVerified: false },
        include: { validatorProfile: true },
      });
    }

    if (!user.isActive) throw new UnauthorizedException('Account is deactivated');
    // This endpoint doubles as sign-in for existing accounts, so it must
    // enforce the same gate as login/loginWithGoogle — otherwise an unapproved
    // validator could collect a valid token through the founder sign-up button.
    if (user.role === 'VALIDATOR' && user.validatorProfile && !user.validatorProfile.isApproved) {
      throw new UnauthorizedException('Your validator profile is pending admin approval');
    }

    // This endpoint doubles as sign-in for people who already registered, so
    // the action recorded depends on whether an account was actually created.
    this.logAccount(user, isNewAccount ? 'ACCOUNT_SIGNUP' : 'ACCOUNT_LOGIN', 'GOOGLE');
    return this.signToken(user);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { validatorProfile: true },
    });
    if (!user) return null;
    const { password, ...rest } = user;
    return rest;
  }

  private signToken(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwt.sign(payload),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }
}
