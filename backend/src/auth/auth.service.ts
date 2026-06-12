import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async sendOtp(phone: string): Promise<{ otp: string }> {
    // Invalidate previous unused OTPs for this phone
    await this.prisma.otpVerification.updateMany({
      where: { phone, isUsed: false },
      data: { isUsed: true },
    });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.otpVerification.create({ data: { phone, otp, expiresAt } });

    // In production: send via SMS gateway. For local test mode, return OTP directly.
    return { otp };
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
    return {
      message: 'Registration successful. Your profile is pending admin approval.',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { validatorProfile: true },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (!user.isActive) throw new UnauthorizedException('Account is deactivated');

    if (user.role === 'VALIDATOR' && user.validatorProfile && !user.validatorProfile.isApproved) {
      throw new UnauthorizedException('Your validator profile is pending admin approval');
    }

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
