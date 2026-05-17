# Product Intelligence MCP Server

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/express.js-%23404d59.svg?style=flat&logo=express&logoColor=%2361DAFB)
![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=flat&logo=Prisma&logoColor=white)

A standalone microservice that exposes the core product database as intelligent tools for Large Language Models (LLMs) via the **Model Context Protocol (MCP)** using **Server-Sent Events (SSE)** transport. 

This server acts as the primary data-access layer for AI agents within the broader **Product Intelligence ecosystem**, allowing LLMs to seamlessly perform market research, price tracking, and product analysis dynamically.

---

## 📖 Architecture & Overview

This MCP Server bridges the gap between LLM applications (like Claude Desktop, custom AI assistants, or conversational interfaces) and the central `product_intelligence` MySQL database. By implementing the official `@modelcontextprotocol/sdk`, it safely exposes strictly typed database queries as "Tools."

### Key Capabilities

- **Server-Sent Events (SSE) Transport**: Uses a robust SSE architecture (`/sse` and `/messages`) to maintain persistent, bidirectional communication with MCP clients without consuming excessive connection overhead.
- **Dynamic Tool Discovery**: LLMs can autonomously query the server to understand available tools, expected parameters, and descriptions via the MCP `ListTools` capability.
- **Smart Category Aliasing**: Built-in intelligent resolution maps natural language user queries (e.g., "laptops", "mobiles") to standardized database categories (e.g., "pcs", "phones").
- **Relational Data Mapping**: Powered by Prisma ORM, it constructs rich, nested JSON responses combining base product details (`scraped_products`) with historical price and rating metrics (`product_scores`).

---

## 🛠️ Exposed MCP Tools

The server currently registers the following highly optimized tools for LLM consumption:

### 1. `search_products`
Performs an advanced, multi-parameter search across the product catalog. Returns up to the requested `limit` of products, enriched with their most recent score and pricing data.

**Supported Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `max_price` | `number` | No | Maximum price limit in USD. |
| `category` | `string` | No | Product category. Supports smart aliases (e.g., 'phones', 'pcs', 'laptops', 'chargers', 'computers', 'accessories'). |
| `min_rating` | `number` | No | Minimum star rating (0-5 scale). |
| `store` | `string` | No | Filter by specific retailer/boutique (e.g., Amazon, eBay, BestBuy). |
| `query` | `string` | No | Free-text search term applied against the product name (`nom`). |
| `limit` | `number` | No | Number of results to return (Default: 10, Max: 100). |

### 2. `get_product_by_id`
Fetches the complete, detailed profile for a single product using its internal database ID. This is especially useful for LLMs doing deep-dive analysis on a specific item.

**Supported Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `product_id` | `number` | **Yes** | The unique internal database ID of the product. |

*Note: This tool automatically includes the 5 most recent historical tracking records (`product_scores`) to allow the LLM to analyze price/rating trends over time.*

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18.x or higher recommended)
- **MySQL Database** running the `product_intelligence` schema.

### 1. Installation

Clone the repository and install the required dependencies:

```bash
cd product-intelligence-mcp
npm install
```

### 2. Database Setup (Prisma)

Generate the Prisma client to ensure strong typing against your current database schema:

```bash
npm run prisma:generate
```

*(Optional)* To inspect your database data visually, start Prisma Studio:
```bash
npm run prisma:studio
```

### 3. Running the Server

**Development Mode** (Hot-reloads / ts-node execution):
```bash
npm run dev
```

**Production Mode** (Requires build step):
```bash
npm run build
npm start
```

---

## 🔌 API Endpoints (MCP Client Integration)

Once running, the server exposes the standard endpoints required for the MCP SSE transport. Clients should connect in the following sequence:

1. **Establish SSE Connection**: 
   ```http
   GET http://localhost:3001/sse
   ```
   *(The server will return an initial event containing the Session ID and the URL for the POST endpoint)*

2. **Send JSON-RPC Messages**: 
   ```http
   POST http://localhost:3001/messages?sessionId={id}
   ```
   *(Used by the MCP client to send `CallTool`, `ListTools`, and other protocol messages)*

---

## 📂 Project Structure

```text
product-intelligence-mcp/
├── prisma/
│   └── schema.prisma       # Database schema models (scraped_products, product_scores)
├── src/
│   └── index.ts            # Main server logic, Tool definitions, Zod validation, SSE routing
├── package.json            # Scripts and dependencies
├── tsconfig.json           # TypeScript configuration
└── .env                    # Environment variables (not tracked in git)
```

## 🧠 Integration Example (Claude Desktop)

To use this server with the Claude Desktop app, add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "product-intelligence": {
      "command": "node",
      "args": ["/absolute/path/to/product-intelligence-mcp/dist/index.js"]
    }
  }
}
```
*(Ensure you have built the project with `npm run build` before using it as a local CLI MCP server, though this specific implementation is primarily designed to run as an ongoing HTTP SSE service).*
