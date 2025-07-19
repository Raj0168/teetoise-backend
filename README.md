# Backend – Teetoise E-commerce Platform

This is the **backend** service for the Teetoise↗ e-commerce platform, built using **Node.js**, **Express**, **PostgreSQL**, and deployed on **AWS EC2**. It powers the business logic, APIs, and integrations for authentication, product management, order handling, payment processing, user operations, and more.

---

## Project Structure

```
.
├── controllers/        # Business logic for all features
├── models/             # Database models and middlewares
├── routes/             # API route definitions
├── utils/              # Utility helpers (e.g., validation, tokens)
├── config/             # Config files (e.g., passport, DB)
├── .env                # Environment variables
└── server.js           # Application entry point
```

---

## Features

### Authentication & Authorization

- Register, Login (Email/Password + Google OAuth)
- OTP-based verification
- JWT-based session handling with access/refresh tokens
- Password reset/update
- Middleware-based role protection (`admin`, `customer`)

### User Management

- Add/view/delete user details
- Add/remove/view multiple addresses

### Product Management

- Create/read/update/delete products (admin)
- Tagging, size, color, design, and variant management
- Trending, suggestions, new arrivals, related products

### Cart & Wishlist

- Add/remove/update cart items
- Size availability checks
- Manage wishlist items per user

### Orders & Checkout

- Place orders, view user/admin order history
- Admin tracking, delivery status updates
- Manage returns, refunds, exchanges, and cancellations

### Payments

- Razorpay integration for payment initiation & verification
- Secure, token-authenticated endpoints

### Home Content

- Fetch home page content dynamically
- Admin ability to update featured categories and banners

### Blog

- Public access to blog content
- Admin can create blog posts

---

## API Endpoints Overview

Each route is prefixed according to its domain logic:

| Domain   | Prefix      |
| -------- | ----------- |
| Auth     | `/auth`     |
| User     | `/user`     |
| Product  | `/product`  |
| Cart     | `/cart`     |
| Wishlist | `/wishlist` |
| Orders   | `/orders`   |
| Checkout | `/checkout` |
| Payments | `/payment`  |
| Coupons  | `/coupons`  |
| Refunds  | `/refund`   |
| Shipping | `/shipping` |
| Home     | `/home`     |
| Blog     | `/blog`     |

---

## Setup Instructions

### 1. Clone the repo

```bash
git clone https://github.com/your-username/teetoise-backend.git
cd teetoise-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Create a `.env` file in the root with the following:

```env
PORT=4000
NODE_ENV=development
DB_HOST=your_postgres_host
DB_USER=your_db_user
DB_PASS=your_db_password
DB_NAME=your_db_name
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_token_secret
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### 4. Start server

```bash
npm run dev     # Starts server with nodemon
```

---

## Testing

Use Postman or any API client to test each route. You’ll need to:

- Include `Authorization: Bearer <token>` headers for protected routes
- Send proper request bodies for POST/PUT requests

---

## Deployment Notes

- **Production** deployed on AWS EC2
- **Razorpay** integration secured with backend verification
- CORS setup for frontend integration (default: `http://localhost:8000`)
- HTTPS handled externally via NGINX/Cloudflare or hosting provider

---

## Security

- All routes protected with JWT middleware
- Admin-only routes validated by `authorizeRoles()`
- Razorpay payment verification double-checked on server
- OAuth via PassportJS with Google strategy

---
