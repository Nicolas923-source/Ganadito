import { writable } from 'svelte/store';
import { session } from '../session';
import type { OrderEvent } from './state';

export interface ReceivedOrder { event: OrderEvent; contextKey: string; receivedAt: string }
// Ephemeral transport receipt only. This is not an order query or an authorization cache.
export const receivedOrder = writable<ReceivedOrder | null>(null);
session.subscribe(value => {
  const key = `${value.token ?? ''}:${value.organizationId ?? ''}:${value.role ?? ''}`;
  receivedOrder.update(receipt => value.status === 'authenticated' && receipt?.contextKey === key ? receipt : null);
});
