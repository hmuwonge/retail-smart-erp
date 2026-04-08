# Retail Smart ERP - Contract Testing with Pact

This directory contains consumer-driven contract tests to ensure API compatibility
between the frontend and backend services.

## Setup

```bash
npm install --save-dev @pact-foundation/pact
```

## Running Tests

```bash
# Run all contract tests
npm run test:contracts

# Run specific provider test
npm run test:contracts:provider
```

## Architecture

```
Frontend (Consumer)  ──pact──>  Backend (Provider)
     ↓                              ↓
  Generates                   Validates
  Contract                    Contract
```
