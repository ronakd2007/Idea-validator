import { Controller, Get, Post, Patch, Delete, Param, Body, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { IpService } from './ip.service';
import { UpsertIpRecordDto, AddIpDocumentDto } from './dto/ip.dto';

// Founder-facing IP registry. Ownership is enforced inside the service (a
// record belonging to someone else raises 404, not 403), and the global
// view-as middleware blocks every write here while an admin is viewing as
// this founder.
@Controller('ip')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FOUNDER')
export class IpController {
  constructor(private ipService: IpService) {}

  @Get()
  list(@Request() req: any) {
    return this.ipService.listForFounder(req.user.userId);
  }

  @Post()
  create(@Body() dto: UpsertIpRecordDto, @Request() req: any) {
    return this.ipService.create(req.user.userId, dto);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @Request() req: any) {
    return this.ipService.getOne(id, req.user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpsertIpRecordDto, @Request() req: any) {
    return this.ipService.update(id, req.user.userId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.ipService.remove(id, req.user.userId);
  }

  @Post(':id/documents')
  addDocument(@Param('id') id: string, @Body() dto: AddIpDocumentDto, @Request() req: any) {
    return this.ipService.addDocument(id, req.user.userId, dto);
  }

  @Delete(':id/documents/:documentId')
  removeDocument(@Param('id') id: string, @Param('documentId') documentId: string, @Request() req: any) {
    return this.ipService.removeDocument(id, documentId, req.user.userId);
  }
}
