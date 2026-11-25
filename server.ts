import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '25mb' }));

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return null;
  return {
    mimeType: match[1],
    data: match[2],
  };
}

function extractCleanJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function parseGeminiError(err: unknown): { status: number; message: string; retryable: boolean } {
  const rawMsg = err instanceof Error ? err.message : String(err || 'Gemini API error');
  let status = 500;
  let message = rawMsg;

  try {
    const parsed = JSON.parse(rawMsg);
    if (parsed?.error) {
      status = Number(parsed.error.code) || 500;
      message = String(parsed.error.message || rawMsg);
    }
  } catch {
    const codeMatch = rawMsg.match(/"code"\s*:\s*(\d{3})/);
    if (codeMatch) status = Number(codeMatch[1]);
    const msgMatch = rawMsg.match(/"message"\s*:\s*"([^"]+)"/);
    if (msgMatch) message = msgMatch[1];
  }

  const retryable =
    status === 503 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 504 ||
    /UNAVAILABLE|high demand|overloaded|RESOURCE_EXHAUSTED|timeout|ECONNRESET/i.test(rawMsg);

  return { status, message, retryable };
}

async function generateWithRetryAndFallback(
  ai: GoogleGenAI,
  buildRequest: (
    model: string,
    abortSignal: AbortSignal
  ) => Parameters<GoogleGenAI['models']['generateContent']>[0]
) {
  const modelAttempts: { model: string; delayMs: number }[] = [
    { model: 'gemini-4-hydrogen', delayMs: 0 },
    { model: 'gemini-3.1-flash-lite', delayMs: 300 },
  ];

  let lastErr: unknown = null;
  for (const attempt of modelAttempts) {
    if (attempt.delayMs > 0) {
      await new Promise((r) => setTimeout(r, attempt.delayMs));
    }
    const t0 = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      try {
        const res = await ai.models.generateContent(buildRequest(attempt.model, controller.signal));
        console.log(`[Gemini ${attempt.model}] succeeded in ${Date.now() - t0}ms`);
        return res;
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      lastErr = err;
      const info = parseGeminiError(err);
      console.warn(
        `[Gemini ${attempt.model}] failed in ${Date.now() - t0}ms (status=${info.status}, retryable=${info.retryable}): ${info.message}`
      );
      if (!info.retryable && !/abort/i.test(info.message)) {
        throw err;
      }
    }
  }
  throw lastErr;
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.post('/api/floor-plan/extract', async (req: Request, res: Response) => {
  try {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured in Secrets. Set it in Settings > Secrets, or upload a CAD PDF for offline embedded text extraction.',
      });
      return;
    }

    const { imageDataUrl, sheetName } = req.body as {
      imageDataUrl?: string;
      sheetName?: string;
    };

    if (!imageDataUrl) {
      res.status(400).json({ error: 'Missing imageDataUrl in request body.' });
      return;
    }

    const parsed = parseDataUrl(imageDataUrl);
    if (!parsed) {
      res.status(400).json({ error: 'Invalid base64 image data URL.' });
      return;
    }

    const prompt = `Analyze this civil architectural floor plan${sheetName ? ` (${sheetName})` : ''}.
Identify EVERY labeled room or functional space visible on the floor plan (e.g. Living Room, Bedroom, Kitchen, Toilet, Lobby, Corridor, Conference Room, Office, Staircase, Balcony, Hall, Utility, Store, etc.).
For each room, extract:
1. "roomName": exact text label written on the drawing for that room.
2. "printedDimensions": exact dimension text written inside or adjacent to the room (e.g. "12'-0\\" x 14'-6\\"", "3.60 x 4.20 m", "4500 x 3200", or "" if none printed).
3. "widthMeters": numeric width converted to meters (0 if no dimension printed). Remember 1 ft = 0.3048 m, 1000 mm = 1 m.
4. "lengthMeters": numeric length converted to meters (0 if no dimension printed).
5. "shapeHint": "rect", "polygon", or "circle" depending on the room geometry.
6. "box2d": bounding box of that room interior walls as [ymin, xmin, ymax, xmax] normalized from 0 to 1000 relative to the full image dimensions.
Return JSON matching the schema strictly. Ignore title blocks and external legends.`;

    const response = await generateWithRetryAndFallback(ai, (model, abortSignal) => ({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: parsed.mimeType,
              data: parsed.data,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        abortSignal,
        ...(model.startsWith('gemini-4')
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
          : {}),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedFloorTitle: {
              type: Type.STRING,
              description: 'Floor level or drawing title if printed on the plan, else empty string.',
            },
            rooms: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  roomName: { type: Type.STRING },
                  printedDimensions: { type: Type.STRING },
                  widthMeters: { type: Type.NUMBER },
                  lengthMeters: { type: Type.NUMBER },
                  shapeHint: { type: Type.STRING },
                  box2d: {
                    type: Type.ARRAY,
                    items: { type: Type.NUMBER },
                    description: '[ymin, xmin, ymax, xmax] normalized 0..1000',
                  },
                },
                required: ['roomName', 'printedDimensions', 'widthMeters', 'lengthMeters', 'shapeHint', 'box2d'],
              },
            },
          },
          required: ['detectedFloorTitle', 'rooms'],
        },
      },
    }));

    const rawText = extractCleanJsonText(response.text ?? '{}');
    const json = JSON.parse(rawText);
    res.json(json);
  } catch (err) {
    console.error('Error in /api/floor-plan/extract:', err);
    const info = parseGeminiError(err);
    const httpStatus = info.status >= 400 && info.status < 600 ? info.status : 500;
    res.status(httpStatus).json({ error: info.message });
  }
});

