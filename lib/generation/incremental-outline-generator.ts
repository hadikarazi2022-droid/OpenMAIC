/**
 * Incremental Outline Generator
 * 
 * Generates scene outlines one at a time instead of all at once.
 * This avoids token exhaustion and allows unlimited scenes.
 * 
 * Workflow:
 * 1. Generate a lightweight "outline structure" with just titles, types, and order
 * 2. For each outline, make individual AI calls to generate full details
 * 3. Stream outlines back incrementally to the client
 */

import { nanoid } from 'nanoid';
import type {
  UserRequirements,
  SceneOutline,
  PdfImage,
  ImageMapping,
} from '@/lib/types/generation';
import { buildPrompt, PROMPT_IDS } from '@/lib/prompts';
import { parseJsonResponse } from './json-repair';
import type { AICallFn, GenerationResult, GenerationCallbacks } from './pipeline-types';
import { createLogger } from '@/lib/logger';

const log = createLogger('IncrementalOutlineGen');

interface OutlineTemplate {
  id: string;
  type: 'slide' | 'quiz' | 'interactive' | 'pbl';
  title: string;
  order: number;
  description?: string;
  estimatedDurationSeconds?: number;
}

/**
 * Step 1: Generate lightweight outline structure (one call, returns list of ~50 outline templates)
 * 
 * System prompt: "Generate a concise list of scene titles, types, and order (JSON array)"
 * This is fast and won't hit token limits even for 50+ scenes
 */
