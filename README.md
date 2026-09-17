# URL Tracker Platform (Hardened Fork)

> [!NOTE]
> **This repository is an enhanced, security-hardened fork of [moeidsaleem/url-tracker-platform](https://github.com/moeidsaleem/url-tracker-platform).**
> Unlike the original upstream repository where dashboard routes were completely unauthenticated, this fork introduces built-in **dashboard authentication**, **timing-safe cryptographic tokens**, **hardened Firebase database rules**, and **SSR hydration stability**.

A versatile, real-time URL tracker platform featuring device geolocation, IP address intelligence, visitor telemetry, and URL shortening.

---

## Table of Contents

- [What's New in this Fork](#whats-new-in-this-fork)
- [Features](#features)
- [Technologies Used](#technologies-used)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Rules Setup](#database-rules-setup)
- [How Data Flows](#how-data-flows)
- [Security Architecture](#security-architecture)
- [HTTP API](#http-api)
- [Contributing](#contributing)
- [License](#license)

---

## What's New in this Fork

1. **Dashboard Authentication & Route Guarding:**
   - All private dashboard routes (`/`, `/locations`, `/share-links`, `/whatsapp`) are protected via Next.js Edge Middleware ([`middleware.ts`](middleware.ts)).
   - Public visitor tracking ([`/track`](app/track/page.tsx) and `/s/[code]`) remains completely open for friction-free location capture.
2. **Cryptographically Signed Session Tokens:**
   - Employs Web Crypto HMAC SHA-256 signed session tokens (`${expiresAt}.${hash}`).
   - Completely unbypassable: manual cookie forgery via browser devtools or cURL is rejected and cleared automatically.
3. **Configurable Session Lifetime & Refresh Persistence:**
   - Configurable session duration via `SESSION_DURATION_MINUTES` in `.env.local`.
   - Browser reloads/refreshes retain the authenticated session until the configured timeout elapses.
4. **Timing-Safe Password Verification:**
   - Uses Web Crypto constant-time comparisons (`timingSafeCompare`) with SHA-256 pre-hashing to eliminate side-channel timing attacks.
5. **Hardened Firebase Realtime Database Rules ([`database.rules.json`](database.rules.json)):**
   - Enforces device ID matching to prevent key overwrites.
   - Enforces coordinate validity ranges (`-90 <= latitude <= 90` and `-180 <= longitude <= 180`).
   - Caps string payload sizes (`userAgent`, `referrer`, `deviceId`) to block database bloat and quota attacks.
6. **In-App Payload Sanitization:**
   - Sanitizes and validates GPS/IP coordinates before writing to Firebase.
7. **SSR Hydration Fix:**
   - Resolved React SSR hydration mismatches on the visitor tracking page.

---

## Features

- **URL Tracking**: Track visits to your shared URLs silently in real time.
- **Geolocation**: Capture and display visitor GPS and IP coordinates on an interactive Leaflet map.
- **IP Address Intelligence**: Log visitor IP addresses, cities, regions, and ISPs.
- **Device Telemetry**: Collect battery levels, network connection types, CPU cores, screen dimensions, and user agents.
- **URL Shortener**: Generate short, easy-to-share links (e.g. `/s/abc123`).
- **Protected Admin Dashboard**: Manage tracked devices, edit nicknames, and delete records securely.
- **WhatsApp Dispatch**: Trigger WhatsApp notifications with visitor coordinates via Meta WhatsApp Cloud API.

---

## Technologies Used

- **Next.js 14 (App Router)**
- **React 18**
- **TypeScript**
- **Firebase Realtime Database**
- **Leaflet & React-Leaflet**
- **Tailwind CSS & Shadcn UI**
- **Web Crypto API** (for timing-safe comparisons and HMAC token signing)

---

## Getting Started

### Prerequisites

- Node.js (v18 or later recommended)
- npm or yarn
- Firebase account with a Realtime Database instance

### Installation

1. Clone your fork:
   ```bash
   git clone https://github.com/yourusername/url-tracker-platform.git
   cd url-tracker-platform
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your credentials:
   ```env
   # Master password for admin dashboard
   DASHBOARD_PASSWORD=your_secure_password
   SESSION_DURATION_MINUTES=5

   # Public App URL
   NEXT_PUBLIC_APP_URL=http://localhost:3000

   # Firebase Configuration (From Firebase Console -> Project Settings)
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-app-default-rtdb.firebaseio.com/
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-app-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-app.firebasestorage.app
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef

   # Optional: Meta WhatsApp Cloud API
   WHATSAPP_ACCESS_TOKEN=
   WHATSAPP_PHONE_NUMBER_ID=
   RECIPIENT_PHONE_NUMBER=
   WHATSAPP_API_SECRET=
   ```

4. Apply Firebase Database Rules:
   - Copy the contents of [`database.rules.json`](database.rules.json).
   - Go to **Firebase Console → Realtime Database → Rules** tab.
   - Paste and click **Publish**. (See [`docs/firebase-rules.md`](docs/firebase-rules.md) for full details).

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## How Data Flows

- **Visitor tracking**: Opening `/track?id=<shareLinkId>` (or short link `/s/<code_id>`) loads the tracking client. The browser requests location permissions and writes sanitized coordinates to `locations/{deviceId}` in Firebase RTDB.
- **Short links**: Stored under `shortUrls/{code}`. Navigating to `/s/{code}` resolves the link server-side and redirects to `/track?id=...`.
- **Dashboard**: Authenticated admins view, filter, and inspect tracked signals in real time via Firebase WebSocket synchronization.

---

## Security Architecture

| Layer | Implementation | Protection |
| :--- | :--- | :--- |
| **Route Gating** | Next.js Middleware ([`middleware.ts`](middleware.ts)) | Intercepts unauthenticated dashboard access and redirects to `/login` |
| **Token Signing** | HMAC SHA-256 ([`lib/auth-security.ts`](lib/auth-security.ts)) | Prevents cookie tampering and spoofing |
| **Password Verification** | `timingSafeCompare` | Constant-time execution prevents timing side-channel attacks |
| **Database Validation** | Firebase RTDB Rules ([`database.rules.json`](database.rules.json)) | Validates GPS bounds (`-90..90`, `-180..180`) and limits payload size |
| **Client Sanitization** | `validateAndSanitizeLocationPayload` | Strips invalid coordinates and truncates strings before dispatch |

---

## HTTP API

| Method & Path | Purpose | Authentication |
| :--- | :--- | :--- |
| `POST /api/auth/login` | Authenticates dashboard admin and issues HMAC session cookie | Public (password required in JSON body) |
| `POST /api/auth/logout` | Terminates dashboard session and destroys cookie | Session cookie |
| `POST /api/whatsapp` | Sends WhatsApp message via Meta Cloud API | Header `x-internal-key` with `WHATSAPP_API_SECRET` |

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
