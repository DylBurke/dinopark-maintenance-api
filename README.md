# 🦕 Dinopark Maintenance API

A safety-critical backend API for tracking dinosaur locations and determining if park zones are safe for maintenance workers to enter. Built with Node.js, Express, TypeScript, Drizzle ORM, and PostgreSQL.

## 🎯 Business Logic

A zone is **SAFE** for maintenance if:
- No carnivores are present, OR
- All carnivores in the zone are still digesting their last meal

## 🚀 Quick Start

### Prerequisites
- Node.js ≥18.0.0
- pnpm ≥8.0.0 (recommended) or npm ≥9.0.0
- PostgreSQL database (Supabase recommended)

### Installation

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Generate and push database schema:**
   ```bash
   pnpm run db:generate
   pnpm run db:push
   ```

4. **Start development server:**
   ```bash
   pnpm run dev
   ```

The API will be available at `http://localhost:3000`

### Available Scripts

- `pnpm run dev` - Start development server with hot reload
- `pnpm run build` - Build for production
- `pnpm run start` - Start production server
- `pnpm test` - Run tests
- `pnpm run test:watch` - Run tests in watch mode
- `pnpm run db:generate` - Generate database migrations
- `pnpm run db:push` - Push schema to database
- `pnpm run db:studio` - Open Drizzle Studio

## 📊 Database Schema

### Zones Table
- **416 zones total** (A0-Z15 grid pattern)
- Tracks last maintenance date
- 30-day maintenance cycle requirement

### Dinosaurs Table
- NUDLS integration for real-time locations
- Carnivore classification
- Feeding time and digestion period tracking
- Current zone location

### Maintenance Records Table
- Historical maintenance logs
- Worker assignments and notes

## 🛡️ Safety System

The core safety calculation (`src/lib/safety.ts`) implements:

1. **Zone Safety Check:** Identifies all carnivores in a zone
2. **Digestion Logic:** Calculates hours since last feeding
3. **Fail-Safe Design:** Returns `false` if unable to determine safety

## 🏗️ Project Structure

```
src/
├── index.ts              # Express app entry point
├── lib/
│   ├── database.ts       # Drizzle + PostgreSQL connection
│   ├── schema.ts         # Database schema definitions
│   └── safety.ts         # Zone safety calculation logic
├── routes/               # API route handlers (to be implemented)
├── services/             # Background services (to be implemented)
├── middleware/           # Express middleware (to be implemented)
└── types/                # TypeScript type definitions
```

## 🚀 Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
pnpm add -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
```

### Environment Variables
```env
DATABASE_URL=postgresql://username:password@host:port/database
NODE_ENV=production
PORT=3000
NUDLS_FEED_URL=https://dinoparks.herokuapp.com/nudls/feed
```

## 🧪 Testing

Run the test suite:
```bash
pnpm test
```

Current test coverage includes:
- Zone ID generation (416 zones)
- Maintenance scheduling logic
- Basic safety calculations

## 📝 Next Steps

To complete the API implementation:

1. **Create API Routes:**
   - `/api/zones` - Zone safety status endpoints
   - `/api/dinosaurs` - Dinosaur management endpoints
   - `/api/maintenance` - Maintenance record endpoints

2. **Implement NUDLS Integration:**
   - Background service to poll NUDLS feed
   - Real-time dinosaur location updates

3. **Add Validation & Error Handling:**
   - Request validation middleware
   - Comprehensive error handling

4. **Seed Database:**
   - Populate all 416 zones
   - Add initial dinosaur data

5. **API Documentation:**
   - Swagger/OpenAPI documentation
   - Endpoint documentation

## 🔒 Security Features

- Helmet.js security headers
- CORS protection
- Request size limiting
- Environment-based configuration
- Fail-safe safety calculations

## 📖 API Endpoints

### Health Check
- `GET /health` - Service health status

### Core API
- `GET /api` - API information and available endpoints

*Additional endpoints to be implemented based on requirements*

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

---

**⚠️ Safety First:** This API handles safety-critical data. Always thoroughly test changes and follow fail-safe principles.