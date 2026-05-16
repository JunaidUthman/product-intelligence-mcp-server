import fetch from "node-fetch";

async function testCallTool() {
    const port = 3001;
    const baseUrl = `http://localhost:${port}`;

    console.log("Connecting to SSE...");
    const sseResponse = await fetch(`${baseUrl}/sse`);
    const sseText = await sseResponse.text();
    
    // Extract sessionId from the event stream
    // Example: event: endpoint\ndata: /messages?sessionId=...
    const match = sseText.match(/sessionId=([a-zA-Z0-9-]+)/);
    if (!match) {
        console.error("Could not find sessionId in SSE response");
        console.log("Full response:", sseText);
        return;
    }

    const sessionId = match[1];
    console.log(`Established session: ${sessionId}`);

    // Call the search_products tool
    const toolCall = {
        jsonrpc: "2.0",
        id: "1",
        method: "tools/call",
        params: {
            name: "search_products",
            arguments: {
                query: "phone",
                max_price: 1000
            }
        }
    };

    console.log("Calling tool: search_products...");
    const messageUrl = `${baseUrl}/messages?sessionId=${sessionId}`;
    const response = await fetch(messageUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toolCall)
    });

    if (response.ok) {
        console.log("Tool response received!");
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } else {
        console.error("Failed to call tool:", response.status, await response.text());
    }
}

testCallTool().catch(console.error);
