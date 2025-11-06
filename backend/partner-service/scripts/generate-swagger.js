#!/usr/bin/env node

import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { fileURLToPath } from "url";
import swaggerSpecs from "../docs/swagger.config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generateSwaggerJSON() {
  try {
    // Ensure docs/api directory exists
    await mkdir("./docs/api", { recursive: true });

    // Write swagger specs to JSON file
    const swaggerJSON = JSON.stringify(swaggerSpecs, null, 2);
    await writeFile("./docs/api/swagger.json", swaggerJSON);

    console.log("✅ Swagger JSON documentation generated successfully!");
    console.log("📁 File: docs/api/swagger.json");
    console.log(
      `📊 Endpoints documented: ${Object.keys(swaggerSpecs.paths || {}).length}`,
    );
  } catch (error) {
    console.error("❌ Error generating Swagger JSON:", error.message);
    process.exit(1);
  }
}

generateSwaggerJSON();
