# Quick Start Guide for Authentication

## 1. Start MongoDB

Before running the app, ensure MongoDB is running on your system:

**Windows (CMD as Administrator):**
```bash
net start MongoDB
```

**macOS (if installed via Homebrew):**
```bash
brew services start mongodb-community
```

**Or run MongoDB directly:**
```bash
mongod
```

The app expects MongoDB at `mongodb://localhost:27017/simplevocab`

## 2. Run the Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

## 3. Create Your First Account

1. Click **"Sign up"** on the home page
2. Enter:
   - Username: `testuser`
   - Email: `test@example.com`
   - Password: `password123`
   - Confirm Password: `password123`
3. Click **"Sign up"** button
4. You'll be redirected to `/login`

## 4. Sign In

1. Enter your username or email
2. Enter your password
3. Click **"Sign in"**

You should be logged in and see your username displayed!

## Features Implemented

✅ **User Registration**
- Unique username and email validation
- Password hashing with bcryptjs
- 6+ character password requirement

✅ **User Login**
- Sign in with username or email
- Password verification
- 30-day session duration

✅ **MongoDB Integration**
- User data persisted to MongoDB
- Automatic password hashing
- User timestamps (created/updated)

✅ **NextAuth.js**
- Session management
- Protected API routes ready
- JWT-based authentication

## Important Files

- **API Routes:**
  - `/app/api/auth/signup` - Create new users
  - `/app/api/auth/[...nextauth]` - NextAuth configuration

- **Pages:**
  - `/app/page.tsx` - Home page (shows auth status)
  - `/app/login/page.tsx` - Login page
  - `/app/signup/page.tsx` - Registration page

- **Database:**
  - `/lib/db.ts` - MongoDB connection
  - `/models/User.ts` - User schema

- **Auth:**
  - `/lib/auth.ts` - NextAuth configuration
  - `/app/providers.tsx` - Session provider wrapper

## Environment Variables (.env.local)

```
MONGODB_URI=mongodb://localhost:27017/simplevocab
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here-change-this-in-production
```

## Test Users

You can create as many users as you want through the signup page. Each user is unique by username and email.

## Next Steps

Ready to add features? You can now:
- Create protected pages that require authentication
- Add more user fields to the model
- Implement email verification
- Add OAuth providers (Google, GitHub, etc.)
- Build vocabulary learning features

Happy coding! 🚀
