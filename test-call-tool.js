async function testCallTool() {
    const port = 3001;
    const baseUrl = `http://localhost:${port}`;

    console.log("Connecting to SSE...");
    const sseResponse = await fetch(`${baseUrl}/sse`);
    
    // Read the first chunk to get the sessionId
    const reader = sseResponse.body.getReader();
    const { value } = await reader.read();
    const sseText = new TextDecoder().decode(value);
    
    const match = sseText.match(/sessionId=([a-zA-Z0-9-]+)/);
    if (!match) {
        console.log("Full response:", sseText);
        return;
    }
    const sessionId = match[1];
    console.log(`Established session: ${sessionId}`);

    // Call the get_product_by_id tool
    const toolCall = {
        jsonrpc: "2.0",
        id: "1",
        method: "tools/call",
        params: {
            name: "get_product_by_id",
            arguments: {
                product_id: 365
            }
        }
    };

    console.log("Calling tool: get_product_by_id...");
    const response = await fetch(`${baseUrl}/messages?sessionId=${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toolCall)
    });

    console.log("POST Status:", response.status);
    if (!response.ok) {
        console.log("POST Error:", await response.text());
    }

    // Now read the next event from SSE which should be the tool result
    console.log("Waiting for result on SSE...");
    const { value: resultValue } = await reader.read();
    console.log("Result received!");
    console.log(new TextDecoder().decode(resultValue));
}

testCallTool();
