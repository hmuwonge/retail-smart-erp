export const config = {
  port: 3001,
  pactBrokerUrl: process.env.PACT_BROKER_URL || 'http://localhost:9292',
  pactBrokerUsername: process.env.PACT_BROKER_USERNAME,
  pactBrokerPassword: process.env.PACT_BROKER_PASSWORD,
  providerBaseUrl: process.env.PROVIDER_BASE_URL || 'http://localhost:3000',
}
