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
          config.lookback_blocks
        );

        console.log(`Counting evnet for contract ${contract.slice(0, 8)} --- ${count}`)

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
      config.lookback_blocks
    );

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
          config.lookback_blocks
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
      config.lookback_blocks
    );

    const threshold = typeof config.condition.value === 'number' ? config.condition.value : 0;
    const triggered = this.evaluateCondition(aggregatedValue, config.condition.operator, threshold);

    return {
      triggered,
      aggregatedValue,
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
