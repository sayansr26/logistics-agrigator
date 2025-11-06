#!/usr/bin/env node

/**
 * Task Status Update Utility
 * Automatically counts task statuses and updates TASKS.md overall status section
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to TASKS.md (from partner-services root, go up one level)
const TASKS_FILE = path.join(__dirname, "../../TASKS.md");

/**
 * Count occurrences of a pattern in the TASKS.md file
 */
function countPattern(pattern) {
  try {
    const content = fs.readFileSync(TASKS_FILE, "utf8");
    const matches = content.match(new RegExp(pattern, "g"));
    return matches ? matches.length : 0;
  } catch (error) {
    console.error(`Error reading TASKS.md: ${error.message}`);
    return 0;
  }
}

/**
 * Generate progress bar visualization
 */
function generateProgressBar(percentage, width = 40) {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return "█".repeat(filled) + "▓".repeat(empty);
}

/**
 * Update the overall status section in TASKS.md
 */
function updateTaskStatus() {
  try {
    console.log("🔍 Counting task statuses...");

    // Count each status type
    const done = countPattern("✅ DONE");
    const inProgress = countPattern("🔄 IN_PROGRESS");
    const todo = countPattern("🆕 TODO");
    const hold = countPattern("⏸️ HOLD");
    const total = done + inProgress + todo + hold;

    console.log("📊 Task Status Counts:");
    console.log(`   ✅ DONE: ${done}`);
    console.log(`   🔄 IN_PROGRESS: ${inProgress}`);
    console.log(`   🆕 TODO: ${todo}`);
    console.log(`   ⏸️ HOLD: ${hold}`);
    console.log(`   📋 TOTAL: ${total}`);

    if (total === 0) {
      console.error("❌ No tasks found. Check TASKS.md format.");
      return;
    }

    // Calculate percentages
    const donePercent = ((done / total) * 100).toFixed(1);
    const inProgressPercent = ((inProgress / total) * 100).toFixed(1);
    const todoPercent = ((todo / total) * 100).toFixed(1);

    // Generate new status table
    const newStatusTable = `## 📈 **OVERALL PROJECT STATUS**

| Status | Count | Percentage | Progress |
|--------|-------|------------|----------|
| ✅ **COMPLETED** | ${done} | ${donePercent}% | ${generateProgressBar(parseFloat(donePercent))} |
| 🔄 **IN_PROGRESS** | ${inProgress} | ${inProgressPercent}% | ${generateProgressBar(parseFloat(inProgressPercent))} |
| 🆕 **PENDING** | ${todo} | ${todoPercent}% | ${generateProgressBar(parseFloat(todoPercent))} |`;

    console.log("\n📝 Generated status table:");
    console.log(newStatusTable);

    // Read current TASKS.md content
    const content = fs.readFileSync(TASKS_FILE, "utf8");

    // Find and replace the status section
    const statusRegex =
      /## 📈 \*\*OVERALL PROJECT STATUS\*\*[\s\S]*?(?=### 📊 \*\*WEEKLY PROGRESS\*\*)/;

    if (!statusRegex.test(content)) {
      console.error(
        "❌ Could not find OVERALL PROJECT STATUS section in TASKS.md",
      );
      console.log(
        "📋 Please manually update the status section with the generated table above.",
      );
      return;
    }

    const updatedContent = content.replace(
      statusRegex,
      newStatusTable + "\n\n",
    );

    // Write back to file
    fs.writeFileSync(TASKS_FILE, updatedContent, "utf8");

    console.log(
      "\n✅ Successfully updated TASKS.md with latest status counts!",
    );
    console.log(
      `📈 Progress: ${donePercent}% complete (${done}/${total} tasks)`,
    );
  } catch (error) {
    console.error(`❌ Error updating task status: ${error.message}`);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateTaskStatus();
}

export { updateTaskStatus, countPattern, generateProgressBar };
