# Skill Development Portal

A private full-stack portal for first-year BTech skill development.

## Included
- Student registration/login
- Student dashboard
- Weekly challenges
- Private submission records
- Video/file upload
- Senior/admin dashboard
- Feedback and scores
- Progress tracking
- Announcements/resources
- Role-based access

## Stack
- Node.js + Express
- SQLite
- Vanilla HTML/CSS/JavaScript
- Multer for uploads
- JWT authentication
- bcrypt password hashing

## Run
1. Install Node.js 18+.
2. Open terminal in this folder.
3. Run:
   `npm install`
4. Copy `.env.example` to `.env` and change the secrets.
5. Run:
   `npm start`
6. Open `http://localhost:5000`

## First admin
Set ADMIN_EMAIL and ADMIN_PASSWORD in `.env`. On first server start, the admin account is created automatically.

## Important
This is a starter/development portal. For public production deployment, use HTTPS, a managed database/object storage, strong secrets, backups, rate limiting, antivirus/media validation, and proper privacy/retention policies.


## Recommended public deployment: Railway

This app uses SQLite + private uploaded files, so a persistent volume is required for a simple single-service deployment. Railway supports persistent volumes; mount the volume at `/app/data` and set `DATA_DIR=/app/data`.

### Railway steps
1. Create a GitHub repository and upload this folder.
2. In Railway, create a new project from the GitHub repo.
3. Deploy the service.
4. Add a Volume to the service with mount path:
   `/app/data`
5. Add environment variables:
   - `JWT_SECRET` = a long random secret
   - `ADMIN_EMAIL` = your senior/admin email
   - `ADMIN_PASSWORD` = a strong admin password
   - `DATA_DIR` = `/app/data`
6. Generate a Railway public domain.
7. Open the domain and register student accounts.

### Privacy
Uploaded videos/files are NOT exposed through a public `/uploads` URL. File access goes through authenticated API routes. A student can access their own submission; senior/admin users can review submissions.

### Storage warning
The starter upload limit is 100 MB per file. A Railway volume is persistent, but storage is finite. For a large student population, move video files to private object storage and keep only metadata in the database.

### GitHub
Never commit `.env`, passwords, JWT secrets, `data/`, or uploaded videos.
