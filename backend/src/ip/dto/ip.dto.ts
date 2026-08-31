import {
  ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsOptional, IsString, MaxLength,
} from 'class-validator';
import {
  IP_TYPES, IP_STATUSES, IP_DOCUMENT_TYPES, INDIAN_STATES,
} from '../ip.constants';

/**
 * The global ValidationPipe runs with whitelist:true, so anything not declared
 * here is stripped before it reaches Prisma. That is what stops a founder from
 * setting their own `reviewStatus`, `adminNote` or `reviewedAt` from this
 * payload — those fields are deliberately absent below.
 *
 * `visibility` IS founder-controlled and so IS declared: ticking "make public"
 * only ever moves the record into the review queue, it never publishes it.
 */
export class PublicFieldsDto {
  @IsOptional() @IsBoolean() showApplicationNumber?: boolean;
  @IsOptional() @IsBoolean() showFilingDate?: boolean;
  @IsOptional() @IsBoolean() showPublicUrl?: boolean;
  @IsOptional() @IsBoolean() showInstitution?: boolean;
}

export class UpsertIpRecordDto {
  // Only title and type are required. Everything else is something a founder
  // may legitimately not have yet — the form must not block on it.
  @IsString() @MaxLength(200) title: string;
  @IsIn(IP_TYPES as unknown as string[]) type: string;

  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsString() @MaxLength(60) ideaId?: string;
  @IsOptional() @IsIn(IP_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsString() @MaxLength(120) applicationNumber?: string;
  @IsOptional() @IsDateString() filingDate?: string;
  @IsOptional() @IsString() @MaxLength(80) jurisdiction?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(120, { each: true })
  inventorNames?: string[];
  @IsOptional() @IsString() @MaxLength(160) ownerName?: string;
  @IsOptional() @IsString() @MaxLength(160) authority?: string;
  @IsOptional() @IsString() @MaxLength(400) publicUrl?: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;

  // Location. `state` is constrained to the dropdown so the ecosystem
  // analytics stay countable; city and institution are free text.
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsIn(INDIAN_STATES as unknown as string[]) state?: string;
  @IsOptional() @IsString() @MaxLength(200) institution?: string;

  @IsOptional() @IsBoolean() makePublic?: boolean;
  @IsOptional() publicFields?: PublicFieldsDto;
}

export class AddIpDocumentDto {
  @IsString() @MaxLength(600) fileUrl: string;
  @IsString() @MaxLength(200) fileName: string;
  @IsOptional() @IsIn(IP_DOCUMENT_TYPES as unknown as string[]) documentType?: string;
}

/** Admin-only. Mirrors ReviewStartupDto so both review queues behave alike. */
export class ReviewIpRecordDto {
  @IsIn(['APPROVE', 'REJECT', 'REQUEST_CHANGES']) action: string;
  @IsOptional() @IsString() @MaxLength(1000) reviewMessage?: string;
  @IsOptional() @IsString() @MaxLength(2000) adminNote?: string;
}
