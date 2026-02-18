import { NextRequest } from "next/server";

interface ExportItem {
  title: string;
  url: string;
  snippet: string;
  engine: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { results, format } = body as {
      results: ExportItem[];
      format: "csv" | "json" | "txt";
    };

    if (!results || !format) {
      return new Response(JSON.stringify({ error: "Missing results or format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let content: string;
    let contentType: string;
    let filename: string;

    switch (format) {
      case "csv": {
        const escapeCsv = (s: string) => `"${s.replace(/"/g, '""')}"`;
        const header = "Title,URL,Snippet,Engine";
        const rows = results.map(
          (r) =>
            `${escapeCsv(r.title)},${escapeCsv(r.url)},${escapeCsv(r.snippet)},${escapeCsv(r.engine)}`
        );
        content = [header, ...rows].join("\n");
        contentType = "text/csv";
        filename = "dork-results.csv";
        break;
      }
      case "json": {
        content = JSON.stringify(results, null, 2);
        contentType = "application/json";
        filename = "dork-results.json";
        break;
      }
      case "txt": {
        content = results.map((r) => r.url).join("\n");
        contentType = "text/plain";
        filename = "dork-results.txt";
        break;
      }
      default:
        return new Response(JSON.stringify({ error: "Invalid format" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
    }

    return new Response(content, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Export failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
