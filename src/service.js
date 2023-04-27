const path = require("path");
const Service = require('node-windows').Service;

const absolutePath = path.join(__dirname, "rpc.js");
console.log(`Assuming path will be: ${absolutePath}`);

const service = new Service({
    name: "MuseScore | Discord Rich Presence",
    description: "Automatically starts the RPC script whenever the machine is booted up",
    script: absolutePath,
});

service.once("install", () => {
    console.log("Service installed!");
    service.start();
});

service.install();