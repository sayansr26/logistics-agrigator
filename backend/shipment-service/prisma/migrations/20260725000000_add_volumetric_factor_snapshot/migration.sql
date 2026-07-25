-- Snapshot the volumetric factor alongside the existing divisor snapshot so a
-- re-rate reproduces the original charge even after the channel config changes.
-- NULL on historical rows resolves to the system default factor at read time.

ALTER TABLE "shipments"
  ADD COLUMN "volumetric_factor" DECIMAL(10,2);
