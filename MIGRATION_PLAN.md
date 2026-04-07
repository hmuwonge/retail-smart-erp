# Migration Plan: Next.js to Laravel + React Inertia

## Overview
- **Current Stack**: Next.js 14, Drizzle ORM, PostgreSQL, WebSocket
- **Target Stack**: Laravel 11, Eloquent ORM, PostgreSQL, Laravel Reverb
- **Timeline**: 4-6 months
- **Team**: 1-2 developers

---

## Phase 1: Project Setup (Week 1-2)

### 1.1 Create Laravel Project
```bash
composer create-project laravel/laravel retail-smart-erp --inertia
npm install react react-dom @inertiajs/react
```

### 1.2 Configure Database
```bash
# Keep PostgreSQL - update .env
DB_CONNECTION=pgsql
DB_HOST=postgres
DB_PORT=5432
DB_DATABASE=retail_smart
DB_USERNAME=postgres
DB_PASSWORD=postgres
```

### 1.3 Install Required Packages
```bash
composer require laravel/fortify laravel/sanctum spatie/laravel-permission
composer require --dev laravel/pint
npm install @inertiajs/server @inertiajs/props
```

---

## Phase 2: Database Migration (Week 2-4)

### 2.1 Export Current Schema
- Use Drizzle schema: `src/lib/db/schema.ts`
- Create Laravel migrations for each table

### 2.2 Table Mapping

| Next.js (Drizzle) | Laravel (Migration) |
|-------------------|---------------------|
| `accounts` | `accounts` table |
| `tenants` | `tenants` table |
| `users` | `users` table |
| `pricing_tiers` | `pricing_tiers` table |
| `subscriptions` | `subscriptions` table |
| `tenant_usage` | `tenant_usage` table |
| ...all 100+ tables | ...corresponding migrations |

### 2.3 Create Models
```bash
php artisan make:model Account -m
php artisan make:model Tenant -m
# Repeat for all tables
```

### 2.4 Define Relationships
```php
// app/Models/Account.php
class Account extends Model {
    public function tenants(): HasMany
    public function subscription(): HasOne
}
```

---

## Phase 3: Authentication (Week 4-6)

### 3.1 Laravel Fortify Setup
```bash
composer require laravel/fortify
php artisan vendor:publish --provider="Laravel\Fortify\FortifyServiceProvider"
```

### 3.2 Multi-Tenant Auth
- Extend User model for tenant relationship
- Implement tenant-aware authentication
- Create middleware for tenant isolation

### 3.3 Custom Features (from Next.js)
- OTP verification (from `src/app/api/register/send-otp`)
- Email verification flow

---

## Phase 4: API Routes (Week 6-12)

### 4.1 Route Mapping

| Next.js Route | Laravel Route |
|---------------|---------------|
| `/api/auth/login` | `POST /login` (Fortify) |
| `/api/auth/register` | `POST /register` |
| `/api/account/subscriptions` | `GET/POST /api/subscriptions` |
| `/api/sys-control/*` | `/api/admin/*` |
| `/api/c/[slug]/*` | `/api/tenants/{tenant}/*` |

### 4.2 Controller Conversion
- Convert each Next.js API route to Laravel controller
- Keep same business logic from `src/app/api/*`

### 4.3 Key Controllers to Migrate
```bash
php artisan make:controller Api/AuthController
php artisan make:controller Api/SubscriptionController
php artisan make:controller Api/TenantController
php artisan make:controller Api/BillingController
```

---

## Phase 5: Billing & Subscriptions (Week 12-16)

### 5.1 Subscription System
- Pricing tiers management
- Trial → Paid flow
- Upgrade/Downgrade with proration
- PayHere integration (migrate from `src/app/api/payhere/*`)

### 5.2 Payment Webhooks
```php
// routes/web.php
Route::post('/webhooks/payhere', [PayHereController::class, 'handle']);
```

---

## Phase 6: Frontend (Week 16-20)

### 6.1 Inertia Setup
- Install Inertia React adapter
- Create root template
- Configure Inertia middleware

### 6.2 Convert Pages
- Copy React components from `src/app/c/[slug]/*`
- Use `useRoute()` instead of Next.js routing
- Replace `fetch()` with Inertia requests

### 6.3 Layouts
```php
// resources/js/layouts/AppLayout.jsx
import { usePage } from '@inertiajs/react'

export default function AppLayout({ children }) {
    const { props } = usePage()
    // tenant, user, etc. from $page.props
}
```

---

## Phase 7: WebSocket (Week 20-22)

### 7.1 Laravel Reverb
```bash
composer require laravel/reverb
php artisan reverb:install
```

### 7.2 Event Conversion
- Convert WebSocket events from `src/lib/websocket/events.ts`
- Create Laravel events/listeners

---

## Phase 8: Production & Deployment (Week 22-24)

### 8.1 Docker Configuration
```dockerfile
FROM php:8.2-fpm
RUN apt-get update && apt-get install -y libpq-dev
RUN docker-php-ext-install pdo pdo_pgsql
COPY . /var/www/html
RUN composer install
```

### 8.2 Docker Compose
```yaml
services:
  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - php
  php:
    build: .
  postgres:
    image: postgres:15
```

---

## File Structure Target

```
retail-smart-erp/
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   ├── Middleware/
│   │   └── Requests/
│   ├── Models/
│   ├── Providers/
│   └── Events/
├── config/
├── database/
│   ├── migrations/
│   └── seeders/
├── routes/
│   ├── api.php
│   ├── web.php
│   └── channels.php
├── resources/
│   └── js/
│       ├── components/
│       ├── layouts/
│       └── pages/
└── tests/
```

---

## Migration Checklist

- [ ] Initialize Laravel project
- [ ] Configure PostgreSQL
- [ ] Install Fortify & Inertia
- [ ] Create all migrations from schema.ts
- [ ] Create all Eloquent models
- [ ] Implement authentication
- [ ] Migrate API routes
- [ ] Migrate billing system
- [ ] Convert React pages to Inertia
- [ ] Set up WebSocket (Reverb)
- [ ] Configure Docker
- [ ] Test & deploy

---

## Notes

- Keep PostgreSQL (not changing DB)
- Keep same PayHere integration
- React components transfer ~80% directly
- Main work is PHP backend rewriting
- Consider Laravel Octane for performance