// scripts/compliance-checker.js
// Blueprint Compliance Engine (Phase 1)
// Enforces rules from blueprint-spec.yml

const fs = require("fs");
const yaml = require("js-yaml");

function fail(msg) {
  console.error("❌ Blueprint violation:", msg);
  process.exit(1);
}

console.log("🔍 Running Blueprint Compliance Engine...");

// Load blueprint spec
const spec = yaml.load(fs.readFileSync("blueprint-spec.yml", "utf8"));

// --- RULE 1: Phase 1 constraints ---
if (spec.phase_1_constraints.listings.quantity_support !== false) {
  fail("Quantity support must be disabled in Phase 1.");
}

if (spec.phase_1_constraints.listings.multilocation_support !== false) {
  fail("Multilocation inventory must be disabled in Phase 1.");
}

if (spec.phase_1_constraints.listings.staff_accounts !== false) {
  fail("Staff accounts must be disabled in Phase 1.");
}

// --- RULE 2: Booking approval must be manual ---
if (spec.phase_1_constraints.booking.approval_method !== "manual_only") {
  fail("Booking approval must be manual-only in Phase 1.");
}

// --- RULE 3: Deposits must be optional per listing ---
if (spec.phase_1_constraints.deposits.model !== "optional_per_listing") {
  fail("Deposit model must be optional per listing.");
}

// --- RULE 4: Cancellation policy must be platform-wide ---
if (spec.phase_1_constraints.cancellation_policy.model !== "platform_global_rules") {
  fail("Cancellation policy must use global platform rules.");
}

// --- RULE 5: Core architecture modules must exist ---
const requiredModules = [
  "profiles",
  "listings",
  "bookings",
  "inspections",
  "claims",
  "deposits_payouts"
];

requiredModules.forEach((table) => {
  const path = `supabase/${table}.sql`;
  if (!fs.existsSync(path)) {
    fail(`Missing required Supabase table: ${table}`);
  }
});

// --- RULE 6: Prohibited items must match blueprint ---
const prohibited = spec.prohibited_items.list;
const requiredProhibited = [
  "weapons",
  "ammunition",
  "explosives",
  "hazardous_chemicals",
  "medical_devices",
  "drugs_or_paraphernalia",
  "animals",
  "registered_vehicles",
  "anything_illegal_state_or_federal"
];

requiredProhibited.forEach((item) => {
  if (!prohibited.includes(item)) {
    fail(`Prohibited items list missing: ${item}`);
  }
});

// --- RULE 7: No Phase 2 features allowed ---
const forbiddenFeatures = [
  "quantity_support",
  "multilocation_inventory",
  "staff_accounts",
  "insurance_integration",
  "delivery_options",
  "business_verification",
  "subscription_plans",
  "advanced_fraud_controls"
];

forbiddenFeatures.forEach((feature) => {
  if (JSON.stringify(spec).includes(feature)) {
    fail(`Forbidden Phase 2 feature detected: ${feature}`);
  }
});

console.log("✅ Blueprint compliance passed.");
