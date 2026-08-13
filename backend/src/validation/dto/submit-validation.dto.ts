import { Type } from 'class-transformer';
import {
  IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';

// Every 1-10 score the validator form submits is clamped here so a hand-crafted
// request can never push an out-of-range number into the founder's aggregates.
// The global ValidationPipe runs with whitelist: true, so any field not
// declared on these classes is silently stripped before it reaches Prisma.

export class MarketOpportunityDto {
  @IsInt() @Min(1) @Max(10) problemSeverity: number;
  @IsInt() @Min(1) @Max(10) marketSize: number;
  @IsInt() @Min(1) @Max(10) willingnessToPay: number;
  @IsInt() @Min(1) @Max(10) marketGrowthRate: number;
  @IsInt() @Min(1) @Max(10) competitionGap: number;
}

export class FeasibilityDto {
  @IsInt() @Min(1) @Max(10) technicalComplexity: number;
  @IsInt() @Min(1) @Max(10) capitalRequirement: number;
  @IsInt() @Min(1) @Max(10) regulatoryDifficulty: number;
  @IsInt() @Min(1) @Max(10) talentAvailability: number;
  @IsInt() @Min(1) @Max(10) timeToLaunch: number;
}

export class FounderFitDto {
  @IsInt() @Min(1) @Max(10) industryKnowledge: number;
  @IsInt() @Min(1) @Max(10) relevantExperience: number;
  @IsInt() @Min(1) @Max(10) networkAccess: number;
  @IsInt() @Min(1) @Max(10) passion: number;
  @IsInt() @Min(1) @Max(10) skillAlignment: number;
}

export class RevenuePotentialDto {
  @IsInt() @Min(1) @Max(10) pricingPower: number;
  @IsInt() @Min(1) @Max(10) recurringRevenuePotential: number;
  @IsInt() @Min(1) @Max(10) profitMarginPotential: number;
  @IsInt() @Min(1) @Max(10) upsellOpportunities: number;
  @IsInt() @Min(1) @Max(10) customerLifetimeValue: number;
}

export class ScalabilityDto {
  @IsInt() @Min(1) @Max(10) geographicExpansion: number;
  @IsInt() @Min(1) @Max(10) automationPotential: number;
  @IsInt() @Min(1) @Max(10) operationalComplexity: number;
  @IsInt() @Min(1) @Max(10) dependenceOnFounder: number;
  @IsInt() @Min(1) @Max(10) networkEffects: number;
}

const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'];

export class RiskAssessmentDto {
  @IsIn(RISK_LEVELS) competitionProbability: string;
  @IsIn(RISK_LEVELS) competitionImpact: string;
  @IsIn(RISK_LEVELS) regulatoryProbability: string;
  @IsIn(RISK_LEVELS) regulatoryImpact: string;
  @IsIn(RISK_LEVELS) technologyProbability: string;
  @IsIn(RISK_LEVELS) technologyImpact: string;
  @IsIn(RISK_LEVELS) fundingProbability: string;
  @IsIn(RISK_LEVELS) fundingImpact: string;
  @IsIn(RISK_LEVELS) marketAdoptionProbability: string;
  @IsIn(RISK_LEVELS) marketAdoptionImpact: string;
}

export class InvestorAttractivenessDto {
  @IsInt() @Min(1) @Max(10) marketSize: number;
  @IsInt() @Min(1) @Max(10) growthPotential: number;
  @IsInt() @Min(1) @Max(10) scalability: number;
  @IsInt() @Min(1) @Max(10) exitPotential: number;
  @IsInt() @Min(1) @Max(10) defensibility: number;
}

export class InnovationDto {
  @IsInt() @Min(1) @Max(10) uniqueness: number;
  @IsInt() @Min(1) @Max(10) patentability: number;
  @IsInt() @Min(1) @Max(10) competitiveAdvantage: number;
  @IsInt() @Min(1) @Max(10) disruptionPotential: number;
  @IsInt() @Min(1) @Max(10) defensibility: number;
}

export class SocialImpactDto {
  @IsInt() @Min(1) @Max(10) jobCreation: number;
  @IsInt() @Min(1) @Max(10) environmentalBenefit: number;
  @IsInt() @Min(1) @Max(10) communityBenefit: number;
  @IsInt() @Min(1) @Max(10) inclusion: number;
  @IsInt() @Min(1) @Max(10) sustainability: number;
}

export class CustomerValidationDto {
  @IsBoolean() wouldUse: boolean;
  @IsBoolean() wouldPay: boolean;
  @IsBoolean() wouldRecommend: boolean;
  @IsBoolean() solvesRealProblem: boolean;
  @IsBoolean() betterThanAlternatives: boolean;
}

export class SharkTankDto {
  @IsInt() @Min(1) @Max(10) problemImportance: number;
  @IsInt() @Min(1) @Max(10) marketSize: number;
  @IsInt() @Min(1) @Max(10) revenuePotential: number;
  @IsInt() @Min(1) @Max(10) executionEase: number;
  @IsInt() @Min(1) @Max(10) scalability: number;
}

export class StartupSuccessDto {
  @IsInt() @Min(1) @Max(10) founderTeam: number;
  @IsInt() @Min(1) @Max(10) marketSize: number;
  @IsInt() @Min(1) @Max(10) productDifferentiation: number;
  @IsInt() @Min(1) @Max(10) traction: number;
  @IsInt() @Min(1) @Max(10) businessModel: number;
  @IsInt() @Min(1) @Max(10) competition: number;
  @IsInt() @Min(1) @Max(10) timing: number;
  @IsInt() @Min(1) @Max(10) fundingReadiness: number;
}

export class OpenFeedbackDto {
  @IsString() @MaxLength(2000) biggestStrength: string;
  @IsString() @MaxLength(2000) biggestWeakness: string;
  @IsString() @MaxLength(2000) suggestedImprovement: string;
}

export class SubmitValidationDto {
  @IsOptional() @ValidateNested() @Type(() => MarketOpportunityDto) marketOpportunity?: MarketOpportunityDto;
  @IsOptional() @ValidateNested() @Type(() => FeasibilityDto) feasibility?: FeasibilityDto;
  @IsOptional() @ValidateNested() @Type(() => FounderFitDto) founderFit?: FounderFitDto;
  @IsOptional() @ValidateNested() @Type(() => RevenuePotentialDto) revenuePotential?: RevenuePotentialDto;
  @IsOptional() @ValidateNested() @Type(() => ScalabilityDto) scalability?: ScalabilityDto;
  @IsOptional() @ValidateNested() @Type(() => RiskAssessmentDto) riskAssessment?: RiskAssessmentDto;
  @IsOptional() @ValidateNested() @Type(() => InvestorAttractivenessDto) investorAttractiveness?: InvestorAttractivenessDto;
  @IsOptional() @ValidateNested() @Type(() => InnovationDto) innovation?: InnovationDto;
  @IsOptional() @ValidateNested() @Type(() => SocialImpactDto) socialImpact?: SocialImpactDto;
  @IsOptional() @ValidateNested() @Type(() => CustomerValidationDto) customerValidation?: CustomerValidationDto;
  @IsOptional() @ValidateNested() @Type(() => SharkTankDto) sharkTank?: SharkTankDto;
  @IsOptional() @ValidateNested() @Type(() => StartupSuccessDto) startupSuccess?: StartupSuccessDto;
  @IsOptional() @ValidateNested() @Type(() => OpenFeedbackDto) openFeedback?: OpenFeedbackDto;
}
