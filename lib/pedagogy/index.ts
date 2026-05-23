/**
 * Pedagogical Pipeline - Main Entry Point
 * 
 * Barrel export for the pedagogical pipeline module.
 */

// Types
export type {
  SourceType,
  RawSourceMaterial,
  ProcessedSourceStructure,
  LogicalSection,
  CitationReference,
  BloomsLevel,
  BloomsBreakdown,
  KnowledgePoint,
  GapAnalysis,
  TransformedKnowledge,
  ArchitectAgentOutput,
  StudyRoadmap,
  StudyScene,
  SlideGeneratorOutput,
  SlideContent,
  ScriptNarrationOutput,
  LectureScript,
  SimulationDesignerOutput,
  SimulationElement,
  MindMapGeneratorOutput,
  MindMapNode,
  ClassmatePersona,
  ClassmateQuestion,
  MultiAgentArtifacts,
  LessonState,
  ConversationTurn,
  WhiteboardAction,
  AdaptiveTutorResponse,
  MindMapSnippet,
  WhiteboardDescription,
  SimulationDescription,
  ClassmateInterrupt,
  PedagogicalPipelineState,
  PipelineProgress,
} from './pipeline-types';

// Prompts
export { PEDAGOGICAL_PIPELINE_PROMPTS, getPedagogicalPrompt } from './prompts';
export type { PromptId } from './prompts';

// Pipeline runner (to be implemented)
// export { runPedagogicalPipeline } from './pipeline-runner';

// Source ingestion (to be implemented)
// export { ingestSource, processSourceStructure } from './source-ingestion';

// Knowledge transformation (to be implemented)
// export { analyzeBlooms, extractKnowledgePoints, performGapAnalysis } from './knowledge-transformation';

// Artifact generation (to be implemented)
// export { generateArchitectRoadmap, generateSlideContent, generateScript, generateSimulation, generateMindMap } from './artifact-generation';

// Adaptive tutoring (to be implemented)
// export { createLessonState, handleStudentQuestion, generateAdaptiveResponse } from './adaptive-tutoring';
