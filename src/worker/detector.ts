import type { MetaEventConfig, Subscription } from '../types/index.js';
import { eventsRepository } from '../db/repositories/events.js';

type DetectionResult = {
  triggered: boolean;
  aggregatedValue?: number;
  threshold?: number;
  eventCount?: number;
  window: string;
  triggeredByContract?: string;
};

const timestamp = () => new Date().toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 });

export class MetaEventDetector {
  private parseWindow(window: string): number {
    const match = window.match(/^(\d+)(m|h|d)$/);
    if (!match) {
      throw new Error(`Invalid window format: ${window}. Expected format: 1h, 15m, 24h, etc.`);
    }

    const [, value, unit] = match;
    const numValue = parseInt(value, 10);

    switch (unit) {
      case 'm':
        return numValue;
      case 'h':
        return numValue * 60;
      case 'd':
        return numValue * 60 * 24;
      default:
        throw new Error(`Unknown time unit: ${unit}`);
    }
  }

  private evaluateCondition(
    actualValue: number,
    operator: string,
    expectedValue: number
  ): boolean {
    switch (operator) {
      case '>':
        return actualValue > expectedValue;
      case '<':
        return actualValue < expectedValue;
      case '>=':
        return actualValue >= expectedValue;
      case '<=':
        return actualValue <= expectedValue;
      case '=':
        return actualValue === expectedValue;
      case '!=':
        return actualValue !== expectedValue;
      default:
        throw new Error(`Unknown operator: ${operator}`);
    }
  }

  async detect(subscription: Subscription): Promise<DetectionResult> {
    const config = subscription.meta_event_config;
    const windowMinutes = this.parseWindow(config.window);

    try {
      if (config.type === 'event_count') {
        return await this.detectEventCount(config, windowMinutes);
      } else if (config.type === 'rolling_aggregate') {
        return await this.detectRollingAggregate(config, windowMinutes);
      } else if (config.type === 'net_aggregate') {
        return await this.detectNetAggregate(config, windowMinutes);
      }

      throw new Error(`Unknown meta-event type: ${config.type}`);
    } catch (error) {
      console.error(`Error detecting meta-event for subscription ${subscription.id}:`, error);
      return {
        triggered: false,
        window: config.window,
      };
    }
  }

  private async detectEventCount(
    config: MetaEventConfig,
    windowMinutes: number
  ): Promise<DetectionResult> {
    const contracts = config.contracts ?? (config.contract_address ? [config.contract_address] : undefined);
    const chain = config.chain ?? 'ethereum';

    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);
    console.log(`[${timestamp()}] 🔎 Query: type=event_count event=${config.event_type} chain=${chain} window=${windowMinutes}min`);
    console.log(`[${timestamp()}]    Time range: ${windowStart.toISOString()} to ${now.toISOString()}`);

    // If multiple contracts, check each
    if (contracts && contracts.length > 1) {
      for (const contract of contracts) {
        const count = await eventsRepository.getEventCount(
          config.event_type,
          windowMinutes,
          undefined,
          contract,
          config.from_address,
          config.to_address,
          config.lookback_blocks,
          chain
        );

        const threshold = typeof config.condition.value === 'number' ? config.condition.value : 0;
        const triggered = this.evaluateCondition(count, config.condition.operator, threshold);

        if (triggered) {
          return {
            triggered: true,
            eventCount: count,
            threshold,
            window: config.window,
            triggeredByContract: contract,
          };
        }
      }

      return {
        triggered: false,
        eventCount: 0,
        window: config.window,
      };
    }

    // Single or no contract
    const count = await eventsRepository.getEventCount(
      config.event_type,
      windowMinutes,
      contracts,
      config.contract_address,
      config.from_address,
      config.to_address,
      config.lookback_blocks,
      chain,
      config.market_id
    );

    console.log(`[${timestamp()}] 📈 Result: count=${count}`);

    const threshold = typeof config.condition.value === 'number' ? config.condition.value : 0;
    const triggered = this.evaluateCondition(count, config.condition.operator, threshold);

