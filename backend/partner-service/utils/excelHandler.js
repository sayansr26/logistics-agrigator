/**
 * Excel Handler Utility
 *
 * Handles Excel file parsing, template generation, and data export
 * for partner pincode assignment functionality.
 *
 * Dependencies: exceljs
 */

const ExcelJS = require("exceljs");
const logger = require("../shared/lib/logger");
const { prisma } = require("../config/database");

/**
 * Parse uploaded Excel file
 * @param {Buffer} buffer - Excel file buffer
 * @returns {Promise<Object>} Parsed data with validation results
 */
async function parseExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Excel file is empty or invalid");
  }

  // Get all active pincode types for validation
  const activePincodeTypes = await prisma.pincodeType.findMany({
    where: { isActive: true },
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });

  const pincodeTypeMap = new Map(activePincodeTypes.map((pt) => [pt.name, pt]));

  const results = {
    valid: [],
    invalid: [],
    duplicates: [],
    totalRows: 0,
  };

  const pincodeSet = new Set();

  // Skip header row, start from row 2
  const rowIndex = 1;
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    results.totalRows = rowNumber - 1;

    const pincodeCode = row.getCell(1).text?.trim();
    if (!pincodeCode) {
      return; // Skip empty rows
    }

    const rowData = {
      rowNumber,
      pincodeCode,
      values: {},
      errors: [],
    };

    // Check for duplicate pincodes
    if (pincodeSet.has(pincodeCode)) {
      rowData.errors.push("Duplicate pincode code in this file");
      results.duplicates.push(rowData);
      return;
    }
    pincodeSet.add(pincodeCode);

    // Validate pincode code format (6 digits)
    if (!/^\d{6}$/.test(pincodeCode)) {
      rowData.errors.push("Pincode must be exactly 6 digits");
    }

    // Parse pincode type values (columns 2 onwards)
    let colIndex = 2;
    for (const pincodeType of activePincodeTypes) {
      const cellValue = row.getCell(colIndex).text?.trim();

      if (!cellValue && cellValue !== "0") {
        rowData.values[pincodeType.name] = null;
        colIndex++;
        continue;
      }

      // Validate based on pincode type
      if (pincodeType.type === "yes_no") {
        const normalizedValue = cellValue.toLowerCase();
        if (
          normalizedValue !== "yes" &&
          normalizedValue !== "no" &&
          normalizedValue !== "y" &&
          normalizedValue !== "n"
        ) {
          rowData.errors.push(
            `Invalid value for ${pincodeType.name}: must be Yes/No`,
          );
        } else {
          // Normalize to yes/no
          rowData.values[pincodeType.name] = normalizedValue.startsWith("y")
            ? "yes"
            : "no";
        }
      } else if (pincodeType.type === "number") {
        const numValue = parseFloat(cellValue);
        if (isNaN(numValue)) {
          rowData.errors.push(
            `Invalid value for ${pincodeType.name}: must be a number`,
          );
        } else {
          rowData.values[pincodeType.name] = cellValue;
        }
      }

      colIndex++;
    }

    if (rowData.errors.length > 0) {
      results.invalid.push(rowData);
    } else {
      results.valid.push(rowData);
    }
  });

  logger.info("Excel file parsed", {
    totalRows: results.totalRows,
    valid: results.valid.length,
    invalid: results.invalid.length,
    duplicates: results.duplicates.length,
  });

  return results;
}

/**
 * Generate Excel template for pincode import
 * @returns {Promise<Buffer>} Excel file buffer
 */
