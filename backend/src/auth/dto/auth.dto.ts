import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsEmail, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength,
} from 'class-validator';

export class SendOtpDto {
  @IsString() @MinLength(7) @MaxLength(20) @Matches(/^[+\d][\d\s\-()]*$/, { message: 'Invalid phone number' })
  phone: string;
}

export class RegisterFounderDto {
  @IsString() @MinLength(2) @MaxLength(100) name: string;
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @MinLength(8) @MaxLength(72) password: string;
  @IsString() @MinLength(7) @MaxLength(20) phone: string;
  @IsString() @MinLength(4) @MaxLength(8) otp: string;
}

export class RegisterValidatorDto extends RegisterFounderDto {
  @IsString() @MinLength(2) @MaxLength(120) occupation: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(60) yearsOfExperience: number;
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(80, { each: true })
  areasOfExpertise: string[];
  @IsString() @MaxLength(300) linkedinUrl: string;
  @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(40, { each: true })
  contactPreferences: string[];
}

export class LoginDto {
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @MinLength(1) @MaxLength(72) password: string;
}

export class GoogleAuthDto {
  @IsString() @MaxLength(4096) idToken: string;
}

export class UpdateValidatorProfileDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) occupation?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(60) yearsOfExperience?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(80, { each: true })
  areasOfExpertise?: string[];
  @IsOptional() @IsString() @MaxLength(300) linkedinUrl?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(40, { each: true })
  contactPreferences?: string[];
}
