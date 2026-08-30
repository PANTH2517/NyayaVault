# NyayaVault

NyayaVault is a Secure Digital Document Management System for legal and investigation documents. The project provides secure case-based document management, controlled access, document versioning, SHA-256 integrity verification, a tamper-evident hash-chained audit trail, and security incident detection.

## Architecture & Technology Stack

* **Frontend:** React, Vite, TypeScript, Tailwind CSS, Lucide React
* **Backend:** NestJS, TypeScript, Prisma ORM
* **Database & Storage:** Supabase PostgreSQL & Supabase Storage
* **Authentication & Security:** Argon2 password hashing, JWT Access/Refresh tokens, RBAC, Case-Based Access Control (CBAC), SHA-256 document hashing, hash-chained audit trail

## Repository Structure

```text
NyayaVault/
├── PROJECT_RULES.md          # Core engineering constitution and rules
├── frontend/                 # React + Vite + TypeScript frontend app
├── backend/                  # NestJS + TypeScript backend app
├── README.md                 # Project documentation
└── .gitignore                # Git ignore configuration
```

## Milestone 1 Setup

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Backend Setup

```bash
cd backend
npm install
npm run start:dev
```

### Health Check

Once the backend is running, verify system health at:
`http://localhost:3000/api/v1/health`