export async function generateOutlineStructure(
  requirements: UserRequirements,
  aiCall: AICallFn,
  callbacks?: GenerationCallbacks,
): Promise<GenerationResult<OutlineTemplate[]>> {
  try {
    callbacks?.onProgress?.({
      currentStage: 1,
      overallProgress: 10,
      stageProgress: 10,
      statusMessage: '正在生成场景结构...',
      scenesGenerated: 0,
      totalScenes: 0,
    });

    const prompts = buildPrompt(PROMPT_IDS.REQUIREMENTS_TO_OUTLINES, {
      requirement: requirements.requirement,
      pdfContent: 'None',
      availableImages: 'None',
      userProfile: '',
      hasSourceImages: false,
      imageEnabled: false,
      videoEnabled: false,
      mediaEnabled: false,
      researchContext: 'None',
      teacherContext: '',
    });

    if (!prompts) {
      return { success: false, error: 'Prompt template not found' };
    }

    // Modify system prompt to request lightweight structure only
    const lightweightSystemPrompt = `${prompts.system}

IMPORTANT: For this step, generate a MINIMAL JSON array response with only:
- id (scene_1, scene_2, etc.)
- type (slide, quiz, interactive, or pbl)  
- title
- order
- estimatedDurationSeconds (optional)

Do NOT include description, keyPoints, quizConfig, etc. - those come later.
Return ONLY a JSON array, no wrapper object needed.
Example: [{"id":"scene_1","type":"slide","title":"Introduction","order":1}]`;

    const response = await aiCall(lightweightSystemPrompt, prompts.user);
    const parsed = parseJsonResponse<OutlineTemplate[]>(response);

    if (!Array.isArray(parsed)) {
      return { success: false, error: 'Failed to parse outline structure' };
    }

    // Enrich with IDs if missing
    const enriched = parsed.map((outline, index) => ({
      ...outline,
      id: outline.id || `scene_${index + 1}`,
      order: outline.order ?? index + 1,
    }));

    callbacks?.onProgress?.({
      currentStage: 1,
      overallProgress: 20,
      stageProgress: 100,
      statusMessage: `已生成 ${enriched.length} 个场景结构`,
      scenesGenerated: 0,
      totalScenes: enriched.length,
    });

    return { success: true, data: enriched };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Step 2: Expand each outline template into full SceneOutline
 * 
 * For each template, generate:
 * - description
 * - keyPoints (3-5 items)
 * - quizConfig (if type === 'quiz')
 * - widgetType + widgetOutline (if type === 'interactive')
 * - pblConfig (if type === 'pbl')
 * 
 * Each call is small and fast.
 */
export async function expandOutlineTemplate(
  template: OutlineTemplate,
  requirement: string,
  allTemplates: OutlineTemplate[], // For context
  aiCall: AICallFn,
  languageDirective?: string,
): Promise<SceneOutline | null> {
  try {
    const contextTitles = allTemplates.map((t) => t.title).join('\n');

    const expandPrompt = buildPrompt(PROMPT_IDS.REQUIREMENTS_TO_OUTLINES, {
      requirement,
      pdfContent: 'None',
      availableImages: 'None',
      userProfile: '',
      hasSourceImages: false,
      imageEnabled: false,
      videoEnabled: false,
      mediaEnabled: false,
      researchContext: 'None',
      teacherContext: '',
    });

    if (!expandPrompt) {
      return null;
    }

    const systemPrompt = `You are expanding a scene outline template into full details.

Current scene: "${template.title}" (Type: ${template.type})
Full course outline (for context):
${contextTitles}

${languageDirective ? `Language directive: ${languageDirective}` : ''}

Generate ONLY a JSON object with these fields:
{
  "id": "${template.id}",
  "type": "${template.type}",
  "title": "${template.title}",
  "order": ${template.order},
  "description": "1-2 sentences describing the teaching purpose",
  "keyPoints": ["point1", "point2", "point3"],
  ${template.type === 'quiz' ? '"quizConfig": {"questionCount": 2, "difficulty": "medium", "questionTypes": ["single", "multiple"]},' : ''}
  ${template.type === 'interactive' ? '"widgetType": "simulation|diagram|code|game|visualization3d", "widgetOutline": {...},' : ''}
  ${template.type === 'pbl' ? '"pblConfig": {"projectTopic": "...", "projectDescription": "...", "targetSkills": [...], "issueCount": 3},' : ''}
  "estimatedDuration": ${template.estimatedDurationSeconds || 120}
}

Return ONLY the JSON object, no markdown or wrapper.`;

    const userPrompt = `Expand this scene outline:
Title: ${template.title}
Type: ${template.type}
Context: This is scene ${template.order} of the course about "${requirement.substring(0, 100)}"`;

    const response = await aiCall(systemPrompt, userPrompt);
    const parsed = parseJsonResponse<SceneOutline>(response);

    if (parsed && parsed.id && parsed.type) {
      return parsed;
    }

    return null;
  } catch (error) {
    log.warn(`Failed to expand outline template ${template.id}:`, error);
    return null;
  }
}

/**
 * Full incremental generation flow:
 * 1. Generate outline structure (one call)
 * 2. For each template, expand to full outline (N calls, one per scene)
 * 3. Stream each completed outline back to caller
 */
export async function* generateOutlinesIncrementally(
  requirements: UserRequirements,
  aiCall: AICallFn,
  callbacks?: GenerationCallbacks,
  languageDirective?: string,
): AsyncGenerator<SceneOutline, void, unknown> {
  try {
    // Step 1: Get lightweight structure
    const structureResult = await generateOutlineStructure(requirements, aiCall, callbacks);
    if (!structureResult.success || !structureResult.data) {
      throw new Error(structureResult.error || 'Failed to generate outline structure');
    }

    const templates = structureResult.data;
    log.info(`Generated ${templates.length} outline templates`);

    // Step 2: Expand each template incrementally
    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];

      callbacks?.onProgress?.({
        currentStage: 2,
        overallProgress: 20 + Math.floor(((i + 1) / templates.length) * 30),
        stageProgress: Math.floor(((i + 1) / templates.length) * 100),
        statusMessage: `正在展开场景大纲: ${template.title} (${i + 1}/${templates.length})`,
        scenesGenerated: i,
        totalScenes: templates.length,
      });

      const expanded = await expandOutlineTemplate(
        template,
        requirements.requirement,
        templates,
        aiCall,
        languageDirective,
      );

      if (expanded) {
        yield expanded;
      } else {
        log.warn(`Failed to expand template: ${template.id}`);
        // Fallback: yield template as minimal outline
        yield {
          ...template,
          description: `Scene: ${template.title}`,
          keyPoints: ['Content pending'],
        } as SceneOutline;
      }
    }
  } catch (error) {
    log.error('Incremental outline generation failed:', error);
    throw error;
  }
}