app.post('/api/floor-plan/extract-room', async (req: Request, res: Response) => {
  try {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured in Secrets. Set it in Settings > Secrets, or use a PDF with selectable text.',
      });
      return;
    }

    const { croppedImageDataUrl } = req.body as { croppedImageDataUrl?: string };
    if (!croppedImageDataUrl) {
      res.status(400).json({ error: 'Missing croppedImageDataUrl.' });
      return;
    }

    const parsed = parseDataUrl(croppedImageDataUrl);
    if (!parsed) {
      res.status(400).json({ error: 'Invalid base64 crop image URL.' });
      return;
    }

    const prompt = `This is a cropped room region from a civil architectural floor plan.
Read all text visible inside this room:
- "roomName": Clean room name / label (e.g., "Master Bedroom", "Kitchen", "Toilet-1", "Conference Room"). Empty string if no label text is legible.
- "printedDimensions": Exact dimension text printed in the room (e.g., "12'-0\\" x 14'-6\\"" or "3.6 x 4.2m"). Empty string if none.
- "widthMeters": Width in meters converted from printed dimensions (0 if none).
- "lengthMeters": Length in meters converted from printed dimensions (0 if none).
- "extractedRawText": All legible text lines joined by spaces.`;

    const response = await generateWithRetryAndFallback(ai, (model, abortSignal) => ({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: parsed.mimeType,
              data: parsed.data,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        abortSignal,
        ...(model.startsWith('gemini-4')
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
          : {}),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            roomName: { type: Type.STRING },
            printedDimensions: { type: Type.STRING },
            widthMeters: { type: Type.NUMBER },
            lengthMeters: { type: Type.NUMBER },
            extractedRawText: { type: Type.STRING },
          },
          required: ['roomName', 'printedDimensions', 'widthMeters', 'lengthMeters', 'extractedRawText'],
        },
      },
    }));

    const rawText = extractCleanJsonText(response.text ?? '{}');
    const json = JSON.parse(rawText);
    res.json(json);
  } catch (err) {
    console.error('Error in /api/floor-plan/extract-room:', err);
    const info = parseGeminiError(err);
    const httpStatus = info.status >= 400 && info.status < 600 ? info.status : 500;
    res.status(httpStatus).json({ error: info.message });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const portArgIdx = process.argv.indexOf('--port');
  const cliPort = portArgIdx >= 0 ? Number(process.argv[portArgIdx + 1]) : NaN;
  const port =
    Number.isFinite(cliPort) && cliPort > 0
      ? cliPort
      : isProd
        ? Number(process.env.PORT) || 3000
        : 3000;

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