    return {
      triggered,
      eventCount: count,
      threshold,
      window: config.window,
    };
  }

  private async detectRollingAggregate(
    config: MetaEventConfig,
    windowMinutes: number
  ): Promise<DetectionResult> {
    if (!config.field || !config.aggregation) {
      throw new Error('Rolling aggregate requires field and aggregation');
    }

    if (config.aggregation === 'count') {
      throw new Error('Use event_count type for count aggregation');
    }

    // Type assertion safe after count check above
    const aggregation = config.aggregation as Exclude<typeof config.aggregation, 'count'>;
    const contracts = config.contracts ?? (config.contract_address ? [config.contract_address] : undefined);
    const chain = config.chain ?? 'ethereum';

    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);
    console.log(`[${timestamp()}] 🔎 Query: type=rolling_aggregate event=${config.event_type} chain=${chain} window=${windowMinutes}min`);
    console.log(`[${timestamp()}]    Time range: ${windowStart.toISOString()} to ${now.toISOString()}`);

    // If multiple contracts, check each
    if (contracts && contracts.length > 1) {
      for (const contract of contracts) {
        const aggregatedValue = await eventsRepository.getAggregatedValue(
          config.event_type,
          config.field,
          aggregation,
          windowMinutes,
          undefined,
          contract,
          config.from_address,
          config.to_address,
          config.lookback_blocks,
          chain
        );

        const threshold = typeof config.condition.value === 'number' ? config.condition.value : 0;
        const triggered = this.evaluateCondition(aggregatedValue, config.condition.operator, threshold);

        if (triggered) {
          return {
            triggered: true,
            aggregatedValue,
            threshold,
            window: config.window,
            triggeredByContract: contract,
          };
        }
      }

      return {
        triggered: false,
        window: config.window,
      };
    }

    // Single or no contract
    const aggregatedValue = await eventsRepository.getAggregatedValue(
      config.event_type,
      config.field,
      aggregation,
      windowMinutes,
      contracts,
      config.contract_address,
      config.from_address,
      config.to_address,
      config.lookback_blocks,
      chain
    );

    console.log(`[${timestamp()}] 📈 Result: ${aggregation}=${aggregatedValue}`);

    const threshold = typeof config.condition.value === 'number' ? config.condition.value : 0;
    const triggered = this.evaluateCondition(aggregatedValue, config.condition.operator, threshold);

    return {
      triggered,
      aggregatedValue,
      threshold,
      window: config.window,
    };
  }

  private async detectNetAggregate(
    config: MetaEventConfig,
    windowMinutes: number
  ): Promise<DetectionResult> {
    if (!config.field || !config.aggregation) {
      throw new Error('Net aggregate requires field and aggregation');
    }

    if (!config.positive_event_type || !config.negative_event_type) {
      throw new Error('Net aggregate requires positive_event_type and negative_event_type');
    }

    if (config.aggregation === 'count') {
      throw new Error('Use event_count type for count aggregation');
    }

    // Type assertion safe after count check above
    const aggregation = config.aggregation as Exclude<typeof config.aggregation, 'count'>;
    const contracts = config.contracts ?? (config.contract_address ? [config.contract_address] : undefined);
    const chain = config.chain ?? 'ethereum';

    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);
    console.log(`[${timestamp()}] 🔎 Query: type=net_aggregate event=${config.event_type} chain=${chain} window=${windowMinutes}min`);
    console.log(`[${timestamp()}]    Time range: ${windowStart.toISOString()} to ${now.toISOString()}`);

    // If multiple contracts, check each
    if (contracts && contracts.length > 1) {
      for (const contract of contracts) {
        const netValue = await eventsRepository.getNetAggregatedValue(
          config.positive_event_type,
          config.negative_event_type,
          config.field,
          aggregation,
          windowMinutes,
          undefined,
          contract,
          config.from_address,
          config.to_address,
          config.lookback_blocks,
          chain,
          config.market_id
        );

        const threshold = typeof config.condition.value === 'number' ? config.condition.value : 0;
        const triggered = this.evaluateCondition(netValue, config.condition.operator, threshold);

        if (triggered) {
          return {
            triggered: true,
            aggregatedValue: netValue,
            threshold,
            window: config.window,
            triggeredByContract: contract,
          };
        }
      }

      return {
        triggered: false,
        window: config.window,
      };
    }

    // Single or no contract
    const netValue = await eventsRepository.getNetAggregatedValue(
      config.positive_event_type,
      config.negative_event_type,
      config.field,
      aggregation,
      windowMinutes,
      contracts,
      config.contract_address,
      config.from_address,
      config.to_address,
      config.lookback_blocks,
      chain,
      config.market_id
    );

    console.log(`[${timestamp()}] 📈 Result: netValue=${netValue} (${config.positive_event_type} - ${config.negative_event_type})`);

    const threshold = typeof config.condition.value === 'number' ? config.condition.value : 0;
    const triggered = this.evaluateCondition(netValue, config.condition.operator, threshold);

    return {
      triggered,
      aggregatedValue: netValue,
      threshold,
      window: config.window,
    };
  }

  async getRelevantEvents(config: MetaEventConfig, limit = 100) {
    const windowMinutes = this.parseWindow(config.window);
    const contracts = config.contracts ?? (config.contract_address ? [config.contract_address] : undefined);

    return eventsRepository.getEventsByTimeWindow(
      config.event_type,
      windowMinutes,
      contracts,
      config.contract_address,
      config.from_address,
      config.to_address
    );
  }
}
