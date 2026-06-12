import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getValidatorProfile(userId: string) {
    return this.prisma.validatorProfile.findUnique({
      where: { userId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async updateValidatorProfile(userId: string, data: any) {
    const update: any = {};
    if (data.occupation) update.occupation = data.occupation;
    if (data.yearsOfExperience) update.yearsOfExperience = Number(data.yearsOfExperience);
    if (data.areasOfExpertise) update.areasOfExpertise = Array.isArray(data.areasOfExpertise)
      ? data.areasOfExpertise.join(',') : data.areasOfExpertise;
    if (data.linkedinUrl) update.linkedinUrl = data.linkedinUrl;
    if (data.contactPreferences) update.contactPreferences = JSON.stringify(data.contactPreferences);

    return this.prisma.validatorProfile.update({ where: { userId }, data: update });
  }
}
