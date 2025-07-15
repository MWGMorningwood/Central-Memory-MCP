/**
 * Relation type definitions for enhanced relationship categorization
 */

export type PreferenceRelationType = 'prefers' | 'dislikes' | 'interested_in';
export type InteractionRelationType = 'asked_about' | 'discussed_with' | 'learned_from';
export type TemporalRelationType = 'before' | 'after' | 'caused_by';
export type ContextualRelationType = 'in_context_of' | 'related_to_project';
export type ExpertiseRelationType = 'expert_in' | 'learning' | 'teaches';
export type TechnicalRelationType = 'built_with' | 'depends_on' | 'implements';

export type EnhancedRelationType = 
  | PreferenceRelationType 
  | InteractionRelationType 
  | TemporalRelationType 
  | ContextualRelationType
  | ExpertiseRelationType
  | TechnicalRelationType;
