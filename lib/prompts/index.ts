/**
 * Prompt System - Simplified prompt management
 *
 * Features:
 * - File-based prompt storage in templates/
 * - Snippet composition via {{snippet:name}} syntax
 * - Conditional blocks via {{#if flag}}...{{/if}} syntax
 * - Variable interpolation via {{variable}} syntax
 */

// Types
import type { PromptId } from './types';
export type { PromptId, SnippetId, LoadedPrompt } from './types';

// Loader functions
export {
  loadPrompt,
  loadSnippet,
  buildPrompt,
  interpolateVariables,
  processSnippets,
  processConditionalBlocks,
} from './loader';

// Prompt IDs constant
export const PROMPT_IDS = {
  REQUIREMENTS_TO_OUTLINES: 'requirements-to-outlines',
  INTERACTIVE_OUTLINES: 'interactive-outlines',
  WEB_SEARCH_QUERY_REWRITE: 'web-search-query-rewrite',
  SLIDE_CONTENT: 'slide-content',
  QUIZ_CONTENT: 'quiz-content',
  SLIDE_ACTIONS: 'slide-actions',
  QUIZ_ACTIONS: 'quiz-actions',
  INTERACTIVE_ACTIONS: 'interactive-actions',
  SIMULATION_CONTENT: 'simulation-content',
  DIAGRAM_CONTENT: 'diagram-content',
  CODE_CONTENT: 'code-content',
  GAME_CONTENT: 'game-content',
  VISUALIZATION3D_CONTENT: 'visualization3d-content',
  WIDGET_TEACHER_ACTIONS: 'widget-teacher-actions',
  PBL_ACTIONS: 'pbl-actions',
  AGENT_SYSTEM: 'agent-system',
  AGENT_SYSTEM_WB_TEACHER: 'agent-system-wb-teacher',
  AGENT_SYSTEM_WB_ASSISTANT: 'agent-system-wb-assistant',
  AGENT_SYSTEM_WB_STUDENT: 'agent-system-wb-student',
  DIRECTOR: 'director',
  PBL_DESIGN: 'pbl-design',
  // Pedagogical Pipeline Prompts
  PEDAGOGICAL_SOURCE_INGESTION: 'pedagogical-source-ingestion',
  PEDAGOGICAL_BLOOMS_ANALYSIS: 'pedagogical-blooms-analysis',
  PEDAGOGICAL_KNOWLEDGE_POINT_EXTRACTION: 'pedagogical-knowledge-point-extraction',
  PEDAGOGICAL_GAP_ANALYSIS: 'pedagogical-gap-analysis',
  PEDAGOGICAL_ARCHITECT_AGENT: 'pedagogical-architect-agent',
  PEDAGOGICAL_SLIDE_GENERATOR: 'pedagogical-slide-generator',
  PEDAGOGICAL_SCRIPT_NARRATION: 'pedagogical-script-narration',
  PEDAGOGICAL_SIMULATION_DESIGNER: 'pedagogical-simulation-designer',
  PEDAGOGICAL_MIND_MAP_GENERATOR: 'pedagogical-mind-map-generator',
  PEDAGOGICAL_CLASSMATE_PERSONAS: 'pedagogical-classmate-personas',
  PEDAGOGICAL_ADAPTIVE_TUTOR_RESPONSE: 'pedagogical-adaptive-tutor-response',
} as const;
