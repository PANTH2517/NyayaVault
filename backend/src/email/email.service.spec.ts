import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { EmailService } from './email.service';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

describe('EmailService', () => {
  let service: EmailService;
  let mockSendMail: jest.Mock;

  const originalEnv = process.env;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };

    mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-message-id' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: mockSendMail,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('A. SMTP configured', () => {
    it('should create transport and invoke sendMail with correct parameters', async () => {
      process.env.SMTP_HOST = 'smtp.resend.com';
      process.env.SMTP_PORT = '465';
      process.env.SMTP_USER = 'resend';
      process.env.SMTP_PASS = 'secret_smtp_password_123';
      process.env.SMTP_FROM = 'onboarding@resend.dev';

      const result = await service.sendEmail({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Test Body</p>',
      });

      expect(result).toBe(true);
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.resend.com',
        port: 465,
        secure: true,
        auth: {
          user: 'resend',
          pass: 'secret_smtp_password_123',
        },
      });
      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'onboarding@resend.dev',
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Test Body</p>',
        text: undefined,
      });
    });

    it('should use secure=false for non-465 ports e.g. 587', async () => {
      process.env.SMTP_HOST = 'smtp.resend.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USER = 'resend';
      process.env.SMTP_PASS = 'secret_smtp_password_123';

      await service.sendEmail({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Test Body</p>',
      });

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 587,
          secure: false,
        }),
      );
    });
  });

  describe('B. SMTP missing in production', () => {
    it('should fail safely throwing InternalServerErrorException in production', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      await expect(
        service.sendEmail({
          to: 'user@example.com',
          subject: 'Test Subject',
          html: '<p>Test Body</p>',
        }),
      ).rejects.toThrow(InternalServerErrorException);

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should return false cleanly in dev when SMTP is unconfigured', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.SMTP_HOST;

      const result = await service.sendEmail({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Test Body</p>',
      });

      expect(result).toBe(false);
      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });

  describe('C. SMTP send failure', () => {
    it('should catch sendMail failure and throw safe InternalServerErrorException', async () => {
      process.env.SMTP_HOST = 'smtp.resend.com';
      process.env.SMTP_PORT = '465';
      process.env.SMTP_USER = 'resend';
      process.env.SMTP_PASS = 'secret_smtp_password_123';

      mockSendMail.mockRejectedValueOnce(new Error('Connection timeout to smtp.resend.com'));

      await expect(
        service.sendEmail({
          to: 'user@example.com',
          subject: 'Test Subject',
          html: '<p>Test Body</p>',
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('D. No sensitive logging', () => {
    it('should never include reset tokens or full reset URLs in logger outputs', async () => {
      const loggerSpy = jest.spyOn((service as any).logger, 'log');
      const errorSpy = jest.spyOn((service as any).logger, 'error');

      process.env.SMTP_HOST = 'smtp.resend.com';
      process.env.SMTP_PORT = '465';
      process.env.SMTP_USER = 'resend';
      process.env.SMTP_PASS = 'secret_smtp_password_123';

      const rawToken = 'secret_raw_reset_token_12345';
      const resetUrl = `https://nyayavault.vercel.app/reset-password?token=${rawToken}`;

      await service.sendPasswordResetEmail('officer@nyayavault.gov.in', resetUrl);

      // Verify logger calls
      const logCalls = loggerSpy.mock.calls.map((c) => c[0]).join(' ');
      const errorCalls = errorSpy.mock.calls.map((c) => c[0]).join(' ');
      const allLogs = `${logCalls} ${errorCalls}`;

      expect(allLogs).not.toContain(rawToken);
      expect(allLogs).not.toContain('secret_smtp_password_123');
      expect(allLogs).not.toContain('reset-password?token=');
    });
  });
});
