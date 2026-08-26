/**
 * Tests for the dependency-free CSV parser.
 *
 * Covers the new UPI/QR settlement path plus a regression guard on the existing
 * COD path (whose behaviour production importers depend on).
 */

const {
  parseCsvCollections,
  parseCsvQrCollections,
  QR_FIELD_ALIASES,
} = require("./csvParser");

describe("parseCsvQrCollections - header alias resolution", () => {
  it("resolves a bank-style header spelling", () => {
    const csv = [
      "UTR,Amount,QR ID,VPA,Payer Name,Txn Date,Order ID",
      "AXISU123,1499.00,STORE-42,ram@okhdfc,Ram Kumar,01/02/2026,ORD-9",
    ].join("\n");

    const { rows, errors } = parseCsvQrCollections(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      utr: "AXISU123",
      amountPaise: 149900,
      qrIdentifier: "STORE-42",
      payerVpa: "ram@okhdfc",
      payerName: "Ram Kumar",
      txnAt: new Date(2026, 1, 1, 0, 0, 0),
      providerTxnId: "ORD-9",
    });
  });

  it("resolves a PSP-style header spelling", () => {
    const csv = [
      "Bank RRN,Transaction Amount,Sub Merchant ID,Customer VPA,Remitter Name,Value Date,CCAvenue Reference No",
      "rrn0099,250,SUBM-7,a@ybl,Asha,2026-02-01 10:30:00,CC-77",
    ].join("\n");

    const { rows, errors } = parseCsvQrCollections(csv);
    expect(errors).toEqual([]);
    expect(rows[0].utr).toBe("RRN0099");
    expect(rows[0].amountPaise).toBe(25000);
    expect(rows[0].qrIdentifier).toBe("SUBM-7");
    expect(rows[0].providerTxnId).toBe("CC-77");
    expect(rows[0].txnAt).toEqual(new Date(2026, 1, 1, 10, 30, 0));
  });

  it("resolves header spellings with underscores and mixed case", () => {
    const csv = ["UPI_Txn_Id,CREDIT_AMOUNT,Store_Code", "upi-1,10.5,SC1"].join(
      "\n",
    );
    const { rows, errors } = parseCsvQrCollections(csv);
    expect(errors).toEqual([]);
    expect(rows[0].utr).toBe("UPI-1");
    expect(rows[0].amountPaise).toBe(1050);
    expect(rows[0].qrIdentifier).toBe("SC1");
    expect(rows[0].txnAt).toBeNull();
  });

  it("returns only the seven expected keys, never undefined", () => {
    const csv = ["UTR,Amount", "U1,100"].join("\n");
    const { rows } = parseCsvQrCollections(csv);
    expect(Object.keys(rows[0]).sort()).toEqual([
      "amountPaise",
      "payerName",
      "payerVpa",
      "providerTxnId",
      "qrIdentifier",
      "txnAt",
      "utr",
    ]);
    for (const v of Object.values(rows[0])) expect(v).not.toBeUndefined();
    expect(rows[0].qrIdentifier).toBeNull();
    expect(rows[0].payerVpa).toBeNull();
  });
});

describe("parseCsvQrCollections - amount semantics", () => {
  it("strips the rupee sign, thousands separators and padding", () => {
    const csv = ["UTR,Amount", 'A1,"1,499.00"', "A2,₹1499", "A3, 1499.5 "].join(
      "\n",
    );
    const { rows, errors } = parseCsvQrCollections(csv);
    expect(errors).toEqual([]);
    expect(rows.map((r) => r.amountPaise)).toEqual([149900, 149900, 149950]);
  });

  it("converts exactly, without float drift", () => {
    const { rows } = parseCsvQrCollections("UTR,Amount\nA1,1499.99");
    expect(rows[0].amountPaise).toBe(149999);
    expect(Number.isInteger(rows[0].amountPaise)).toBe(true);
  });

  it("rejects a 3-decimal amount as a row error rather than rounding", () => {
    const { rows, errors } = parseCsvQrCollections("UTR,Amount\nA1,100.005");
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(2);
    expect(errors[0].error).toMatch(/Invalid amount/);
  });

  it("rejects a negative amount", () => {
    const { rows, errors } = parseCsvQrCollections("UTR,Amount\nA1,-100.00");
    expect(rows).toHaveLength(0);
    expect(errors[0].line).toBe(2);
  });

  it("rejects a zero amount", () => {
    const { rows, errors } = parseCsvQrCollections("UTR,Amount\nA1,0.00");
    expect(rows).toHaveLength(0);
    expect(errors[0].error).toMatch(/greater than zero/);
  });
});

describe("parseCsvQrCollections - required columns", () => {
  it("fails the whole file when the amount column is missing", () => {
    const { rows, errors } = parseCsvQrCollections("UTR,QR ID\nA1,S1\nA2,S2");
    expect(rows).toEqual([]);
    expect(errors).toEqual([
      {
        line: 1,
        error: "CSV must include an amount column (header row required)",
      },
    ]);
  });

  it("fails the whole file when both UTR and QR identifier columns are missing", () => {
    const { rows, errors } = parseCsvQrCollections(
      "Amount,Payer Name\n100,Ram",
    );
    expect(rows).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(1);
    expect(errors[0].error).toMatch(/UTR column or a QR identifier column/);
  });

  it("accepts a file keyed only by QR identifier", () => {
    const { rows, errors } = parseCsvQrCollections("QR ID,Amount\nS1,100");
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      utr: null,
      qrIdentifier: "S1",
      amountPaise: 10000,
    });
  });

  it("errors an empty file", () => {
    expect(parseCsvQrCollections("")).toEqual({
      rows: [],
      errors: [{ line: 0, error: "Empty file" }],
    });
  });
});

