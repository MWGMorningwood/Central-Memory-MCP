/**
 * Temporal query types for time-based operations
 */

import { Entity, Relation } from './core.js';

export interface TemporalQuery {
  startTime?: string;
  endTime?: string;
  entityName?: string;
  relationType?: string;
  userId?: string;
}

export interface TemporalResult {
  entities: (Entity & { actionType: 'created' | 'updated' })[];
  relations: (Relation & { actionType: 'created' })[];
  timeRange: { start: string; end: string };
}

export interface TemporalEventsResult {
  entities: (Entity & { actionType: 'created' | 'updated' })[];
  relations: (Relation & { actionType: 'created' | 'updated' })[];
}
