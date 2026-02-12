import { GoogleGenAI } from '@google/genai';
import { GenerationRequest, GenerationResult, ReferenceImage, ReferenceType } from '@/types';
import { fileToBase64 } from './utils';

// Correct model from Google AI Studio (Feb 2026)
const IMAGE_MODEL = 'gemini-3-pro-image-preview';

// Helper: Build overview text based on reference types
function buildOverviewText(refs: ReferenceImage[]): string {
  const charRefs = refs.filter(r => r.referenceType === 'character');
  const objRefs = refs.filter(r => r.referenceType === 'object');
  const anchorRefs = refs.filter(r => r.referenceType === 'anchor');

  let overview = `INSTRUCTION: I am providing ${refs.length} reference image(s). Generate ONE new photorealistic image based on my description below.\n\nREFERENCE IMAGE ROLES:\n`;

  let imageNum = 1;

  // Characters first (highest priority)
  for (const ref of charRefs) {
    const name = ref.label || ref.file.name.replace(/\.[^/.]+$/, '');
    overview += `- Image ${imageNum}: CHARACTER REFERENCE "${name}" → Match this person's FACE, skin tone, facial hair, and features EXACTLY in the output.\n`;
    imageNum++;
  }

  // Objects second
  for (const ref of objRefs) {
    const name = ref.label || ref.file.name.replace(/\.[^/.]+$/, '');
    overview += `- Image ${imageNum}: OBJECT REFERENCE "${name}" → The object must match this reference's design, color, texture EXACTLY.\n`;
    imageNum++;
  }

  // Anchors last
  for (const ref of anchorRefs) {
    overview += `- Image ${imageNum}: STYLE/ENVIRONMENT REFERENCE (anchor) → Extract ONLY: environment type, lighting mood, color palette. Create a COMPLETELY NEW scene inspired by this style.\n`;
    imageNum++;
  }

  overview += `\nCRITICAL RULES:\n`;

  if (charRefs.length > 0) {
    overview += `- CHARACTER faces must be the SHARPEST element. Pin-sharp eyes, clear skin texture, visible iris detail.\n`;
  }

  if (anchorRefs.length > 0) {
    overview += `- ⚠️ CRITICAL FOR STYLE/ANCHOR: This is NOT a background image. DO NOT place characters inside this image. DO NOT use it as a backdrop. DO NOT composite or blend. Create a FRESH scene that only shares the MOOD and STYLE.\n`;
  }

  overview += `- Output must be PHOTOREALISTIC. Not illustration, not cartoon, not oil painting, not digital art.\n`;
  overview += `- No extra people beyond what is described.\n`;

  return overview;
}

// Helper: Build label text for each image type
function buildImageLabel(ref: ReferenceImage, index: number, total: number): string {
  const name = ref.label || ref.file.name.replace(/\.[^/.]+$/, '');

  switch (ref.referenceType) {
    case 'character':
      return `[IMAGE ${index} of ${total}] — CHARACTER REFERENCE: "${name}"
This person's face, jawline, nose, eyes, eyebrows, skin tone, facial hair style, and hair MUST appear exactly in the generated image. Match the face from this image, not from any other attached image.`;

    case 'anchor':
      return `[IMAGE ${index} of ${total}] — STYLE/ENVIRONMENT REFERENCE (ANCHOR)

⚠️⚠️⚠️ CRITICAL - READ CAREFULLY ⚠️⚠️⚠️
This image is ONLY for style inspiration. You must:

✅ DO extract from this image:
- Type of environment (indoor/outdoor, room type, location type)
- Lighting mood and direction (soft, dramatic, natural, etc.)
- Color palette and grading
- Overall aesthetic vibe
- Camera framing style (wide, medium, close-up)

❌ DO NOT do these things:
- DO NOT use this as a background image
- DO NOT place characters INTO this image
- DO NOT composite or blend this with character references
- DO NOT recreate this exact scene
- DO NOT copy walls, furniture, or specific elements from this image
- This is NOT a backdrop - treat it as STYLE GUIDE ONLY

CORRECT APPROACH: If this shows a cozy room with warm lighting, create a DIFFERENT cozy room with similar warm lighting mood. If character refs are provided, put them in the NEW scene you create.`;

    case 'object':
      return `[IMAGE ${index} of ${total}] — OBJECT REFERENCE: "${name}"
The object in the generated image must match this reference exactly: same shape, same materials, same colors, same design details, same size proportions.`;

    default:
      return `[IMAGE ${index} of ${total}] — REFERENCE: "${name}"`;
  }
}

