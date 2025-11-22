import { Router } from 'express';
import { subscriptionsRepository } from '../../db/repositories/subscriptions.js';
import { notificationsRepository } from '../../db/repositories/notifications.js';
import { createSubscriptionSchema, updateSubscriptionSchema } from '../validators.js';
import type { CreateSubscriptionRequest, SubscriptionResponse } from '../../types/index.js';

const router = Router();

// Create subscription
router.post('/', async (req, res) => {
  try {
    const validatedData = createSubscriptionSchema.parse(req.body);

    const subscription = await subscriptionsRepository.createSubscription(
      validatedData.user_id,
      validatedData.name,
      validatedData.webhook_url,
      validatedData.meta_event_config,
      validatedData.cooldown_minutes
    );

    const response: SubscriptionResponse = {
      id: subscription.id,
      user_id: subscription.user_id,
      name: subscription.name,
      webhook_url: subscription.webhook_url,
      meta_event_config: subscription.meta_event_config,
      cooldown_minutes: subscription.cooldown_minutes,
      is_active: subscription.is_active,
      created_at: subscription.created_at.toISOString(),
      updated_at: subscription.updated_at.toISOString(),
    };

    res.status(201).json(response);
  } catch (error) {
    if (error instanceof Error && 'issues' in error) {
      // Zod validation error
      res.status(400).json({ error: 'Validation error', details: error });
    } else {
      console.error('Error creating subscription:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// List subscriptions (all or by user_id)
router.get('/', async (req, res) => {
  try {
    const userId = req.query.user_id as string | undefined;

    const subscriptions = userId
      ? await subscriptionsRepository.getSubscriptionsByUserId(userId)
      : await subscriptionsRepository.getActiveSubscriptions();

    const response: SubscriptionResponse[] = subscriptions.map((s) => ({
      id: s.id,
      user_id: s.user_id,
      name: s.name,
      webhook_url: s.webhook_url,
      meta_event_config: s.meta_event_config,
      cooldown_minutes: s.cooldown_minutes,
      is_active: s.is_active,
      created_at: s.created_at.toISOString(),
      updated_at: s.updated_at.toISOString(),
    }));

    res.json(response);
  } catch (error) {
    console.error('Error listing subscriptions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get subscription by ID
router.get('/:id', async (req, res) => {
  try {
    const subscription = await subscriptionsRepository.getSubscriptionById(req.params.id);

    if (!subscription) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    const response: SubscriptionResponse = {
      id: subscription.id,
      user_id: subscription.user_id,
      name: subscription.name,
      webhook_url: subscription.webhook_url,
      meta_event_config: subscription.meta_event_config,
      cooldown_minutes: subscription.cooldown_minutes,
      is_active: subscription.is_active,
      created_at: subscription.created_at.toISOString(),
      updated_at: subscription.updated_at.toISOString(),
    };

    res.json(response);
  } catch (error) {
    console.error('Error getting subscription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update subscription
router.patch('/:id', async (req, res) => {
  try {
    const validatedData = updateSubscriptionSchema.parse(req.body);

    const subscription = await subscriptionsRepository.updateSubscription(
      req.params.id,
      validatedData
    );

    if (!subscription) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    const response: SubscriptionResponse = {
      id: subscription.id,
      user_id: subscription.user_id,
      name: subscription.name,
      webhook_url: subscription.webhook_url,
      meta_event_config: subscription.meta_event_config,
      cooldown_minutes: subscription.cooldown_minutes,
      is_active: subscription.is_active,
      created_at: subscription.created_at.toISOString(),
      updated_at: subscription.updated_at.toISOString(),
    };

    res.json(response);
  } catch (error) {
    if (error instanceof Error && 'issues' in error) {
      res.status(400).json({ error: 'Validation error', details: error });
    } else {
      console.error('Error updating subscription:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Delete subscription
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await subscriptionsRepository.deleteSubscription(req.params.id);

    if (!deleted) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting subscription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get notification history for a subscription
router.get('/:id/notifications', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const notifications = await notificationsRepository.getRecentNotifications(
      req.params.id,
      limit
    );

    res.json(notifications);
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
