/**
 * Scene Outlines Streaming API (SSE) - Incremental Version
 *
 * Streams outline generation via Server-Sent Events using incremental generation.
 * 
 * Workflow:
 * 1. Generate lightweight outline structure (all scene titles/types)
 * 2. For each template, make individual AI calls to generate full details
 * 3. Stream each completed outline back to client
 *
 * This allows unlimited scenes without token exhaustion.
 *
 * SSE events:
 *   { type: 'languageDirective', data: string }
 *   { type: 'outline_structure', data: OutlineTemplate[], count: number }
 *   { type: 'outline', data: SceneOutline, index: number }
 *   { type: 'done', outlines: SceneOutline[], languageDirective: string }
 *   { type: 'error', error: string }
 */

import { NextRequest } from 'next/server';
import { streamLLM } from '@/lib/ai/llm';
import { buildPrompt, PROMPT_IDS } from '@/lib/prompts';
import {
  formatImageDescription,
  formatImagePlaceholder,
  buildVisionUserContent,
  uniquifyMediaElementIds,
  formatTeacherPersonaForPrompt,
} from '@/lib/generation/generation-pipeline';
import type { AgentInfo } from '@/lib/generation/generation-pipeline';
import {
  generateOutlineStructure,
  expandOutlineTemplate,
} from '@/lib/generation/incremental-outline-generator';
import { DEFAULT_LANGUAGE_DIRECTIVE } from '@/lib/generation/outline-generator';
import { MAX_PDF_CONTENT_CHARS, MAX_VISION_IMAGES } from '@/lib/constants/generation';
import { nanoid } from 'nanoid';
import type {
  UserRequirements,
  PdfImage,
  SceneOutline,
  ImageMapping,
} from '@/lib/types/generation';
import { apiError } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import { resolveModelFromRequest } from '@/lib/server/resolve-model';
const log = createLogger('Outlines Stream Incremental');

export const maxDuration = 200; // 10 minutes for incremental generation

/**
 * Extract the languageDirective from the streamed wrapper JSON.
 */
function extractLanguageDirective(buffer: string): string | null {
  const match = buffer.match(/"languageDirective"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!match) return null;
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return match[1];
  }
}

