# 🚕 FG DRIVO — Dindigul Taxi Booking & Centralized Dispatch Platform

> **FG DRIVO** is an exclusive, company-owned local fleet taxi service operating in **Dindigul City, Tamil Nadu, India**.
> Built with **Node.js, Express, MySQL, Prisma ORM, Socket.IO, Leaflet Maps**, and modern responsive **Vanilla CSS/JS**.

---

## 🎨 Brand Identity & Palette
- **Brand Yellow**: `#FFD629` (Primary action, taxi roof accents, highlights)
- **Brand Violet**: `#6C3CE9` (Primary brand color, buttons, glowing borders)
- **Pure White**: `#FFFFFF` (Headings, clarity contrast)
- **Dark Surface**: `#0A0518`, `#130B29` (Sleek dark theme)

---

## 🚀 Portals Overview

### 1. 🚖 Customer Portal
- **Instant & Scheduled Rides**: Book immediately or schedule for future train/bus transfers.
- **Dindigul Service Boundary Validation**: Strict 25 km geo-fencing centered on Dindigul (`10.3673, 77.9803`). Localities include Central Bus Stand, Railway Junction, Malai Kottai (Rock Fort), Collectorate, GTN College, PSNA College, Gandhigram, Batlagundu Bypass, etc.
- **Configurable Fares**: Real-time fare calculation with night multiplier (10 PM – 5 AM) and peak hour surcharges.
- **Live GPS Tracking**: Interactive Leaflet map with moving taxi marker, live driver details, and 4-digit Ride Start OTP.
- **Payment Flexibility**: Cash on ride, Instant UPI QR Code (GPay/PhonePe/Paytm), and online card mock gateway with printable tax invoices.
- **Customer Support & Safety**: Direct hotline (`0451 - 2439800`) and support ticketing.

### 2. 🧭 Driver Portal
- **Duty Switch**: One-click "Go Online" / "Go Offline" toggle with shift timer.
- **Trip Workflow Pipeline**:
  1. `Assigned` ➔ 2. `Driver Arrived` ➔ 3. `Verify Customer 4-Digit OTP & Start Trip` ➔ 4. `Complete Trip` ➔ 5. `Confirm Cash / UPI Settlement`.
- **Live GPS Telemetry**: Authorized real-time GPS stream over authenticated Socket.IO connection.
- **Driver Earnings Dashboard**: Daily trips count, today's gross revenue, and ratings breakdown.

### 3. ⚡ Admin & Central Dispatch Portal
- **Operations Command Center**: Live KPI cards (Active Rides, Pending Dispatch Queue, Drivers Online, Fleet Size, Today Revenue).
- **Live Fleet Radar Map**: Real-time Dindigul map with active driver locations and active ride polylines.
- **Dispatch Management**: 1-Click Auto Dispatch (closest driver matching) and Manual Driver & Vehicle assignment.
- **Fleet Inventory**: Manage vehicle models, registration numbers, categories (Auto, Mini, Sedan, SUV), maintenance, and fuel type.
- **Driver Roster & KYC**: Verify driver licenses, police verification status, and approve/revoke KYC.
- **Fare Matrix Editor**: Live editor for Base Fare, Rate per Km, Minimum Fare, and Surcharge Multipliers.
- **Payments & Audit Ledger**: Full audit trail of all dispatch decisions and payment transactions.
- **System & Database Health Probe**: Live DB connection health, query latency, and uptime.

---

## ⚡ Quick Demo Accounts

| Role | Name | Phone / Login | Password | Vehicle / Permissions |
|---|---|---|---|---|
| **Customer** | Priya Ramesh | `9842122001` | `drivo123` | Customer Booking & Tracking |
| **Driver (Sedan)** | Anand Raj | `9842111002` | `drivo123` | Maruti Dzire (`TN 57 B 4420`) |
| **Driver (Auto)** | Senthil Kumar | `9842111001` | `drivo123` | Bajaj RE Auto (`TN 57 AW 1088`) |
| **Driver (SUV)** | Praveen Velu | `9842111003` | `drivo123` | Innova Crysta (`TN 57 C 8899`) |
| **Driver (Mini)** | Muthu Krishnan | `9842111004` | `drivo123` | Tiago EV (`TN 57 D 3112`) |
| **Administrator** | Murugan Admin | `9842100001` | `admin123` | Full Admin & System Access |
| **Dispatcher** | Kavitha Dispatch | `9842100002` | `admin123` | Live Dispatch Operations |

