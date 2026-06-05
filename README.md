# Verdant Stock Tracker
 
> Internship project at the General Secretariat of Information Systems (GSIS)  
 
---
 
## Background
 
Verdant was built during an internship at GSIS, where the brief was to deliver a React web application. We treated it as an opportunity to build something production-shaped: the app ships with a containerized stack, Kubernetes manifests, and a working deployment pipeline.
 
---
 
## Screenshots
### Home Page
![Home](./public/docs/home.png)
### Portfolio Page
![Portfolio](./public/docs/portfolio.png)
### Screener Page
![Screener](./public/docs/screener.png)
### Watchlist Page
![Watchlist](./public/docs/watchlist.png)
### Markets Page
![Markets](./public/docs/markets.png)

 
---
 
## What It Does
 
A personal stock portfolio manager with live market data.
 
- **Dashboard:** Real-time market overview with live price updates
- **Portfolio:** Buy/sell transaction tracking with P&L calculations
- **Watchlist:** Monitor stocks with target prices and notes
- **Screener:** Filter by sector, market cap, P/E ratio, and dividend yield; save filter presets
- **Price Alerts:** Directional (above/below) alerts with in-app notifications
- **Authentication:** Email/password login with bcrypt hashing and JWT sessions
---
 
## Tech Stack
 
| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI | React 19, Tailwind CSS v4 |
| Database | Prisma ORM v7 + PostgreSQL |
| Auth | NextAuth.js v4 (Credentials provider, JWT strategy) |
| Validation | Zod |
| Market Data | Yahoo Finance (`yahoo-finance2`) |
| Infrastructure | Docker, Kubernetes (Minikube tested) |
 
---
 
## Data Model
 
| Model | Purpose |
|---|---|
| `User` | Accounts with email/password authentication |
| `Stock` | Tracked equities with price, market cap, P/E, dividend yield, sector |
| `Transaction` | Buy/sell records linking users to stocks |
| `Watchlist` | Per-user stock watchlist entries with target prices |
| `SavedFilter` | Persisted screener filter presets (stored as JSON) |
| `Alert` | Directional price alerts (above/below) with trigger tracking |
| `Notification` | In-app notification feed |
 
---
 
## Prerequisites
 
Make sure the following are installed before proceeding:
 
- [Node.js 22+](https://nodejs.org/)
- [Docker](https://www.docker.com/) (required for all local setups)
- [kubectl](https://kubernetes.io/docs/tasks/tools/) + [Minikube](https://minikube.sigs.k8s.io/) (Kubernetes path only)
---
 
## Local Development (Standalone)
 
Run the Next.js application and Prisma natively using Node 22.
 
> **Note:** `npm run dev` starts a PostgreSQL container via Docker Compose before launching the dev server, so Docker must be running. Alternatively, provide your own Postgres instance and run `npx next dev` directly.
 
### 1. Environment Variables
 
Create a `.env.local` file in the root directory. **Never commit secrets to version control.**
 
```env
DATABASE_URL="postgresql://user:password@localhost:5432/verdantdb"
NEXTAUTH_SECRET="your-nextauth-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```
 
### 2. Setup and Run
 
```bash
npm install
npm run db:up
npx prisma migrate dev
npm run dev
```
 
---
 
## Local Development (Docker Compose)
 
Run the full stack (web app + PostgreSQL + Prisma Studio) containerized locally.
 
### 1. Environment Variables
 
Create a `.env` file in the root directory.
 
```env
DATABASE_URL="postgresql://verdantuser:verdantpassword@db:5432/verdantdb"
DB_USER="verdantuser"
DB_PASSWORD="verdantpassword"
DB_NAME="verdantdb"
NEXTAUTH_SECRET="your-nextauth-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```
 
### 2. Setup and Run
 
```bash
docker-compose up --build -d
```
 
| Service | URL |
|---|---|
| Web App | `http://localhost:3000` |
| Prisma Studio | `http://localhost:5555` |
 
---
 
## Kubernetes Deployment
 
Production-ready manifests provided for Kubernetes, tested with Minikube.
 
### 1. Inject Secrets into the Cluster
 
```bash
# Database credentials
kubectl create secret generic postgres-secret \
  --from-literal=postgres-user='postgres' \
  --from-literal=postgres-password='postgres_secure_pass' \
  --from-literal=postgres-db='verdant'
 
# Application configuration
kubectl create secret generic verdant-db-secret \
  --from-literal=database-url='postgresql://postgres:postgres_secure_pass@postgres-service:5432/verdant?schema=public' \
  --from-literal=nextauth-secret='your-secret-key'
```
 
### 2. Build the Docker Image
 
The manifest uses `imagePullPolicy: Never`, so the image must be built inside Minikube's Docker daemon.
 
Point your Docker CLI to Minikube:
 
| Shell | Command |
|---|---|
| PowerShell | `minikube -p minikube docker-env --shell powershell \| Invoke-Expression` |
| CMD | `for /f "tokens=*" %i in ('minikube -p minikube docker-env') do %i` |
| Bash / Zsh | `eval $(minikube -p minikube docker-env)` |
 
Then build:
 
```bash
docker build -t vasilisbask/verdant-stock-tracker:latest .
```
 
### 3. Deploy Manifests
 
```bash
kubectl apply -f k8s-manifest.yaml
```
 
### 4. Expose the Service
 
```bash
minikube addons enable ingress
minikube tunnel
```
 
Access the app at `http://127.0.0.1`.
 
---
 
## Environment Variables Reference
 
| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | Secret used to sign JWT tokens and session cookies |
| `NEXTAUTH_URL` | Yes | Canonical URL of the application |
| `DB_USER` | Docker only | PostgreSQL username for the Compose DB container |
| `DB_PASSWORD` | Docker only | PostgreSQL password for the Compose DB container |
| `DB_NAME` | Docker only | PostgreSQL database name for the Compose DB container |
 
---
 
## API Routes
 
| Endpoint | Description |
|---|---|
| `/api/auth/[...nextauth]` | NextAuth.js authentication (login, session, CSRF) |
| `/api/stocks` | Stock data retrieval and search |
| `/api/portfolio` | Portfolio transactions (CRUD) |
| `/api/watchlist` | Watchlist management (CRUD) |
| `/api/alerts` | Price alert management |
| `/api/notifications` | In-app notification feed |
| `/api/me` | Current user profile |
| `/api/health` | Health check endpoint (used by K8s probes) |
 
## Authors

- **[Dimitrios Koutsompinas](https://github.com/KDim67)**
- **[Vasilios Mpaskairon](https://github.com/vasilisbask)**

Developed during an internship at the [General Secretariat of Information Systems (GSIS)](https://www.gsis.gr/), Greece.  