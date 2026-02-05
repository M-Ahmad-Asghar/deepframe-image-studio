import { GoogleGenAI } from '@google/genai';
import { GenerationRequest, GenerationResult } from '@/types';
import { fileToBase64, getMimeType } from './utils';

// Correct model from Google AI Studio (Feb 2026)
const IMAGE_MODEL = 'gemini-3-pro-image-preview';

export async function generateImage(
  apiKey: string,
  request: GenerationRequest
): Promise<GenerationResult> {
  try {
    const ai = new GoogleGenAI({ apiKey });

    // Build content parts
    const parts: any[] = [];

    // Add reference images if provided
    if (request.referenceImages && request.referenceImages.length > 0) {
      // Add text prompt FIRST with clear instructions
      parts.push({
        text: `I am attaching ${request.referenceImages.length} reference image(s). Please analyze these images carefully and use them as visual reference for style, composition, colors, and visual elements. Then generate a NEW image based on this description:\n\n${request.prompt}\n\nIMPORTANT: The generated image MUST incorporate visual elements, style, and aesthetics from the reference images I've provided.`,
      });

      // Then add all images as inlineData parts
      for (const ref of request.referenceImages) {
        const base64Data = await fileToBase64(ref.file);
        const mimeType = ref.file.type || 'image/jpeg';

        console.log('Adding reference image:', {
          name: ref.file.name,
          mimeType,
          dataLength: base64Data.length,
        });

        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        });
      }
    } else {
      parts.push({ text: request.prompt });
    }

    console.log('Sending to Gemini - Total parts:', parts.length, 'Reference images:', request.referenceImages?.length || 0);

    // Config with imageConfig for aspect ratio and size
    const config: any = {
      responseModalities: ['IMAGE', 'TEXT'],
    };

    // Add imageConfig - skip aspectRatio if 'free' (let Gemini decide)
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

    // Build contents - use multi-turn if we have reference images
    let contents: any[];

    if (request.referenceImages && request.referenceImages.length > 0) {
      // Multi-turn approach: First message with images, second with prompt
      const imageParts: any[] = [];
      for (const ref of request.referenceImages) {
        const base64Data = await fileToBase64(ref.file);
        const mimeType = ref.file.type || 'image/jpeg';
        imageParts.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        });
      }

      contents = [
        {
          role: 'user',
          parts: [
            { text: `Here are ${request.referenceImages.length} reference image(s). Please remember these for the next request:` },
            ...imageParts,
          ],
        },
        {
          role: 'model',
          parts: [{ text: `I have analyzed the ${request.referenceImages.length} reference image(s). I will use them as visual reference for style, composition, and visual elements. What would you like me to create?` }],
        },
        {
          role: 'user',
          parts: [{ text: `Using the reference images I provided, generate a new image with this description:\n\n${request.prompt}\n\nMake sure to incorporate the visual style and elements from the reference images.` }],
        },
      ];
    } else {
      contents = [
        {
          role: 'user',
          parts,
        },
      ];
    }

    // Use streaming to get the response (as per Google's example)
    const response = await ai.models.generateContentStream({
      model: IMAGE_MODEL,
      config,
      contents,
    });

    const images: string[] = [];
    let textResponse = '';

    for await (const chunk of response) {
      if (!chunk.candidates?.[0]?.content?.parts) {
        continue;
      }

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
      return {
        success: true,
        images,
      };
    }

    if (textResponse) {
      return {
        success: false,
        error: `Model returned text instead of image: ${textResponse.substring(0, 150)}...`,
      };
    }

    return {
      success: false,
      error: 'No image generated. Try a different prompt.',
    };
  } catch (error: any) {
    return handleError(error);
  }
}

// Grid Maker: Generate a grid of images with numbered cells
export async function generateGrid(
  apiKey: string,
  prompt: string,
  referenceImages: { id: string; file: File; preview: string }[],
  aspectRatio: string
): Promise<GenerationResult> {
  try {
    const ai = new GoogleGenAI({ apiKey });

    // Use user's prompt directly - no additional instructions
    const gridPrompt = prompt;

    console.log(`Generating grid with user prompt`);

    // Build contents with optional reference images
    let contents: any[];

    if (referenceImages && referenceImages.length > 0) {
      // Multi-turn with reference images
      const imageParts: any[] = [];
      for (const ref of referenceImages) {
        const base64Data = await fileToBase64(ref.file);
        const mimeType = ref.file.type || 'image/jpeg';
        imageParts.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        });
      }

      contents = [
        {
          role: 'user',
          parts: [
            { text: `Here are ${referenceImages.length} reference image(s). Use these as style/visual reference:` },
            ...imageParts,
          ],
        },
        {
          role: 'model',
          parts: [{ text: `I have analyzed the ${referenceImages.length} reference image(s). I will use them as visual reference for style, composition, and visual elements when creating the grid.` }],
        },
        {
          role: 'user',
          parts: [{ text: gridPrompt }],
        },
      ];
    } else {
      contents = [
        {
          role: 'user',
          parts: [{ text: gridPrompt }],
        },
      ];
    }

    const config: any = {
      responseModalities: ['IMAGE', 'TEXT'],
    };

    // Add imageConfig - skip aspectRatio if 'free' (let Gemini decide)
    const gridImageConfig: any = {
      imageSize: '2K', // Higher resolution for better cell extraction
    };

    if (aspectRatio && aspectRatio !== 'free') {
      gridImageConfig.aspectRatio = aspectRatio;
    }

    config.imageConfig = gridImageConfig;

    const response = await ai.models.generateContentStream({
      model: IMAGE_MODEL,
      config,
      contents,
    });

    const images: string[] = [];
    let textResponse = '';

    for await (const chunk of response) {
      if (!chunk.candidates?.[0]?.content?.parts) {
        continue;
      }

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
      return {
        success: true,
        images,
      };
    }

    if (textResponse) {
      return {
        success: false,
        error: `Model returned text: ${textResponse.substring(0, 100)}...`,
      };
    }

    return {
      success: false,
      error: 'No grid generated. Try again.',
    };
  } catch (error: any) {
    return handleError(error);
  }
}

