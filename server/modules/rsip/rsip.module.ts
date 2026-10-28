import { Module } from '@nestjs/common';
import { RsipController } from './rsip.controller';
import { RsipService } from './rsip.service';
import { RsipReviewService } from './rsip-review.service';

@Module({
  controllers: [RsipController],
  providers: [RsipService, RsipReviewService],
})
export class RsipModule {}
