import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'NyayaVault Backend API',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('api/v1/health')
  getV1Health() {
    return {
      status: 'ok',
      service: 'NyayaVault Backend API v1',
      timestamp: new Date().toISOString(),
    };
  }
}