// Helper: Build final generation instruction with reminders
function buildFinalInstruction(prompt: string, refs: ReferenceImage[]): string {
  const hasCharacter = refs.some(r => r.referenceType === 'character');
  const hasAnchor = refs.some(r => r.referenceType === 'anchor');

  let instruction = `==================================================
NOW GENERATE THE FOLLOWING IMAGE:
==================================================

${prompt}

==================================================
FINAL REMINDERS:
==================================================
`;

  if (hasCharacter) {
    instruction += `- Character face(s) MUST match their reference image(s) exactly. Face is the SHARPEST element.
- If face doesn't match reference, the output is WRONG. This is the #1 priority.
`;
  }

  if (hasAnchor) {
    instruction += `- ⚠️ STYLE REFERENCE WARNING: The anchor/style image is NOT a background. You must CREATE a new environment inspired by its mood, NOT place characters inside that image.
- Generate a FRESH scene. Different room, different composition, different camera angle.
- If it looks like the style image with characters pasted in, you have done it WRONG.
`;
  }

  instruction += `- Output: photorealistic photograph. NOT illustration, NOT painting, NOT cartoon.
- No extra people beyond what is described.`;

  return instruction;
}

// Helper: Sort references by priority (character > object > anchor)
function sortReferencesByPriority(refs: ReferenceImage[]): ReferenceImage[] {
  const priority: Record<ReferenceType, number> = {
    character: 1,
    object: 2,
    anchor: 3,
  };

  return [...refs].sort((a, b) => priority[a.referenceType] - priority[b.referenceType]);
}

export async function generateImage(
  apiKey: string,
  request: GenerationRequest
): Promise<GenerationResult> {
  try {
    const ai = new GoogleGenAI({ apiKey });

    // Build parts array with interleaved text + images
    const parts: any[] = [];

    if (request.referenceImages && request.referenceImages.length > 0) {
      // Sort by priority: character > object > anchor
      const sortedRefs = sortReferencesByPriority(request.referenceImages);
      const total = sortedRefs.length;

      // PART 1: Overview instruction
      parts.push({ text: buildOverviewText(sortedRefs) });

      // PARTS 2-N: Label + Image pairs (interleaved)
      for (let i = 0; i < sortedRefs.length; i++) {
        const ref = sortedRefs[i];
        const base64Data = await fileToBase64(ref.file);
        const mimeType = ref.file.type || 'image/jpeg';

        // Add label text
        parts.push({ text: buildImageLabel(ref, i + 1, total) });

        // Add image
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        });
      }

      // LAST PART: Generation prompt with reminders
      parts.push({ text: buildFinalInstruction(request.prompt, sortedRefs) });
    } else {
      // No reference images - just prompt
      parts.push({ text: request.prompt });
    }

    console.log('Sending to Gemini - Total parts:', parts.length, 'Reference images:', request.referenceImages?.length || 0);

    // Config
    const config: any = {
      responseModalities: ['IMAGE', 'TEXT'],
    };

    const imageConfig: any = {};
    if (request.aspectRatio && request.aspectRatio !== 'free') {
      imageConfig.aspectRatio = request.aspectRatio;
    }
    if (request.imageSize) {
      imageConfig.imageSize = request.imageSize;
    }
    if (Object.keys(imageConfig).length > 0) {
      config.imageConfig = imageConfig;
    }

    // Single turn with all parts
    const contents = [
      {
        role: 'user',
        parts,
      },
    ];

    const response = await ai.models.generateContentStream({
      model: IMAGE_MODEL,
      config,
      contents,
    });

    const images: string[] = [];
    let textResponse = '';

    for await (const chunk of response) {
      if (!chunk.candidates?.[0]?.content?.parts) continue;

      for (const part of chunk.candidates[0].content.parts) {
        if ((part as any).inlineData) {
          const inlineData = (part as any).inlineData;
          const base64Image = `data:${inlineData.mimeType};base64,${inlineData.data}`;
          images.push(base64Image);
        } else if ((part as any).text) {
          textResponse += (part as any).text;
        }
      }
    }

    if (images.length > 0) {
      return { success: true, images };
    }

    if (textResponse) {
      return {
        success: false,
        error: `Model returned text instead of image: ${textResponse.substring(0, 150)}...`,
      };
    }

    return { success: false, error: 'No image generated. Try a different prompt.' };
  } catch (error: any) {
    return handleError(error);
  }
}

function handleError(error: any): GenerationResult {
  const message = error.message || String(error);
  console.error('Gemini error:', message);

  if (
    message.includes('429') ||
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('RESOURCE_EXHAUSTED')
  ) {
    return { success: false, error: 'RATE_LIMITED' };
  }

  if (
    message.includes('400') ||
    message.includes('401') ||
    message.includes('API_KEY_INVALID') ||
    message.includes('API key not valid') ||
    message.includes('UNAUTHENTICATED') ||
    message.includes('INVALID_ARGUMENT')
  ) {
    return { success: false, error: 'Invalid API key. Please check and try again.' };
  }

  if (
    message.includes('SAFETY') ||
    message.includes('blocked') ||
    message.includes('PROHIBITED') ||
    message.includes('harmful')
  ) {
    return { success: false, error: 'Content blocked by safety filters. Try a different prompt.' };
  }

  if (
    message.includes('404') ||
    message.includes('not found') ||
    message.includes('NOT_FOUND') ||
    message.includes('not supported')
  ) {
    return { success: false, error: 'Model not available. Please try again later.' };
  }

  return { success: false, error: message || 'Generation failed' };
}

