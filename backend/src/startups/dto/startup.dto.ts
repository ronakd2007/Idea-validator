import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';

export const LOOKING_FOR_OPTIONS = ['FUNDING', 'CUSTOMERS', 'MENTORS', 'PARTNERSHIPS', 'EMPLOYEES', 'OTHER'];
export const STARTUP_STAGES = ['IDEA', 'RESEARCH', 'PROTOTYPE', 'MVP', 'REVENUE_GENERATING'];
export const STARTUP_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED'];

export class StartupTeamMemberDto {
  @IsString() @MaxLength(100) name: string;
  @IsOptional() @IsString() @MaxLength(300) linkedinUrl?: string;
}

// Founder-controlled publication of validation aggregates. Every key defaults
// to false: a founder opts in to showing numbers, never out.
export class ValidationDisplayDto {
  @IsOptional() @IsBoolean() showScore?: boolean;
  @IsOptional() @IsBoolean() showValidatorCount?: boolean;
  @IsOptional() @IsBoolean() showCustomerValidation?: boolean;
}

// The global ValidationPipe runs with whitelist:true, so anything not declared
// here (status, slug, adminNote…) is stripped before it can reach Prisma —
// a founder can never set their own approval status from this payload.
export class UpsertStartupDto {
  @IsString() @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(200) tagline?: string;
  @IsOptional() @IsString() @MaxLength(4000) about?: string;
  @IsOptional() @IsString() @MaxLength(4000) problem?: string;
  @IsOptional() @IsString() @MaxLength(4000) solution?: string;
  @IsOptional() @IsString() @MaxLength(4000) product?: string;
  @IsOptional() @IsString() @MaxLength(4000) traction?: string;
  @IsOptional() @IsString() @MaxLength(80) industry?: string;
  @IsOptional() @IsString() @MaxLength(120) location?: string;
  @IsOptional() @IsInt() @Min(1900) @Max(2100) foundedYear?: number;
  @IsOptional() @IsString() @MaxLength(300) website?: string;
  @IsOptional() @IsString() @MaxLength(300) linkedinUrl?: string;
  @IsOptional() @IsIn(STARTUP_STAGES) stage?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => StartupTeamMemberDto)
  teamMembers?: StartupTeamMemberDto[];

  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsIn(LOOKING_FOR_OPTIONS, { each: true })
  lookingFor?: string[];

  @IsOptional() @ValidateNested() @Type(() => ValidationDisplayDto)
  validationDisplay?: ValidationDisplayDto;

  // false/absent = Save Draft, true = submit for admin review.
  @IsOptional() @IsBoolean() submit?: boolean;
}

export class ReviewStartupDto {
  @IsIn(['APPROVE', 'REQUEST_CHANGES', 'REJECT']) action: string;
  // Shown to the founder — required for REQUEST_CHANGES so they know what to fix.
  @IsOptional() @IsString() @MaxLength(2000) reviewMessage?: string;
  // Never leaves an ADMIN-guarded route.
  @IsOptional() @IsString() @MaxLength(2000) adminNote?: string;
}
