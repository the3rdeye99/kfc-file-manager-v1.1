# File Manager Web Application

A secure file management system built with Next.js, Firebase, and TypeScript. This application allows administrators to manage files and users, while regular users can view and download files.

## Features

- Secure authentication with Firebase
- File upload, download, and deletion (admin only)
- User management system
- Responsive design with Tailwind CSS
- Real-time updates

## Prerequisites

- Node.js 16.x or later
- npm 7.x or later
- Firebase account

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd file-manager-web
```

2. Install dependencies:
```bash
npm install
```

3. Create a Firebase project and enable Authentication and Storage services

4. Create a `.env.local` file in the root directory with your Firebase configuration:
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Admin Users
- Create an admin account by including "admin" in the email address (e.g., admin@example.com)
- Upload, download, and delete files
- Create new user accounts
- Manage existing users

### Regular Users
- Log in with credentials provided by admin
- View and download files
- Cannot modify or delete files

## Security

- Authentication is handled by Firebase Auth
- File storage is secured with Firebase Storage
- Admin privileges are determined by email address
- All file operations are protected by authentication

## Development

- Built with Next.js 14
- TypeScript for type safety
- Tailwind CSS for styling
- Firebase for backend services

## License

MIT
