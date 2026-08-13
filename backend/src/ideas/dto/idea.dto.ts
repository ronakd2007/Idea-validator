import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';

const STAGES = ['IDEA', 'RESEARCH', 'PROTOTYPE', 'MVP', 'REVENUE_GENERATING'];

export class TeamMemberDto {
  @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsString() @MinLength(1) @MaxLength(300) linkedinUrl: string;
}

export class SelfAssessmentDto {
  @IsInt() @Min(1) @Max(10) industryKnowledge: number;
  @IsInt() @Min(1) @Max(10) relevantExperience: number;
  @IsInt() @Min(1) @Max(10) networkAccess: number;
  @IsInt() @Min(1) @Max(10) passion: number;
  @IsInt() @Min(1) @Max(10) skillAlignment: number;
}

// whitelist: true on the global ValidationPipe means fields like version,
// isRevision, paymentStatus or submittedAt sent by a crafted client are
// stripped here instead of reaching the Prisma create via spread.
export class CreateIdeaDto {
  @IsString() @MinLength(2) @MaxLength(200) title: string;
  @IsOptional() @IsString() @MaxLength(500) videoUrl?: string;
  @IsString() @MinLength(2) @MaxLength(80) industryCategory: string;
  @IsString() @MinLength(10) @MaxLength(5000) problemStatement: string;
  @IsString() @MinLength(10) @MaxLength(5000) solutionDescription: string;
  @IsString() @MinLength(2) @MaxLength(2000) targetCustomer: string;
  @IsString() @MinLength(2) @MaxLength(2000) revenueModel: string;
  @IsIn(STAGES) stage: string;
  @IsOptional() @IsString() @MaxLength(3000) founderContext?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(15) @ValidateNested({ each: true }) @Type(() => TeamMemberDto)
  teamMembers?: TeamMemberDto[];
  @IsOptional() @ValidateNested() @Type(() => SelfAssessmentDto)
  selfAssessment?: SelfAssessmentDto;
}
