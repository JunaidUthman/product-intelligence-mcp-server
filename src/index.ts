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

// Initialize MCP Server
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

// Define Tools
const SearchProductsSchema = z.object({
  max_price: z.number().optional(),
  category: z.string().optional(),
  min_rating: z.number().optional(),
  store: z.string().optional(),
  query: z.string().optional(),
});

const GetProductByIdSchema = z.object({
  product_id: z.union([z.string(), z.number()]),
});

// Register Tool List
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_products",
        description: "Searches the database for products based on price, category, rating, and keywords. Returns up to 10 results.",
        inputSchema: {
          type: "object",
          properties: {
            max_price: { type: "number", description: "Maximum price in USD" },
            category: { type: "string", description: "Product category" },
            min_rating: { type: "number", description: "Minimum star rating" },
            store: { type: "string", description: "Filter by store name (e.g. Amazon, eBay)" },
            query: { type: "string", description: "Search term for product name or description" }
          }
        },
      },
      {
        name: "get_product_by_id",
        description: "Fetches complete details for a single product using its internal database ID.",
        inputSchema: {
          type: "object",
          properties: {
            product_id: { type: "number", description: "The unique database ID of the product" }
          },
          required: ["product_id"]
        },
      },
    ],
  };
});

// Handle Tool Calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  console.log(`Received tool call: ${name}`, args);

  try {
    if (name === "search_products") {
      const validated = SearchProductsSchema.parse(args);
      console.log("Searching products with criteria:", validated);
      
      const products = await prisma.scraped_products.findMany({
        where: {
          categorie: validated.category,
          boutique: validated.store,
          nom: validated.query ? { contains: validated.query } : undefined,
          product_scores: {
            some: {
              prix_usd: validated.max_price ? { lte: validated.max_price } : undefined,
              note_etoiles: validated.min_rating ? { gte: validated.min_rating } : undefined,
            }
          }
        },
        include: {
          product_scores: {
            orderBy: { id: 'desc' },
            take: 1
          }
        },
        take: 10
      });
      console.log(`Found ${products.length} products`);

      return {
        content: [{ type: "text", text: JSON.stringify(products, null, 2) }],
      };
    }

    if (name === "get_product_by_id") {
      const validated = GetProductByIdSchema.parse(args);
      const id = typeof validated.product_id === "string" ? parseInt(validated.product_id) : validated.product_id;
      console.log(`Fetching product with ID: ${id}`);

      const product = await prisma.scraped_products.findUnique({
        where: { id },
        include: {
          product_scores: {
            orderBy: { id: 'desc' },
            take: 5
          }
        }
      });

      if (!product) {
        console.log(`Product ${id} not found`);
        return {
          content: [{ type: "text", text: `Product with ID ${id} not found.` }],
          isError: true
        };
      }
      console.log(`Product ${id} found: ${product.nom}`);

      return {
        content: [{ type: "text", text: JSON.stringify(product, null, 2) }],
      };
    }

    throw new Error(`Tool not found: ${name}`);
  } catch (error: any) {
    console.error("Tool execution error:", error);
    return {
      content: [{ type: "text", text: error.message }],
      isError: true,
    };
  }
});

// SSE Transport setup
let transport: SSEServerTransport | null = null;

app.get("/sse", async (req, res) => {
  console.log("New SSE connection established");
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  if (!transport) {
    res.status(400).send("No SSE connection established");
    return;
  }
  await transport.handlePostMessage(req, res);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`Messages endpoint: http://localhost:${PORT}/messages`);
});