---

## 🛠️ Project Structure

```
.
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # MySQL Prisma Schema
│   │   └── seed.js              # Database seed script with Dindigul fleet
│   ├── src/
│   │   ├── config/              # Constants & Dindigul Geo Boundary (25km)
│   │   ├── db/                  # Prisma client & resilient memory store
│   │   ├── middlewares/         # JWT Auth, RBAC, Rate Limiting, Validation
│   │   ├── services/            # Fare Engine, Geo Service, Dispatch, Payment, Audit
│   │   ├── controllers/         # Auth, Bookings, Drivers, Admin, Payments, Support
│   │   ├── routes/              # Express API Routes & /api/health probe
│   │   ├── sockets/             # Socket.IO Handlers & GPS broadcaster
│   │   ├── tests/               # Jest Automated Test Suite (100% Pass)
│   │   └── server.js            # Express Server + Socket.IO setup
│   └── package.json
│
├── frontend/
│   ├── public/assets/           # Hero taxi banner & Brand logo
│   ├── src/
│   │   ├── components/          # Navbar, AuthModal, ReceiptModal, PaymentModal
│   │   ├── portals/             # CustomerPortal, DriverPortal, AdminPortal
│   │   ├── services/            # API Client & Socket.IO Manager
│   │   ├── styles/theme.css     # Brand Design System (#FFD629, #6C3CE9)
│   │   └── main.js              # Single-page router
│   ├── index.html
│   └── package.json
└── README.md
```

---

## ⚙️ Setup & Running

### 1. Backend Server
```bash
cd backend
npm install
npm run test           # Run 9 automated unit & integration tests
npm start              # Starts backend on http://localhost:5000
```

### 2. Frontend Development Server
```bash
cd frontend
npm install
npm run dev            # Starts Vite dev server on http://localhost:5173
```

### 3. MySQL Database Setup (Optional / Production)
1. Start your local MySQL instance (via XAMPP, Docker, or MySQL Windows Service).
2. Create the database:
   ```sql
   CREATE DATABASE fg_drivo;
   ```
3. Ensure `.env` in `backend/.env` has:
   ```env
   DATABASE_URL="mysql://root:password@localhost:3306/fg_drivo"
   ```
4. Push schema and seed initial Dindigul fleet:
   ```bash
   npm run prisma:push
   npm run prisma:seed
   ```
*Note: If MySQL is not running, the application seamlessly uses the resilient in-memory store so all features work out-of-the-box.*

---

## 🧪 Automated Testing

Run the automated test suite with:
```bash
cd backend
npm test
```
**Test Coverage Includes:**
1. Health check diagnostics (`/api/health`) without credential leakage.
2. Dindigul geo-fence validation (Valid Dindigul coordinates accepted; outside coordinates rejected with 400).
3. Customer registration and JWT login.
4. Driver duty shift toggle.
5. Admin metrics and fleet querying.
6. Booking creation with fare calculation snapshot and 4-digit OTP.
7. Dispatcher concurrency assignment protection.
8. Driver OTP verification before starting ride (wrong OTP fails with 400, correct OTP succeeds).
9. Trip completion and cash/UPI payment settlement.

---

## 🔒 Security & Privacy
- Passwords hashed using **Bcrypt** (salt rounds: 10).
- Stateless JWT authentication with Role-Based Access Control (`CUSTOMER`, `DRIVER`, `ADMIN`, `DISPATCHER`).
- GPS tracking packets authorized exclusively to active booking participants and auto-terminated upon completion.
- Express Rate Limiting to prevent brute-force attacks on auth and booking endpoints.
- Helmet security headers and CORS origin restrictions.
