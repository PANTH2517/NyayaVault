import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const frontendUrlEnv = process.env.FRONTEND_URL;
  const allowedOrigins = frontendUrlEnv
    ? frontendUrlEnv.split(',').map((o) => o.trim())
    : ['http://localhost:5173', 'http://127.0.0.1:5173'];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy blocked access from origin '${origin}'`));
      }
    },
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`NyayaVault Backend running on port ${port}`);
}
bootstrap();
