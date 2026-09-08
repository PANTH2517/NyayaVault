# NYAYAVAULT — PRODUCTION ENVIRONMENT & SECURITY CONFIGURATION GUIDE

This document details every environment variable required by the **NyayaVault** application, their security classifications, where to obtain them, and how to configure them in **Render (Backend)** and **Vercel (Frontend)**.

---

## 1. ENVIRONMENT VARIABLE INVENTORY & CLASSIFICATION

The table below lists all environment variables declared and consumed in the application codebase.

| Variable Name | Target Service | Required? | Default Value | Description / Purpose | Where to Obtain | Sensitive Secret? |
| :--- | :--- | :---: | :--- | :--- | :--- | :---: |
| `NODE_ENV` | Render Backend | **Yes** | `production` | Enables production mode, secure cookies, and strict error handling | Set manually to `production` | **NO** |
| `PORT` | Render Backend | **Yes** | `10000` | Port for NestJS HTTP server | Assigned automatically by Render | **NO** |
| `FRONTEND_URL` | Render Backend | **Yes** | — | Allowed origin for strict CORS validation (e.g. `https://nyayavault.vercel.app`) | Vercel Deployment Domain | **NO** |
| `DATABASE_URL` | Render Backend | **Yes** | — | Supabase PostgreSQL Transaction Pooler connection URL (Port 6543) | Supabase Dashboard $\rightarrow$ Settings $\rightarrow$ Database | **YES** |
| `DIRECT_URL` | Render Backend | **Yes** | — | Supabase PostgreSQL Direct connection URL (Port 5432) for Prisma migrations | Supabase Dashboard $\rightarrow$ Settings $\rightarrow$ Database | **YES** |
| `JWT_SECRET` | Render Backend | **Yes** | — | Cryptographic secret for signing access JWTs | Generated locally (`openssl rand -base64 48`) | **YES** |
| `JWT_EXPIRATION` | Render Backend | No | `15m` | Access token lifespan | Configured in backend settings | **NO** |
| `REFRESH_TOKEN_SECRET` | Render Backend | **Yes** | — | Cryptographic secret for signing refresh tokens | Generated locally (`openssl rand -base64 48`) | **YES** |
| `REFRESH_TOKEN_EXPIRATION` | Render Backend | No | `7d` | Refresh token lifespan | Configured in backend settings | **NO** |
| `COOKIE_SAME_SITE` | Render Backend | No | `lax` | Refresh token cookie SameSite attribute (`lax`, `strict`, `none`) | Configured in backend settings | **NO** |
| `SUPABASE_URL` | Render Backend | **Yes** | — | Supabase Project API URL (e.g. `https://xxx.supabase.co`) | Supabase Dashboard $\rightarrow$ Settings $\rightarrow$ API | **NO** |
| `SUPABASE_KEY` | Render Backend | **Yes** | — | Supabase Service-Role Secret Key for private storage access | Supabase Dashboard $\rightarrow$ Settings $\rightarrow$ API | **YES** |
| `SUPABASE_STORAGE_BUCKET` | Render Backend | No | `nyayavault-documents` | Private storage bucket name for cryptographic evidence files | Supabase Storage Dashboard | **NO** |
| `SMTP_HOST` | Render Backend | **Yes** (Prod Email) | — | Transactional SMTP server hostname | Email Delivery Provider | **NO** |
| `SMTP_PORT` | Render Backend | **Yes** (Prod Email) | `587` | Transactional SMTP server port | Email Delivery Provider | **NO** |
| `SMTP_USER` | Render Backend | **Yes** (Prod Email) | — | SMTP authentication username | Email Delivery Provider | **YES** |
| `SMTP_PASS` | Render Backend | **Yes** (Prod Email) | — | SMTP authentication password / API key | Email Delivery Provider | **YES** |
| `SMTP_FROM` | Render Backend | No | `"NyayaVault Security" <no-reply@nyayavault.gov.in>` | Sender email header display format | Configured in backend settings | **NO** |
| `TAMPER_SIMULATION_ENABLED` | Render Backend | **Yes** | `false` | Hackathon demo tamper endpoint flag. Must be `false` in production | Set manually to `false` | **NO** |
| `VITE_API_BASE_URL` | Vercel Frontend | **Yes** | — | Deployed Render backend API URL (e.g. `https://nyayavault-backend.onrender.com/api/v1`) | Render Service URL | **NO** |

