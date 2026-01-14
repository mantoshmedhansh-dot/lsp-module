export * from './types';
export * from './clickpost';

import { IAggregatorIntegration, AggregatorCredentials } from './types';
import { createClickPostIntegration } from './clickpost';

export type AggregatorCode = 'CLICKPOST' | 'SHIPROCKET_AGGREGATE';

export function createAggregatorIntegration(
  code: AggregatorCode,
  credentials: AggregatorCredentials
): IAggregatorIntegration {
  switch (code) {
    case 'CLICKPOST':
      return createClickPostIntegration(credentials);
    case 'SHIPROCKET_AGGREGATE':
      // Shiprocket also works as an aggregator
      throw new Error('Use transporters/shiprocket for Shiprocket aggregation');
    default:
      throw new Error(`Unknown aggregator code: ${code}`);
  }
}