// Helper: Mask all cells except target cell (black out others)
async function maskGridExceptCell(
  gridImage: File,
  row: number,
  col: number,
  totalRows: number,
  totalCols: number
): Promise<string | null> {
  try {
    const imageUrl = URL.createObjectURL(gridImage);
    const img = new Image();

    const loadedImage = await new Promise<HTMLImageElement>((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = loadedImage.width;
    canvas.height = loadedImage.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      URL.revokeObjectURL(imageUrl);
      return null;
    }

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cellWidth = loadedImage.width / totalCols;
    const cellHeight = loadedImage.height / totalRows;
    const sourceX = (col - 1) * cellWidth;
    const sourceY = (row - 1) * cellHeight;

    ctx.drawImage(
      loadedImage,
      sourceX, sourceY, cellWidth, cellHeight,
      sourceX, sourceY, cellWidth, cellHeight
    );

    const dataUrl = canvas.toDataURL('image/png', 1.0);
    URL.revokeObjectURL(imageUrl);
    return dataUrl;
  } catch (error) {
    console.error('Mask error:', error);
    return null;
  }
}

export async function extractGridCell(
  apiKey: string,
  gridImage: File,
  row: number,
  col: number,
  totalRows: number,
  totalCols: number,
  aspectRatio: string,
  customPrompt?: string
): Promise<GenerationResult> {
  try {
    const ai = new GoogleGenAI({ apiKey });

    console.log(`Masking grid - only cell [${row},${col}] visible from ${totalRows}x${totalCols} grid`);

    const maskedDataUrl = await maskGridExceptCell(gridImage, row, col, totalRows, totalCols);

    if (!maskedDataUrl) {
      return { success: false, error: 'Failed to mask grid' };
    }

    const maskedBase64 = maskedDataUrl.split(',')[1];

    const contents = [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              data: maskedBase64,
              mimeType: 'image/png',
            },
          },
          {
            text: `You are an image extractor. Extract the visible image and upscale it.

TASK: The input shows ONE image on a black background. Your job:
1. CROP out only the visible image (remove all black areas)
2. UPSCALE to fill the entire output canvas
3. Output should be ONLY the image content - NO black borders, NO black background

CRITICAL RULES:
- Output must FILL THE ENTIRE CANVAS - no black borders anywhere
- DO NOT show the image small with black around it
- DO NOT duplicate or repeat the image
- The output should be ONE image that fills 100% of the frame

PRESERVE EXACTLY:
- Same composition and framing
- Same colors, lighting, shadows
- Same faces, characters, objects
- Same style and aesthetic
- Remove corner number labels if any

OUTPUT: Single full-frame high-resolution image.${customPrompt ? `\n\n${customPrompt}` : ''}`,
          },
        ],
      },
    ];

    const config: any = {
      responseModalities: ['IMAGE', 'TEXT'],
    };

    const extractImageConfig: any = {
      imageSize: '2K',
    };

    if (aspectRatio && aspectRatio !== 'free') {
      extractImageConfig.aspectRatio = aspectRatio;
    }

    config.imageConfig = extractImageConfig;

    const response = await ai.models.generateContentStream({
      model: IMAGE_MODEL,
      config,
      contents,
    });

    const images: string[] = [];
    let textResponse = '';

    for await (const chunk of response) {
      if (!chunk.candidates?.[0]?.content?.parts) continue;

      for (const part of chunk.candidates[0].content.parts) {
        if ((part as any).inlineData) {
          const inlineData = (part as any).inlineData;
          const base64Image = `data:${inlineData.mimeType};base64,${inlineData.data}`;
          images.push(base64Image);
        } else if ((part as any).text) {
          textResponse += (part as any).text;
        }
      }
    }

    if (images.length > 0) {
      return { success: true, images };
    }

    if (textResponse) {
      return {
        success: false,
        error: `Model returned text: ${textResponse.substring(0, 100)}...`,
      };
    }

    return { success: false, error: 'No image generated. Try again.' };
  } catch (error: any) {
    return handleError(error);
  }
}

export async function regenerateGridCell(
  apiKey: string,
  gridImage: File,
  row: number,
  col: number,
  totalRows: number,
  totalCols: number,
  aspectRatio: string,
  customPrompt?: string
): Promise<GenerationResult> {
  return extractGridCell(
    apiKey,
    gridImage,
    row,
    col,
    totalRows,
    totalCols,
    aspectRatio,
    customPrompt
  );
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey || apiKey.length < 10) {
    return false;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: 'Say OK',
    });

    return !!response;
  } catch (error: any) {
    console.error('Key validation error:', error.message);
    return false;
  }
}
