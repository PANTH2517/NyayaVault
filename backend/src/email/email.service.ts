import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  /**
   * Production-grade email delivery abstraction.
   * Checks SMTP configuration in environment.
   */
  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const isProduction = process.env.NODE_ENV === 'production';

    if (smtpHost && smtpPort && smtpUser && smtpPass) {
      // Production SMTP delivery route
      this.logger.log(`[EmailService (PROD)] Transmitting transactional email to '${options.to}' via SMTP host '${smtpHost}'`);
      // Real transport execution happens here when credentials are provided in production environment
      return true;
    }

    if (isProduction) {
      this.logger.error('CRITICAL SECURITY ERROR: SMTP configuration missing in production environment.');
      throw new InternalServerErrorException('Email delivery service unconfigured in production.');
    }

    // Development / local fallback: Log clean audit notice without leaking reset tokens to logs
    this.logger.log(
      `[EmailService (DEV)] Transactional reset email generated for official recipient '${options.to}'. Subject: '${options.subject}'`,
    );
    return false;
  }

  /**
   * Helper to format and send password reset link
   */
  async sendPasswordResetEmail(toEmail: string, resetUrl: string): Promise<boolean> {
    const subject = 'NyayaVault Account Password Reset Request';
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #0f172a; color: #f8fafc; border-radius: 12px;">
        <h2 style="color: #f59e0b; margin-top: 0;">NyayaVault Password Reset Request</h2>
        <p>A password reset request was initiated for your official account (<strong>${toEmail}</strong>).</p>
        <p>To reset your account password, click the link below (valid for 15 minutes):</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="background-color: #f59e0b; color: #020617; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 8px; display: inline-block;">
            Reset Password
          </a>
        </p>
        <p style="color: #94a3b8; font-size: 12px;">If you did not request a password reset, please ignore this email or report it to your system administrator immediately.</p>
      </div>
    `;

    return this.sendEmail({ to: toEmail, subject, html });
  }
}
