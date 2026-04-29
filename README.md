# Simple Vocab App

Simple Vocab App is a Next.js app with MongoDB + NextAuth credentials login.

## Prerequisites

- Node.js 18+
- MongoDB running locally

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` in the project root and add:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/simplevocab
NEXTAUTH_SECRET=replace_with_a_long_random_secret
```

3. Start MongoDB (if it is not running).

4. Run the app:

```bash
npm run dev
```

5. Open `http://localhost:3000`

## Authentication Flow

- Sign up at `/signup`
- Sign in at `/login` with username or email + password

## Scripts

- `npm run dev` - start development server
- `npm run build` - build production app
- `npm run start` - run production server
- `npm run lint` - run lint checks
