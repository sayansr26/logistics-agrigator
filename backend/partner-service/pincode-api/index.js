const express = require("express");
const fs = require("fs");
const csv = require("csv-parser");
const { getDigiPin, getLatLngFromDigiPin } = require("./digipin");

const app = express();
const PORT = 3000;
const pincodeData = {};

function toRad(deg) {
  return (deg * Math.PI) / 180;
}
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return +(R * c).toFixed(2);
}

// Load CSV into memory
fs.createReadStream("merged_pincode_data.csv")
  .pipe(csv())
  .on("data", (row) => {
    const pin = row.pincode.trim();
    pincodeData[pin] = {
      pincode: Number(pin),
      area: row.area,
      lat: row.lat ? parseFloat(row.lat) : null,
      lng: row.lng ? parseFloat(row.lng) : null,
      district: row.district,
      state: row.state,
      type: row.type,
    };
  })
  .on("end", () => {
    console.log("CSV loaded into memory");
  });

// ---------- ROUTES ----------

// 1. Get Pincode Info
app.get("/api/pincode/:pin", (req, res) => {
  const pin = req.params.pin;
  res.json(pincodeData[pin] || { error: "Pincode not found" });
});

// 2. Distance from lat/lng
app.get("/api/distance/from-latlng", (req, res) => {
  const { lat1, lng1, lat2, lng2 } = req.query;
  if (!lat1 || !lng1 || !lat2 || !lng2)
    return res.status(400).json({ error: "Missing query parameters" });

  const distance = haversine(+lat1, +lng1, +lat2, +lng2);
  res.json({ distance_km: distance });
});

// 3. Distance from pincodes
app.get("/api/distance/from-pincode/:pin1/:pin2", (req, res) => {
  const loc1 = pincodeData[req.params.pin1];
  const loc2 = pincodeData[req.params.pin2];
  if (!loc1 || !loc2 || !loc1.lat || !loc2.lat)
    return res.status(404).json({ error: "Lat/Lng not found for one or both" });

  const dist = haversine(loc1.lat, loc1.lng, loc2.lat, loc2.lng);
  res.json({ pin1: req.params.pin1, pin2: req.params.pin2, distance_km: dist });
});

// 4. Encode DIGIPIN
app.get("/api/digipin/:pin", (req, res) => {
  const info = pincodeData[req.params.pin];
  if (!info || !info.lat || !info.lng)
    return res.status(404).json({ error: "Invalid PIN or missing lat/lng" });
  try {
    res.json({
      pincode: req.params.pin,
      digipin: getDigiPin(info.lat, info.lng),
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 5. Decode DIGIPIN
app.get("/api/decode-digipin/:digipin", (req, res) => {
  try {
    const coords = getLatLngFromDigiPin(req.params.digipin);
    res.json({ digipin: req.params.digipin, ...coords });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