async function generateTemplate() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Pincode Template");

  // Get all active pincode types
  const activePincodeTypes = await prisma.pincodeType.findMany({
    where: { isActive: true },
    select: { name: true, type: true },
    orderBy: { name: "asc" },
  });

  // Set column headers
  const headers = ["Pincode Code", ...activePincodeTypes.map((pt) => pt.name)];
  worksheet.addRow(headers);

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 25;

  // Set column widths
  worksheet.getColumn(1).width = 15; // Pincode Code
  activePincodeTypes.forEach((pt, index) => {
    worksheet.getColumn(index + 2).width = 15;
  });

  // Add example data row with notes
  const exampleRow = ["110001"];
  activePincodeTypes.forEach((pt) => {
    if (pt.type === "yes_no") {
      exampleRow.push("Yes");
    } else {
      exampleRow.push("3");
    }
  });
  worksheet.addRow(exampleRow);

  // Add instructions row
  const instructions = [
    "Notes:",
    "- Pincode Code: Must be exactly 6 digits",
    ...activePincodeTypes.map((pt) =>
      pt.type === "yes_no"
        ? `- ${pt.name}: Use "Yes" or "No"`
        : `- ${pt.name}: Enter a number`,
    ),
  ];
  instructions.forEach((instruction, index) => {
    worksheet.addRow([instruction]);
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();

  logger.info("Excel template generated", {
    pincodeTypes: activePincodeTypes.length,
  });

  return buffer;
}

/**
 * Export assigned pincodes to Excel
 * @param {Array} assignments - Array of pincode assignments with relations
 * @param {string} partnerName - Partner name for filename
 * @returns {Promise<Buffer>} Excel file buffer
 */
async function exportData(assignments, partnerName) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Assigned Pincodes");

  // Get all active pincode types
  const activePincodeTypes = await prisma.pincodeType.findMany({
    where: { isActive: true },
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });

  // Create pincode type map for quick lookup
  const pincodeTypeMap = new Map(
    activePincodeTypes.map((pt) => [pt.id, pt.name]),
  );

  // Set column headers
  const headers = [
    "Pincode Code",
    "City",
    "State",
    ...activePincodeTypes.map((pt) => pt.name),
    "Status",
    "Assigned Date",
  ];
  worksheet.addRow(headers);

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 25;

  // Set column widths
  const columnWidths = [
    15,
    20,
    20,
    ...activePincodeTypes.map(() => 12),
    10,
    15,
  ];
  columnWidths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });

  // Add data rows
  assignments.forEach((assignment) => {
    const pincode = assignment.pincode;
    const state = pincode.state;
    const area = pincode.area;

    // Build pincode type values
    const typeValues = {};
    if (assignment.pincodeTypeValues) {
      assignment.pincodeTypeValues.forEach((ptv) => {
        const typeName = pincodeTypeMap.get(ptv.pincodeTypeId);
        if (typeName) {
          typeValues[typeName] = ptv.value;
        }
      });
    }

    const row = [
      pincode.code,
      area?.name || pincode.areaName || "",
      state?.name || "",
      ...activePincodeTypes.map((pt) => typeValues[pt.name] || ""),
      assignment.isActive ? "Active" : "Inactive",
      new Date(assignment.createdAt).toLocaleDateString(),
    ];

    worksheet.addRow(row);
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();

  logger.info("Excel export generated", {
    partnerName,
    recordCount: assignments.length,
  });

  return buffer;
}

/**
 * Validate pincode exists in database
 * @param {string} pincodeCode - 6-digit pincode code
 * @returns {Promise<Object>} Pincode record or null
 */
async function validatePincodeExists(pincodeCode) {
  const pincode = await prisma.pincode.findUnique({
    where: { code: pincodeCode },
    select: {
      id: true,
      code: true,
      areaName: true,
      district: true,
      status: true,
      state: {
        select: { name: true },
      },
      area: {
        select: { name: true },
      },
    },
  });

  return pincode;
}

/**
 * Validate pincode type value based on type configuration
 * @param {string} pincodeTypeId - UUID of pincode type
 * @param {string} value - Value to validate
 * @returns {Promise<{isValid: boolean, error: string|null}>}
 */
async function validatePincodeTypeValue(pincodeTypeId, value) {
  const pincodeType = await prisma.pincodeType.findUnique({
    where: { id: pincodeTypeId },
    select: { id: true, name: true, type: true },
  });

  if (!pincodeType) {
    return { isValid: false, error: "Pincode type not found" };
  }

  if (pincodeType.type === "yes_no") {
    const normalized = value?.toLowerCase?.();
    if (
      normalized !== "yes" &&
      normalized !== "no" &&
      normalized !== "y" &&
      normalized !== "n" &&
      normalized !== "true" &&
      normalized !== "false"
    ) {
      return {
        isValid: false,
        error: `${pincodeType.name} must be Yes/No`,
      };
    }
  } else if (pincodeType.type === "number") {
    if (isNaN(parseFloat(value))) {
      return {
        isValid: false,
        error: `${pincodeType.name} must be a number`,
      };
    }
  }

  return { isValid: true, error: null };
}

module.exports = {
  parseExcel,
  generateTemplate,
  exportData,
  validatePincodeExists,
  validatePincodeTypeValue,
};