---

## 2. GENERATING STRONG PRODUCTION SECRETS

Production secrets MUST be unique, cryptographically random strings.

To generate secrets locally on Linux, macOS, or Windows (Git Bash/PowerShell), run:

```bash
# Generate unique 256-bit secret for JWT_SECRET
openssl rand -base64 48

# Generate a SEPARATE unique 256-bit secret for REFRESH_TOKEN_SECRET
openssl rand -base64 48
```

> [!WARNING]
> Do NOT use development passwords or hardcoded test keys. `JWT_SECRET` and `REFRESH_TOKEN_SECRET` must be completely different.

---

## 3. SMTP PROVIDER CONFIGURATION (EMAIL DELIVERY)

NyayaVault includes secure password reset functionality. In production, password reset links are delivered via email using SMTP.

### Provider Options
You can choose any standard SMTP service provider:
- **Transactional Email Services**: SendGrid, Postmark, AWS SES, Mailgun, Brevo.
- **Mail Server SMTP**: Dedicated company mail servers or standard SMTP endpoints.

### SMTP Required Fields
When configuring your chosen SMTP provider in Render:
- `SMTP_HOST`: Hostname provided by your email service (e.g. `smtp.sendgrid.net`, `smtp.postmarkapp.com`, `email-smtp.us-east-1.amazonaws.com`).
- `SMTP_PORT`: Connection port (`587` for STARTTLS or `465` for TLS).
- `SMTP_USER`: Sender username or API Key ID.
- `SMTP_PASS`: Sender password or API secret key.
- `SMTP_FROM`: Formatted sender header (e.g. `"NyayaVault Security" <no-reply@yourdomain.com>`).

> [!IMPORTANT]
> If SMTP credentials are omitted in production, password reset requests will fail closed and log an error to server logs without leaking reset tokens to clients or unencrypted channels.

---

## 4. RENDER (BACKEND) ENVIRONMENT VARIABLES COPY/PASTE GUIDE

Enter these variables under **Render Dashboard** $\rightarrow$ **nyayavault-backend** $\rightarrow$ **Environment**:

### Non-Secret / Public Settings
```text
NODE_ENV=production
PORT=10000
FRONTEND_URL=https://nyayavault.vercel.app
JWT_EXPIRATION=15m
REFRESH_TOKEN_EXPIRATION=7d
COOKIE_SAME_SITE=lax
SUPABASE_URL=https://<YOUR_SUPABASE_PROJECT_ID>.supabase.co
SUPABASE_STORAGE_BUCKET=nyayavault-documents
SMTP_HOST=smtp.<YOUR_EMAIL_PROVIDER>.com
SMTP_PORT=587
SMTP_FROM="NyayaVault Security" <no-reply@yourdomain.com>
TAMPER_SIMULATION_ENABLED=false
```

### Sensitive / Secret Credentials
```text
DATABASE_URL=postgres://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgres://postgres.<PROJECT_REF>:<PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres
JWT_SECRET=<YOUR_GENERATED_OPENSSL_JWT_SECRET>
REFRESH_TOKEN_SECRET=<YOUR_GENERATED_OPENSSL_REFRESH_SECRET>
SUPABASE_KEY=<YOUR_SUPABASE_SERVICE_ROLE_KEY>
SMTP_USER=<YOUR_SMTP_USERNAME>
SMTP_PASS=<YOUR_SMTP_PASSWORD_OR_API_KEY>
```

---

## 5. VERCEL (FRONTEND) ENVIRONMENT VARIABLES GUIDE

Enter this single environment variable under **Vercel Dashboard** $\rightarrow$ **nyayavault-frontend** $\rightarrow$ **Settings** $\rightarrow$ **Environment Variables**:

```text
VITE_API_BASE_URL=https://nyayavault-backend.onrender.com/api/v1
```

> [!CAUTION]
> **DO NOT** add `DATABASE_URL`, `JWT_SECRET`, `SUPABASE_KEY`, or `SMTP_PASS` to Vercel. Frontend bundles are downloaded into user browsers. Adding backend secrets to Vercel exposes them publicly.

---

## 6. GIT SECURITY AUDIT

The root `.gitignore` file enforces that local `.env` files containing real secrets are never committed:

```gitignore
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
```

Only non-sensitive template files (`.env.production.example` and `DEPLOYMENT_ENV_GUIDE.md`) are tracked in source control.
