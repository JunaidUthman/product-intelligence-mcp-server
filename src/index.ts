import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema 
} from "@modelcontextprotocol/sdk/types.js";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const prisma = new PrismaClient();
const app = express();
app.use(cors());
// Do NOT use express.json() globally as it consumes the request stream
// which SSEServerTransport needs.

// Zod schemas for tool input validation
const SearchProductsSchema = z.object({
  max_price: z.number().optional(),
  category: z.string().optional(),
  min_rating: z.number().optional(),
  store: z.string().optional(),
  query: z.string().optional(),
  limit: z.number().optional(), // How many results to return (default 10, max 100)
});

// Maps common user terms to database category values
const CATEGORY_ALIASES: Record<string, string[]> = {
  phones: ["phones", "phone", "mobile", "smartphone", "mobiles"],
  pcs: ["pcs", "pc", "laptop", "laptops", "computer", "computers", "notebook"],
  chargers: ["chargers", "charger", "cable", "cables", "accessory", "accessories", "accessoire"],
};

/**
 * Resolves a user-facing category term (e.g. "laptops") to the DB category
 * values it maps to (e.g. ["pcs"]). Returns an array for use in Prisma `in`.
 */
function resolveCategoryFilter(userCategory: string): string[] {
  const lower = userCategory.toLowerCase();
  for (const [dbCat, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (aliases.includes(lower)) {
      return [dbCat];
    }
  }
  // Fallback: pass the raw value through as-is
  return [userCategory];
}

const GetProductByIdSchema = z.object({
  product_id: z.union([z.string(), z.number()]),
});

/**
 * Creates and configures a fresh MCP Server instance.
 * A new instance must be created for each SSE connection because
 * the SDK's Server class cannot be reused across connections.
 */
function createMcpServer(): Server {
  const server = new Server(
    {
      name: "product-intelligence-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register Tool List
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "search_products",
          description: "Searches the database for products. Category aliases are supported: use 'phones' for phones/mobiles, 'pcs' or 'laptops' for PCs and laptops, 'chargers' for chargers and accessories. Use the 'limit' parameter to control how many results to return (default 10, max 100). Returns up to 'limit' results.",
          inputSchema: {
            type: "object",
            properties: {
              max_price: { type: "number", description: "Maximum price in USD" },
              category: { type: "string", description: "Product category. Accepted values: 'phones', 'pcs', 'laptops', 'chargers', 'computers'" },
              min_rating: { type: "number", description: "Minimum star rating" },
              store: { type: "string", description: "Filter by store name (e.g. Amazon, eBay)" },
              query: { type: "string", description: "Search term for product name" },
              limit: { type: "number", description: "Number of results to return (default: 10, max: 100)" },
            },
          },
        },
        {
          name: "get_product_by_id",
          description: "Fetches complete details for a single product using its internal database ID.",
          inputSchema: {
            type: "object",
            properties: {
              product_id: { type: "number", description: "The unique database ID of the product" },
            },
            required: ["product_id"],
          },
        },
      ],
    };
  });

  // Handle Tool Calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    console.log(`[Tool Call] ${name}`, args);

    try {
      if (name === "search_products") {
        const validated = SearchProductsSchema.parse(args);
        const limit = Math.min(validated.limit ?? 10, 100); // cap at 100

        // Build category filter using alias resolution
        const categoryFilter = validated.category
          ? { in: resolveCategoryFilter(validated.category) }
          : undefined;

        const products = await prisma.scraped_products.findMany({
          where: {
            // Use `in` with resolved aliases so "laptops" maps to "pcs"
            ...(categoryFilter ? { categorie: categoryFilter } : {}),
            ...(validated.store ? { boutique: { contains: validated.store } } : {}),
            ...(validated.query ? { nom: { contains: validated.query } } : {}),
            ...(validated.max_price || validated.min_rating
              ? {
                  product_scores: {
                    some: {
                      ...(validated.max_price ? { prix_usd: { lte: validated.max_price } } : {}),
                      ...(validated.min_rating ? { note_etoiles: { gte: validated.min_rating } } : {}),
                    },
                  },
                }
              : {}),
          },
          include: {
            product_scores: {
              orderBy: { id: "desc" },
              take: 1,
            },
          },
          take: limit,
        });

        console.log(`[search_products] Found ${products.length} products (limit=${limit})`);
        return {
          content: [{ type: "text", text: JSON.stringify(products, null, 2) }],
        };
      }

      if (name === "get_product_by_id") {
        const validated = GetProductByIdSchema.parse(args);
        const id = typeof validated.product_id === "string"
          ? parseInt(validated.product_id)
          : validated.product_id;

        const product = await prisma.scraped_products.findUnique({
          where: { id },
          include: {
            product_scores: {
              orderBy: { id: "desc" },
              take: 5,
            },
          },
        });

        if (!product) {
          return {
            content: [{ type: "text", text: `Product with ID ${id} not found.` }],
            isError: true,
          };
        }

        console.log(`[get_product_by_id] Found: ${product.nom}`);
        return {
          content: [{ type: "text", text: JSON.stringify(product, null, 2) }],
        };
      }

      throw new Error(`Unknown tool: ${name}`);
    } catch (error: any) {
      console.error(`[Tool Error] ${name}:`, error.message);
      return {
        content: [{ type: "text", text: error.message }],
        isError: true,
      };
    }
  });

  return server;
}

// Track active transports by session ID for proper routing
const activeTransports = new Map<string, SSEServerTransport>();

app.get("/sse", async (req, res) => {
  console.log("New SSE connection established");

  // Create a fresh server + transport for this connection
  const server = createMcpServer();
  const transport = new SSEServerTransport("/messages", res);

  // Store transport by its session ID so POST /messages can route correctly
  const sessionId = transport.sessionId;
  activeTransports.set(sessionId, transport);
  console.log(`Session started: ${sessionId}`);

  // Clean up when the client disconnects
  res.on("close", () => {
    console.log(`Session closed: ${sessionId}`);
    activeTransports.delete(sessionId);
  });

  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  // The sessionId is passed as a query param by the MCP SDK client
  const sessionId = req.query.sessionId as string;

  if (!sessionId) {
    res.status(400).send("Missing sessionId query parameter");
    return;
  }

  const transport = activeTransports.get(sessionId);
  if (!transport) {
    res.status(404).send(`No active session found for sessionId: ${sessionId}`);
    return;
  }

  await transport.handlePostMessage(req, res);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`);
  console.log(`SSE endpoint:      http://localhost:${PORT}/sse`);
  console.log(`Messages endpoint: http://localhost:${PORT}/messages`);
});
