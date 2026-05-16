# Product Intelligence MCP Server

A standalone microservice that exposes your product database as tools for LLMs via the Model Context Protocol (MCP) using SSE transport.

## Prerequisites
- Node.js (v18+)
- MySQL database running with the `product_intelligence` schema.

## Setup Instructions

1. **Install Dependencies**:
   ```bash
   cd product-intelligence-mcp
   npm install
   ```

2. **Configure Database**:
   Ensure your `.env` file has the correct `DATABASE_URL`.

3. **Generate Prisma Client**:
   ```bash
   npm run prisma:generate
   ```

4. **Build the Project**:
   ```bash
   npm run build
   ```

5. **Run the Server**:
   ```bash
   # Development mode (with auto-reload)
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints
- **SSE Connection**: `GET http://localhost:3001/sse`
- **Messages**: `POST http://localhost:3001/messages`

## Tools Exposed
- `search_products`: Search with filters like `max_price`, `category`, `min_rating`, and `query`.
- `get_product_by_id`: Fetch full details of a specific product using its ID.
