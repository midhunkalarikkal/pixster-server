import "dotenv/config";

import dns from "node:dns/promises";

import { connectDB } from "./lib/db.js";
import { server } from "./lib/socket.js";
import "./app.js";

dns.setServers(["1.1.1.1", "1.0.0.1"]);

const PORT = process.env.PORT;

const startServer = async () => {
    try {
        await connectDB();

        server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();