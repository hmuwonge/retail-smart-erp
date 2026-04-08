import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function GET() {
  const content = `# RetailSmart ERP

> AI-powered cloud POS and ERP platform for retail stores, restaurants, supermarkets, auto service centers, and vehicle dealerships. All features on every plan. Unlimited users. Free to start.

RetailSmart ERP is a multi-tenant SaaS business management system built for five business types. It provides point of sale, inventory management, double-entry accounting, HR and payroll, kitchen display, work order management, and AI-powered analytics in a single platform. Every plan includes every feature with no feature gating. The first company per account is free forever with no credit card required.

## Key Pages

- [Home](https://www.localhost:3000/): Product overview and value proposition
- [Features](https://www.localhost:3000/features): Complete feature list across all modules
- [Pricing](https://www.localhost:3000/pricing): Transparent storage-based pricing, all features included
- [Retail POS](https://www.localhost:3000/retail): Barcode scanning, inventory, loyalty programs, gift cards
- [Restaurant](https://www.localhost:3000/restaurant): Kitchen display, table management, floor plan, reservations, recipes
- [Supermarket](https://www.localhost:3000/supermarket): High-volume checkout, department management, batch tracking
- [Auto Service](https://www.localhost:3000/auto-service): Work orders, vehicle tracking, inspections, insurance estimates
- [Vehicle Dealership](https://www.localhost:3000/dealership): Vehicle inventory, sales pipeline, trade-ins, test drives

## Company

- [About](https://www.localhost:3000/about): Our mission and technology
- [Contact](https://www.localhost:3000/contact): Support and inquiries
- [Privacy Policy](https://www.localhost:3000/privacy): Data handling and security practices
- [Terms of Service](https://www.localhost:3000/terms): Usage terms and conditions

## Getting Started

- [Register](https://www.localhost:3000/register): Create a free account — no credit card required
- [Login](https://www.localhost:3000/login): Sign in to your account
- [Full Product Details](/llms-full.txt): Extended product information for AI systems
`

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  })
}
