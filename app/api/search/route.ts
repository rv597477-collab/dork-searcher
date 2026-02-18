import { NextRequest } from "next/server";
import { searchEngine } from "@/lib/engines";
import type { EngineName, SearchResultItem, SSEEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      dork,
      engines = ["duckduckgo"],
      maxResultsPerEngine = 20,
      maxPagesPerEngine = 2,
      delayBetweenRequests = 1000,
      timeout = 15,
    } = body as {
      dork: string;
      engines: EngineName[];
      maxResultsPerEngine: number;
      maxPagesPerEngine: number;
      delayBetweenRequests: number;
      timeout: number;
    };

    if (!dork) {
      return new Response(JSON.stringify({ error: "Missing dork query" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const validEngines: EngineName[] = engines.filter((e: string) =>
      ["bing", "duckduckgo", "yahoo", "ask", "yandex"].includes(e)
    ) as EngineName[];

    if (validEngines.length === 0) {
      return new Response(JSON.stringify({ error: "No valid engines selected" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // SSE streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function send(event: SSEEvent) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }

        // Run all engines in parallel
        const promises = validEngines.map(async (engine) => {
          const startTime = Date.now();
          send({ type: "engine_start", engine });

          try {
            const results = await searchEngine(
              engine,
              dork,
              maxResultsPerEngine,
              maxPagesPerEngine,
              timeout,
              delayBetweenRequests
            );

            const timeTaken = Date.now() - startTime;

            // Send results as they come in
            if (results.length > 0) {
              send({
                type: "engine_result",
                engine,
                results,
                totalFound: results.length,
              });
            }

            send({
              type: "engine_done",
              engine,
              totalFound: results.length,
              timeTaken,
            });
          } catch (err: any) {
            const timeTaken = Date.now() - startTime;
            send({
              type: "engine_error",
              engine,
              error: err.message || "Unknown error",
              timeTaken,
            });
          }
        });

        await Promise.allSettled(promises);
        send({ type: "search_complete" });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
