# xinglian-server

Node.js backend service for Xinglian.

## Tech stack

- Express
- TypeScript
- dotenv
- helmet, cors, morgan

## Quick start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create env file:

   ```bash
   cp .env.example .env
   ```

3. Run in dev mode:

   ```bash
   npm run dev
   ```

## Local MySQL setup

1. Ensure MySQL is running locally and create the database:

   ```sql
   CREATE DATABASE IF NOT EXISTS xinglian CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. Update `.env` with your local MySQL account/password:

   - `DB_HOST=127.0.0.1`
   - `DB_PORT=3306`
   - `DB_USER=root`
   - `DB_PASSWORD=your_password`
   - `DB_NAME=xinglian`

3. Start server and verify:
   - `GET /api/health` service status
   - `GET /api/health/db` MySQL connectivity

## Scripts

- `npm run dev`: start development server with watch mode
- `npm run build`: compile TypeScript to `dist`
- `npm run start`: run compiled server

## Basic routes

- `GET /`: service welcome message
- `GET /api/health`: health check
