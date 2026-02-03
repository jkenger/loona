# Loona

A focused loan management tool for lenders in the Philippines.

## What is Loona?

Loona helps lenders track loans, manage borrowers, record payments, and monitor their lending portfolio. It's designed for simplicity and mobile-first usage.

**Key Features:**

- **Loan Management** - Create loans with automatic payment schedule generation
- **Payment Tracking** - Record payments, track overdue items, partial payment support
- **Agent System** - Delegate collection to agents with commission tracking
- **Dashboard** - Cashflow calendar, 30/60/90 day forecast, summary metrics
- **Mobile-First** - Responsive design optimized for phone usage

## Why Loona? (From Kapita)

Loona is a clean-slate rebuild of [Kapita](https://github.com/anthropics/kapita), our original loan management platform. We rebuilt it because:

### Kapita's Complexity

| Problem                  | Kapita                                   | Loona                   |
| ------------------------ | ---------------------------------------- | ----------------------- |
| **Too many tables**      | 15+ database tables                      | 7 focused tables        |
| **Dual loan systems**    | `loan_proposals` + `active_loans`        | Single `loans` table    |
| **Borrowers as users**   | Complex `user_profiles` (50+ fields)     | Simple `contacts` table |
| **Multi-lender loans**   | `loan_participations` for syndication    | One lender per loan     |
| **Dual payment systems** | Bucket + Individual schedules            | Single schedule system  |
| **Feature creep**        | Loan packages, contracts, signing tokens | Core features only      |

### What We Learned

1. **Borrowers might not need accounts** - They're contacts, not users. Lenders own the data.
2. **One lender per loan is enough** - Multi-lender syndication added complexity we didn't use.
3. **Simpler schedules work** - Individual payment items are easier to understand than buckets.
4. **Mobile matters most** - 80% of usage is on phones. Desktop is secondary.

### Architecture Improvements

| Kapita                  | Loona                                |
| ----------------------- | ------------------------------------ |
| Next.js 15 (App Router) | TanStack Start                       |
| Server Actions          | Server Functions (RPC-style)         |
| Complex role system     | 3 simple roles: lender, agent, admin |
| Multiple auth flows     | Better Auth with email/password      |

## Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router)
- **Database**: PostgreSQL ([Neon](https://neon.tech) serverless)
- **ORM**: [Drizzle](https://orm.drizzle.team)
- **Auth**: [Better Auth](https://better-auth.com)
- **UI**: [shadcn/ui](https://ui.shadcn.com) + [Tailwind CSS v4](https://tailwindcss.com)
- **Notifications**: [Sonner](https://sonner.emilkowal.ski)

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (or [Neon](https://neon.tech) account)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/loona.git
cd loona

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database URL and auth secret

# Push database schema
npx drizzle-kit push

# Start development server
npm run dev
```

### Environment Variables

```env
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:password@host/database

# Better Auth
BETTER_AUTH_SECRET=your-secret-key-at-least-32-characters
BETTER_AUTH_URL=http://localhost:3000
```

## Scripts

```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Build for production
npm run preview      # Preview production build

npm run db:push      # Push schema to database
npm run db:studio    # Open Drizzle Studio (database GUI)
npm run db:seed      # Seed database with test data
```

## Project Structure

```
loona/
├── src/
│   ├── routes/           # TanStack Router pages
│   │   ├── _dashboard/   # Authenticated pages
│   │   └── _auth/        # Login, signup
│   ├── components/       # React components
│   │   ├── ui/           # shadcn/ui components
│   │   └── ...           # Feature components
│   ├── server/           # Server functions
│   ├── lib/
│   │   ├── db/           # Drizzle schema & client
│   │   └── ...           # Utilities
│   └── styles/           # Global styles
├── app.config.ts         # TanStack Start config
├── drizzle.config.ts     # Drizzle config
└── package.json
```

## Deployment

Loona is configured for **Vercel** deployment:

1. Push to GitHub
2. Import project in Vercel
3. Set environment variables
4. Deploy

See [Vercel documentation](https://vercel.com/docs) for details.

## License

Private project. All rights reserved.
# loona
# loona
# loona
# loona