describe("parseCsvQrCollections - batch resilience", () => {
  it("keeps good rows when one row is malformed", () => {
    const csv = [
      "UTR,Amount",
      "A1,100.00",
      "A2,not-a-number",
      "A3,200.00",
    ].join("\n");
    const { rows, errors } = parseCsvQrCollections(csv);
    expect(rows.map((r) => r.utr)).toEqual(["A1", "A3"]);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(3);
  });

  it("errors a row that has neither UTR nor QR identifier value", () => {
    const csv = ["UTR,QR ID,Amount", "A1,,100", ",,150", ",S2,200"].join("\n");
    const { rows, errors } = parseCsvQrCollections(csv);
    expect(rows.map((r) => r.utr)).toEqual(["A1", null]);
    expect(errors).toEqual([
      { line: 3, error: "Row has neither a UTR nor a QR identifier" },
    ]);
  });
});

describe("parseCsvQrCollections - dates", () => {
  it("reads ambiguous separated dates day-first", () => {
    const { rows } = parseCsvQrCollections(
      "UTR,Amount,Txn Date\nA1,100,01/02/2026",
    );
    expect(rows[0].txnAt.getMonth()).toBe(1); // February, not January
    expect(rows[0].txnAt.getDate()).toBe(1);
  });

  it("accepts DD-MM-YYYY, YYYY-MM-DD HH:mm:ss and full ISO", () => {
    const csv = [
      "UTR,Amount,Timestamp",
      "A1,100,15-03-2026",
      "A2,100,2026-03-15 08:05:09",
      "A3,100,2026-03-15T08:05:09.000Z",
    ].join("\n");
    const { rows, errors } = parseCsvQrCollections(csv);
    expect(errors).toEqual([]);
    expect(rows[0].txnAt).toEqual(new Date(2026, 2, 15));
    expect(rows[1].txnAt).toEqual(new Date(2026, 2, 15, 8, 5, 9));
    expect(rows[2].txnAt.toISOString()).toBe("2026-03-15T08:05:09.000Z");
  });

  it("yields null (not an error) for an unparseable date", () => {
    const { rows, errors } = parseCsvQrCollections(
      "UTR,Amount,Txn Date\nA1,100,15th March",
    );
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].txnAt).toBeNull();
    expect(rows[0].amountPaise).toBe(10000);
  });

  it("yields null for an impossible calendar date", () => {
    const { rows, errors } = parseCsvQrCollections(
      "UTR,Amount,Txn Date\nA1,100,31/02/2026",
    );
    expect(errors).toEqual([]);
    expect(rows[0].txnAt).toBeNull();
  });
});

describe("parseCsvQrCollections - file shape", () => {
  it("handles quoted fields containing commas", () => {
    const csv = ["UTR,Amount,Payer Name", 'A1,"1,499.00","Kumar, Ram"'].join(
      "\n",
    );
    const { rows, errors } = parseCsvQrCollections(csv);
    expect(errors).toEqual([]);
    expect(rows[0].payerName).toBe("Kumar, Ram");
    expect(rows[0].amountPaise).toBe(149900);
  });

  it("handles CRLF line endings and a trailing newline", () => {
    const csv = "UTR,Amount\r\nA1,100.00\r\nA2,200.00\r\n";
    const { rows, errors } = parseCsvQrCollections(csv);
    expect(errors).toEqual([]);
    expect(rows.map((r) => r.amountPaise)).toEqual([10000, 20000]);
  });

  it("exposes QR_FIELD_ALIASES for callers", () => {
    expect(QR_FIELD_ALIASES.utr).toContain("rrn");
    expect(QR_FIELD_ALIASES.qrIdentifier).toContain("qrid");
  });
});

describe("parseCsvCollections - COD regression (behaviour must be unchanged)", () => {
  it("still maps 'utr' to courierReportId for COD files", () => {
    const csv = ["AWB,COD Amount,UTR", 'AWB123,"₹1,499.00",UTR-XYZ'].join("\n");
    const { rows, errors } = parseCsvCollections(csv);
    expect(errors).toEqual([]);
    expect(rows[0].awbNumber).toBe("AWB123");
    expect(rows[0].reportedAmount).toBe(1499);
    expect(rows[0].courierReportId).toBe("UTR-XYZ");
    expect(rows[0].utr).toBeUndefined();
  });

  it("still reports collectionDate as an ISO string and omits absent optionals", () => {
    const csv = [
      "Waybill,Amount,Collection Date",
      "WB1,250.50,2026-03-15",
    ].join("\n");
    const { rows } = parseCsvCollections(csv);
    expect(rows[0]).toEqual({
      awbNumber: "WB1",
      reportedAmount: 250.5,
      collectionDate: new Date("2026-03-15").toISOString(),
    });
  });

  it("still fails the whole file without an AWB column", () => {
    expect(parseCsvCollections("Amount,UTR\n100,U1")).toEqual({
      rows: [],
      errors: [
        {
          line: 1,
          error:
            "CSV must include an AWB column and an amount column (header row required)",
        },
      ],
    });
  });

  it("still skips rows with a missing AWB or invalid amount without aborting", () => {
    const csv = ["AWB,Amount", "A1,100", ",200", "A3,abc", "A4,300"].join("\n");
    const { rows, errors } = parseCsvCollections(csv);
    expect(rows.map((r) => r.awbNumber)).toEqual(["A1", "A4"]);
    expect(errors).toEqual([
      { line: 3, error: "Missing AWB" },
      { line: 4, error: 'Invalid amount "abc"' },
    ]);
  });
});
