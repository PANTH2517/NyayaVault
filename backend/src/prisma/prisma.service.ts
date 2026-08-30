import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    // Connect to database if DATABASE_URL is set
    if (process.env.DATABASE_URL) {
      try {
        await this.$connect();
      } catch (err) {
        console.warn('PrismaService: Could not connect to database on init (DATABASE_URL may be unconfigured).');
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
