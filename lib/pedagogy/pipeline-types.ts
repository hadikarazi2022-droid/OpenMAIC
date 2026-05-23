/**
 * Pedagogical Pipeline Types
 * 
 * Type definitions for the multi-layered pedagogical pipeline
 * inspired by Bloom's Taxonomy and advanced learning systems.
 */

// ==================== Phase 1: Multi-Source Ingestion ====================

export type SourceType = 'pdf' | 'image' | 'transcript' | 'link' | 'question';

export interface RawSourceMaterial {
  type: SourceType;
  content: string;
  metadata?: {
    fileName?: string;
    pageCount?: number;
    imageUrl?: string;
    linkUrl?: string;
  };
}

export interface ProcessedSourceStructure {
  headings: string[];
  keyFormulas: string[];
  tables: Array<{ caption?: string; data: string[][] }>;
  diagrams: Array<{ description: string; location: string }>;
  plainTextLosses: string[]; // What might be lost in conversion
  logicalSections: LogicalSection[];
}

export interface LogicalSection {
  id: string;
  title: string;
  startLine: number;
  endLine: number;
  contentType: 'explanation' | 'example' | 'definition' | 'exercise' | 'summary';
}

export interface CitationReference {
  sourceId: string;
  section: string;
  line?: number;
  quote?: string;
}

// ==================== Phase 2: Knowledge Transformation ====================

export type BloomsLevel = 
  | 'remembering'
  | 'understanding'
  | 'applying'
  | 'analyzing'
  | 'evaluating'
  | 'creating';

export interface BloomsBreakdown {
  level: BloomsLevel;
  content: string;
  citation: CitationReference;
  teachingDepth: 'surface' | 'moderate' | 'deep';
}

export interface KnowledgePoint {
  id: string;
  name: string;
  description: string;
  bloomsLevel: BloomsLevel;
  
  // Dependencies
  prerequisites: string[]; // IDs of prerequisite KPs
  
  // Common misconceptions
  misconceptions: Array<{
    misconception: string;
    correction: string;
  }>;
  
  // Spaced repetition
  reappearsIn: string[]; // Section IDs where this KP reappears
  
  // Citation
  citation: CitationReference;
}

export interface GapAnalysis {
  missingPrerequisites: KnowledgePoint[];
  potentialConfusions: Array<{
    kpId: string;
    confusion: string;
    recommendation: string;
  }>;
  suggestedReview: string[]; // KP IDs to review
}

export interface TransformedKnowledge {
  bloomsBreakdown: BloomsBreakdown[];
  knowledgePoints: KnowledgePoint[];
  gapAnalysis: GapAnalysis;
  dependencyGraph: {
    nodes: string[]; // KP IDs
    edges: Array<{ from: string; to: string }>;
  };
}

// ==================== Phase 3: Multi-Agent Artifact Generation ====================

export interface ArchitectAgentOutput {
  roadmap: StudyRoadmap;
}

export interface StudyRoadmap {
  scenes: StudyScene[];
  estimatedTotalTime: number; // minutes
  quizLocations: number[]; // Scene indices where quizzes should happen
  recapLocations: number[]; // Scene indices where recaps should happen
  deeperDiveLocations: number[]; // Scene indices for deeper dives
}

export interface StudyScene {
  id: string;
  title: string;
  module: string;
  order: number;
  dependencies: string[]; // Scene IDs this depends on
  estimatedTime: number; // minutes
  coveredKPs: string[]; // KP IDs covered in this scene
  bloomsLevels: BloomsLevel[];
}

// Content Generator Agent Outputs
export interface SlideGeneratorOutput {
  slides: SlideContent[];
}

export interface SlideContent {
  sectionId: string;
  title: string;
  bullets: string[];
  visualDescription: string; // For nanobanana 2 image generation
  citation: CitationReference;
}

export interface ScriptNarrationOutput {
  script: LectureScript;
}

export interface LectureScript {
  sectionId: string;
  conversationalText: string;
  analogies: string[];
  plainLanguageExplanations: string[];
  citation: CitationReference;
}

export interface SimulationDesignerOutput {
  simulations: SimulationElement[];
}

export interface SimulationElement {
  kpId: string;
  concept: string;
  interactionType: 'slider' | 'clickable-flowchart' | 'fill-in-blank' | 'draggable' | 'plotter';
  pseudoCode: string;
  description: string;
}

export interface MindMapGeneratorOutput {
  mindMap: MindMapNode;
}

export interface MindMapNode {
  id: string; // KP ID
  label: string;
  isCentral: boolean;
  children: MindMapNode[];
  connections: string[]; // Connected node IDs
}

// Classmate Personas
export interface ClassmatePersona {
  id: string;
  role: 'skeptic' | 'beginner' | 'high-achiever';
  voice: string;
  preloadedQuestions: ClassmateQuestion[];
}

export interface ClassmateQuestion {
  id: string;
  kpId: string;
  question: string;
  context: string;
  triggeredBy: string; // Condition that triggers this question
}

export interface MultiAgentArtifacts {
  architect: ArchitectAgentOutput;
  slideGenerator: SlideGeneratorOutput;
  scriptNarration: ScriptNarrationOutput;
  simulationDesigner: SimulationDesignerOutput;
  mindMapGenerator: MindMapGeneratorOutput;
  classmates: ClassmatePersona[];
}

// ==================== Phase 4: Live Adaptive Tutoring ====================

export interface LessonState {
  currentSceneId: string | null;
  completedKPs: string[];
  engagedKPs: string[]; // KPs the learner has interacted with
  pendingQuestions: ClassmateQuestion[];
  whiteboardHistory: WhiteboardAction[];
  conversationHistory: ConversationTurn[];
}

export interface ConversationTurn {
  id: string;
  speaker: 'teacher' | 'student' | string; // Classmate persona ID
  content: string;
  timestamp: number;
  relatedKPs: string[];
}

export interface WhiteboardAction {
  id: string;
  actionType: 'draw' | 'erase' | 'annotate';
  description: string;
  visualElements: string[];
}

export interface AdaptiveTutorResponse {
  sectionTitle: string;
  bloomsLevel: BloomsLevel;
  kpName: string;
  
  teacherScript: string;
  slideView: string[];
  mindMapSnippet: MindMapSnippet;
  classmateInterrupts: ClassmateInterrupt[];
  whiteboard: WhiteboardDescription;
  simulationIdea: SimulationDescription;
  citation: CitationReference;
}

export interface MindMapSnippet {
  snippet: string; // Text representation: "[Concept A] → [Concept B] → [Concept C]"
  relatedNodes: string[];
}

export interface WhiteboardDescription {
  description: string; // e.g., "[Whiteboard: Drawing an x-y axis, plotting a curve...]"
  elements: string[];
}

export interface SimulationDescription {
  description: string;
  pseudoCode?: string;
}

export interface ClassmateInterrupt {
  name: string;
  role: string;
  question: string;
}

// ==================== Full Pipeline State ====================

export interface PedagogicalPipelineState {
  // Phase 1
  rawSources: RawSourceMaterial[];
  processedStructures: Map<string, ProcessedSourceStructure>;
  
  // Phase 2
  transformedKnowledge: TransformedKnowledge | null;
  
  // Phase 3
  artifacts: MultiAgentArtifacts | null;
  
  // Phase 4
  lessonState: LessonState | null;
  
  // Metadata
  createdAt: number;
  updatedAt: number;
}

export interface PipelineProgress {
  phase: 1 | 2 | 3 | 4;
  subStep: string;
  progress: number; // 0-100
  statusMessage: string;
}
