# User Authentication Setup

Your Simple Vocab app now has user login and MongoDB integration! Here's how to get started:

## Prerequisites

1. **MongoDB**: You need to have MongoDB running locally
   - Download from: https://www.mongodb.com/try/download/community
   - Default connection: `mongodb://localhost:27017/simplevocab`
   - Or install via package manager (e.g., `brew install mongodb-community`)

2. **Environment Variables**: Already configured in `.env.local`

## Starting Your App

```bash
npm run dev
```

Visit `http://localhost:3000` to see your app running.

## Features Implemented

### ✅ User Registration (Signup)
- Route: `/signup`
- Fields: Username, Email, Password, Confirm Password
- Password validation: Minimum 6 characters
- Duplicate check: Prevents duplicate usernames and emails
- Password hashing: Uses bcryptjs for security

### ✅ User Login
- Route: `/login`
- Credentials: Username or Email + Password
- Session management: 30-day session duration
- Automatic password verification

### ✅ Authentication
- NextAuth.js configuration
- Credentials provider (username/email + password)
- JWT-based sessions
- Protected API routes ready to implement

### ✅ MongoDB Integration
- Mongoose ODM for database operations
- User model with username, email, password
- Automatic password hashing on save
- Password comparison method for validation

## API Endpoints

### POST `/api/auth/signup`
Create a new user account.

**Request body:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "password123",
  "confirmPassword": "password123"
}
```

### POST `/api/auth/[...nextauth]`
NextAuth.js endpoint for sign-in, session management, etc.

## Next Steps

1. **Start MongoDB**: Make sure MongoDB is running
   ```bash
   # On macOS:
   brew services start mongodb-community
   
   # On Windows (if installed):
   net start MongoDB
   
   # Or run directly:
   mongod
   ```

2. **Generate a Secure Secret**:
   ```bash
   openssl rand -base64 32
   ```
   Update the `NEXTAUTH_SECRET` in `.env.local` with this value (for production).

3. **Test the App**:
   - Go to `/signup` and create an account
   - Go to `/login` and sign in
   - Check home page to see authenticated user info

4. **Add Protected Pages**:
   Create new pages that require authentication:
   ```typescript
   'use client';
   import { useSession, redirect } from 'next-auth/react';
   
   export default function ProtectedPage() {
     const { data: session } = useSession();
     
     if (!session) {
       redirect('/login');
     }
     
     return <div>Protected content here</div>;
   }
   ```

## Environment Variables Explained

- `MONGODB_URI`: Connection string for your MongoDB instance
- `NEXTAUTH_URL`: Your app's base URL (localhost:3000 for development)
- `NEXTAUTH_SECRET`: Secret key for encryption (change in production!)

## Security Notes

- Passwords are hashed with bcryptjs before storage
- Change `NEXTAUTH_SECRET` for production deployments
- Use HTTPS in production
- Consider adding email verification for signup
- Add rate limiting to prevent brute force attacks
- Set up CORS properly for your domain

## Troubleshooting

**"Can't connect to MongoDB"**:
- Ensure MongoDB is running (`mongod` command)
- Check connection string in `.env.local`

**"User already exists"**:
- Username or email already registered
- Choose a different username/email

**"Session not persisting"**:
- Check `NEXTAUTH_SECRET` is set in `.env.local`
- Clear browser cookies and try again

## File Structure

```
app/
├── api/auth/
│   ├── [...nextauth]/route.ts    # NextAuth configuration
│   └── signup/route.ts            # User signup endpoint
├── login/page.tsx                 # Login page
├── signup/page.tsx                # Signup page
├── page.tsx                       # Home page (updated with auth UI)
├── layout.tsx                     # Root layout with AuthProvider
└── providers.tsx                  # Session provider wrapper

lib/
├── auth.ts                        # NextAuth configuration
└── db.ts                          # MongoDB connection

models/
└── User.ts                        # Mongoose user model

.env.local                         # Environment variables
```

Happy learning! 🚀
