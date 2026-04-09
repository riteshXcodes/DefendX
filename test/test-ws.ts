const ws = new WebSocket("ws://localhost:3000");

ws.onopen = () => {
    console.log("Connected to WS server");
};

ws.onmessage = (event) => {
    console.log("Received:", event.data);
};

ws.onerror = (err) => {
    console.error("WS Error:", err);
};

ws.onclose = () => {
    console.log("Disconnected");
};