function handleError(error: any): GenerationResult {
  const message = error.message || String(error);
  console.error('Gemini error:', message);

  // Rate limit
  if (
    message.includes('429') ||
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('RESOURCE_EXHAUSTED')
  ) {
    return { success: false, error: 'RATE_LIMITED' };
  }

  // Invalid key
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

  // Safety filter
  if (
    message.includes('SAFETY') ||
    message.includes('blocked') ||
    message.includes('PROHIBITED') ||
    message.includes('harmful')
  ) {
    return { success: false, error: 'Content blocked by safety filters. Try a different prompt.' };
  }

  // Model not found
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
// This makes Gemini see it as a single image, not a grid
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

    // Create canvas with FULL grid size
    const canvas = document.createElement('canvas');
    canvas.width = loadedImage.width;
    canvas.height = loadedImage.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      URL.revokeObjectURL(imageUrl);
      return null;
    }

    // Fill entire canvas with black
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate cell dimensions
    const cellWidth = loadedImage.width / totalCols;
    const cellHeight = loadedImage.height / totalRows;
    const sourceX = (col - 1) * cellWidth;
    const sourceY = (row - 1) * cellHeight;

    // Draw ONLY the target cell in its original position
    ctx.drawImage(
      loadedImage,
      sourceX, sourceY, cellWidth, cellHeight,  // Source: the target cell
      sourceX, sourceY, cellWidth, cellHeight   // Dest: same position (keep in place)
    );

    // Get as data URL (full quality PNG)
    const dataUrl = canvas.toDataURL('image/png', 1.0);

    URL.revokeObjectURL(imageUrl);
    return dataUrl;
  } catch (error) {
    console.error('Mask error:', error);
    return null;
  }
}

// Grid Cell Extraction: Mask approach
// Step 1: Black out all cells except target (Gemini sees single image)
// Step 2: Gemini extracts and upscales the visible cell
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

    console.log(`Step 1: Masking grid - only cell [${row},${col}] visible from ${totalRows}x${totalCols} grid`);

    // Step 1: Mask all cells except target (black out others)
    const maskedDataUrl = await maskGridExceptCell(gridImage, row, col, totalRows, totalCols);

    if (!maskedDataUrl) {
      return { success: false, error: 'Failed to mask grid' };
    }

    // Extract base64 from data URL
    const maskedBase64 = maskedDataUrl.split(',')[1];

    console.log(`Step 2: Sending masked image to Gemini for extraction`);

    // Step 2: Send masked image - Gemini will see one image on black background
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
- DO NOT show multiple versions (small/large) of same image
- The output should be ONE image that fills 100% of the frame

PRESERVE EXACTLY:
- Same composition and framing
- Same colors, lighting, shadows
- Same faces, characters, objects
- Same style and aesthetic
- Remove corner number labels if any

FORBIDDEN:
- Black borders or background in output
- Multiple copies of the image
- Image shown at different sizes
- Any modifications to the scene

OUTPUT: Single full-frame high-resolution image.${customPrompt ? `\n\n${customPrompt}` : ''}`,
          },
        ],
      },
    ];

    const config: any = {
      responseModalities: ['IMAGE', 'TEXT'],
    };

    // Add imageConfig - skip aspectRatio if 'free' (let Gemini decide)
    const extractImageConfig: any = {
      imageSize: '2K', // Higher resolution output
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
      if (!chunk.candidates?.[0]?.content?.parts) {
        continue;
      }

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
      return {
        success: true,
        images,
      };
    }

    if (textResponse) {
      return {
        success: false,
        error: `Model returned text: ${textResponse.substring(0, 100)}...`,
      };
    }

    return {
      success: false,
      error: 'No image generated. Try again.',
    };
  } catch (error: any) {
    return handleError(error);
  }
}

// Regenerate cell with custom prompt - uses same multi-turn approach
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
  // Use the same full-grid approach as extractGridCell
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

    // Simple validation with a basic model
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