export async function POST(req: NextRequest) {
  let requirementSnippet: string | undefined;
  let resolvedModelString: string | undefined;
  try {
    const body = await req.json();

    const {
      model: languageModel,
      modelInfo,
      modelString,
      thinkingConfig,
    } = await resolveModelFromRequest(req, body);
    resolvedModelString = modelString;

    if (!body.requirements) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Requirements are required');
    }

    const { requirements, pdfText, pdfImages, imageMapping, researchContext, agents } = body as {
      requirements: UserRequirements;
      pdfText?: string;
      pdfImages?: PdfImage[];
      imageMapping?: ImageMapping;
      researchContext?: string;
      agents?: AgentInfo[];
    };
    requirementSnippet = requirements?.requirement?.substring(0, 60);

    // Build context
    const userProfileText =
      requirements.userNickname || requirements.userBio
        ? `## Student Profile\n\nStudent: ${requirements.userNickname || 'Unknown'}${requirements.userBio ? ` — ${requirements.userBio}` : ''}\n\nConsider this student's background when designing the course.\n\n---`
        : '';

    const hasVision = !!modelInfo?.capabilities?.vision;
    let availableImagesText = 'No images available';
    let visionImages: Array<{ id: string; src: string }> | undefined;

    if (pdfImages && pdfImages.length > 0) {
      if (hasVision && imageMapping) {
        const allWithSrc = pdfImages.filter((img) => imageMapping[img.id]);
        const visionSlice = allWithSrc.slice(0, MAX_VISION_IMAGES);
        const textOnlySlice = allWithSrc.slice(MAX_VISION_IMAGES);
        const noSrcImages = pdfImages.filter((img) => !imageMapping[img.id]);

        const visionDescriptions = visionSlice.map((img) => formatImagePlaceholder(img));
        const textDescriptions = [...textOnlySlice, ...noSrcImages].map((img) =>
          formatImageDescription(img),
        );
        availableImagesText = [...visionDescriptions, ...textDescriptions].join('\n');

        visionImages = visionSlice.map((img) => ({
          id: img.id,
          src: imageMapping[img.id],
          width: img.width,
          height: img.height,
        }));
      } else {
        availableImagesText = pdfImages.map((img) => formatImageDescription(img)).join('\n');
      }
    }

    const imageGenerationEnabled = req.headers.get('x-image-generation-enabled') === 'true';
    const videoGenerationEnabled = req.headers.get('x-video-generation-enabled') === 'true';
    const mediaGenerationEnabled = imageGenerationEnabled || videoGenerationEnabled;
    const hasSourceImages = (pdfImages?.length ?? 0) > 0;

    const teacherContext = formatTeacherPersonaForPrompt(agents);
    const interactiveMode = requirements.interactiveMode ?? false;
    const promptId = interactiveMode
      ? PROMPT_IDS.INTERACTIVE_OUTLINES
      : PROMPT_IDS.REQUIREMENTS_TO_OUTLINES;

    const prompts = buildPrompt(promptId, {
      requirement: requirements.requirement,
      pdfContent: pdfText ? pdfText.substring(0, MAX_PDF_CONTENT_CHARS) : 'None',
      availableImages: availableImagesText,
      researchContext: researchContext || 'None',
      hasSourceImages,
      imageEnabled: imageGenerationEnabled,
      videoEnabled: videoGenerationEnabled,
      mediaEnabled: mediaGenerationEnabled,
      teacherContext,
      userProfile: userProfileText,
    });

    if (!prompts) {
      return apiError('INTERNAL_ERROR', 500, 'Prompt template not found');
    }

    log.info(
      `Generating outlines (incremental): "${requirements.requirement.substring(0, 50)}" [model=${modelString}]`,
    );

    // AI call function
    const aiCall = async (
      systemPrompt: string,
      userPrompt: string,
      images?: Array<{ id: string; src: string }>,
    ): Promise<string> => {
      if (images?.length && hasVision) {
        const result = await streamLLM(
          {
            model: languageModel,
            system: systemPrompt,
            messages: [
              {
                role: 'user' as const,
                content: buildVisionUserContent(userPrompt, images),
              },
            ],
            maxOutputTokens: modelInfo?.outputWindow,
          },
          'scene-outlines-stream-incremental',
          thinkingConfig,
        );

        let fullText = '';
        for await (const chunk of result.textStream) {
          fullText += chunk;
        }
        return fullText;
      }

      const result = await streamLLM(
        {
          model: languageModel,
          system: systemPrompt,
          prompt: userPrompt,
          maxOutputTokens: modelInfo?.outputWindow,
        },
        'scene-outlines-stream-incremental',
        thinkingConfig,
      );

      let fullText = '';
      for await (const chunk of result.textStream) {
        fullText += chunk;
      }
      return fullText;
    };

    const encoder = new TextEncoder();
    const HEARTBEAT_INTERVAL_MS = 15_000;

    const stream = new ReadableStream({
      async start(controller) {
        let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
        const startHeartbeat = () => {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          heartbeatTimer = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(`:heartbeat\n\n`));
            } catch {
              if (heartbeatTimer) clearInterval(heartbeatTimer);
            }
          }, HEARTBEAT_INTERVAL_MS);
        };
        const stopHeartbeat = () => {
          if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
          }
        };

        try {
          startHeartbeat();

          // Step 1: Generate outline structure
          const structureResult = await generateOutlineStructure(requirements, aiCall);
          if (!structureResult.success || !structureResult.data) {
            throw new Error(structureResult.error || 'Failed to generate outline structure');
          }

          const templates = structureResult.data;
          log.info(`Generated ${templates.length} outline templates`);

          // Send structure event
          const structureEvent = JSON.stringify({
            type: 'outline_structure',
            data: templates,
            count: templates.length,
          });
          controller.enqueue(encoder.encode(`data: ${structureEvent}\n\n`));

          let languageDirective = DEFAULT_LANGUAGE_DIRECTIVE;
          const expandedOutlines: SceneOutline[] = [];

          // Step 2: Expand each template incrementally
          for (let i = 0; i < templates.length; i++) {
            const template = templates[i];

            try {
              const expanded = await expandOutlineTemplate(
                template,
                requirements.requirement,
                templates,
                aiCall,
                languageDirective,
              );

              if (expanded) {
                expandedOutlines.push(expanded);

                const event = JSON.stringify({
                  type: 'outline',
                  data: expanded,
                  index: expandedOutlines.length - 1,
                });
                controller.enqueue(encoder.encode(`data: ${event}\n\n`));

                log.info(
                  `Expanded outline ${i + 1}/${templates.length}: ${template.title}`,
                );
              } else {
                log.warn(`Failed to expand: ${template.id}`);
                // Send fallback
                const fallback: SceneOutline = {
                  ...template,
                  description: `Scene: ${template.title}`,
                  keyPoints: ['Content pending'],
                } as SceneOutline;

                expandedOutlines.push(fallback);
                const event = JSON.stringify({
                  type: 'outline',
                  data: fallback,
                  index: expandedOutlines.length - 1,
                });
                controller.enqueue(encoder.encode(`data: ${event}\n\n`));
              }
            } catch (error) {
              log.warn(`Error expanding outline ${template.id}:`, error);
              // Continue with next outline
            }
          }

          if (expandedOutlines.length > 0) {
            const uniquified = uniquifyMediaElementIds(expandedOutlines);
            const doneEvent = JSON.stringify({
              type: 'done',
              outlines: uniquified,
              languageDirective,
              count: uniquified.length,
            });
            controller.enqueue(encoder.encode(`data: ${doneEvent}\n\n`));
          } else {
            throw new Error('No outlines were generated');
          }
        } catch (error) {
          const errorEvent = JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : String(error),
          });
          controller.enqueue(encoder.encode(`data: ${errorEvent}\n\n`));
        } finally {
          stopHeartbeat();
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    log.error(
      `Outline streaming failed [requirement="${requirementSnippet ?? 'unknown'}...", model=${resolvedModelString ?? 'unknown'}]:`,
      error,
    );
    return apiError('INTERNAL_ERROR', 500, error instanceof Error ? error.message : String(error));
  }
}
