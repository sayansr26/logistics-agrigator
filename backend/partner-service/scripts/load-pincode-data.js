/**
 * Load Pincode Data Script
 *
 * This script processes the raw IN.txt file and generates merged_pincode_data.csv
 * by running the Python merge script that combines GeoNames and India Post data.
 *
 * Prerequisites:
 * - Python 3 installed
 * - pandas library installed (pip install pandas)
 * - IN.txt file in pincode-api directory
 * - All_India_Pincode_directory.csv in pincode-api directory (if available)
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const logger = require("../shared/lib/logger");

const PINCODE_API_DIR = path.join(__dirname, "../pincode-api");
const MERGE_SCRIPT = path.join(PINCODE_API_DIR, "merge_pincode_data_simple.py");
const DATA_DIR = path.join(__dirname, "../data");
const OUTPUT_CSV = path.join(DATA_DIR, "merged_pincode_data.csv");

/**
 * Check if required files exist
 */
function checkPrerequisites() {
  const requiredFiles = [
    { path: path.join(PINCODE_API_DIR, "IN.txt"), name: "IN.txt" },
    { path: MERGE_SCRIPT, name: "merge_pincode_data_simple.py" },
  ];

  const missing = requiredFiles.filter((file) => !fs.existsSync(file.path));

  if (missing.length > 0) {
    logger.error("❌ Missing required files:");
    missing.forEach((file) => logger.error(`   - ${file.name}`));
    return false;
  }

  return true;
}

/**
 * Ensure data directory exists
 */
function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    logger.info(`✅ Created data directory: ${DATA_DIR}`);
  }
}

/**
 * Run Python merge script
 */
function runMergeScript() {
  return new Promise((resolve, reject) => {
    logger.info("🚀 Starting pincode data processing...");
    logger.info(`📁 Working directory: ${PINCODE_API_DIR}`);

    const python = spawn("python3", [MERGE_SCRIPT], {
      cwd: PINCODE_API_DIR,
      stdio: "pipe",
    });

    let output = "";
    let errorOutput = "";

    python.stdout.on("data", (data) => {
      const message = data.toString().trim();
      if (message) {
        console.log(message);
        output += message + "\n";
      }
    });

    python.stderr.on("data", (data) => {
      const message = data.toString().trim();
      if (message) {
        console.error(message);
        errorOutput += message + "\n";
      }
    });

    python.on("close", (code) => {
      if (code === 0) {
        logger.info("✅ Python merge script completed successfully");

        // Move CSV to data directory if it was created in pincode-api
        const sourceCSV = path.join(PINCODE_API_DIR, "merged_pincode_data.csv");
        if (fs.existsSync(sourceCSV)) {
          fs.copyFileSync(sourceCSV, OUTPUT_CSV);
          logger.info(`✅ CSV moved to: ${OUTPUT_CSV}`);
        }

        resolve(output);
      } else {
        logger.error(`❌ Python script failed with code ${code}`);
        if (errorOutput) {
          logger.error("Error output:", errorOutput);
        }
        reject(new Error(`Python script exited with code ${code}`));
      }
    });

    python.on("error", (error) => {
      logger.error("❌ Failed to start Python script:", error.message);
      logger.error("Make sure Python 3 is installed and available in PATH");
      reject(error);
    });
  });
}

/**
 * Verify output CSV
 */
function verifyOutput() {
  if (!fs.existsSync(OUTPUT_CSV)) {
    throw new Error(`Output CSV not found: ${OUTPUT_CSV}`);
  }

  const stats = fs.statSync(OUTPUT_CSV);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  logger.info(`📊 Output file created:`);
  logger.info(`   Path: ${OUTPUT_CSV}`);
  logger.info(`   Size: ${sizeMB} MB`);

  return true;
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log("🏁 Pincode Data Loading Process");
    console.log("=".repeat(50));

    // Step 1: Check prerequisites
    logger.info("📋 Step 1: Checking prerequisites...");
    if (!checkPrerequisites()) {
      process.exit(1);
    }
    logger.info("✅ All required files found");

    // Step 2: Ensure data directory
    logger.info("\n📁 Step 2: Preparing data directory...");
    ensureDataDirectory();

    // Step 3: Run merge script
    logger.info("\n🔄 Step 3: Running Python merge script...");
    logger.info("This may take a few minutes for large datasets...");
    await runMergeScript();

    // Step 4: Verify output
    logger.info("\n🔍 Step 4: Verifying output...");
    verifyOutput();

    logger.info("\n🎉 Load process completed successfully!");
    logger.info("\n📝 Next Steps:");
    logger.info("   Run: npm run import:pincodes");
    logger.info("   This will import the CSV data into the database");
  } catch (error) {
    logger.error("❌ Load process failed:", error.message);
    console.error("\n💡 Troubleshooting Tips:");
    console.error("1. Make sure Python 3 is installed: python3 --version");
    console.error("2. Install pandas: pip install pandas");
    console.error("3. Check that IN.txt exists in pincode-api directory");
    console.error(
      "4. Verify All_India_Pincode_directory.csv exists (if required)",
    );
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { main };
