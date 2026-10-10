// scripts/supabase-schema-check.js
// Validates Supabase schema against blueprint-spec.yml

const fs = require("fs");
const yaml = require("js-yaml");

function fail(msg) {
  console.error("❌ Supabase schema violation:", msg);
  process.exit(1);
}

console.log("🔍 Validating Supabase schema...");

// Load blueprint spec
const spec = yaml.load(fs.readFileSync("blueprint-spec.yml", "utf8"));

// Required tables from blueprint
const requiredTables = spec.software_architecture.core_tables;

// Check each table exists in supabase/
requiredTables.forEach((table) => {
  const path = `supabase/${table}.sql`;
  if (!fs.existsSync(path)) {
    fail(`Missing Supabase table file: ${table}.sql`);
  }
});

// Validate RLS rules exist
const rlsTables = [
  "profiles",
  "listings",
  "bookings",
  "inspections",
  "claims"
];

rlsTables.forEach((table) => {
  const path = `supabase/${table}.sql`;
  const content = fs.readFileSync(path, "utf8");

  if (!content.includes("policy")) {
    fail(`Missing RLS policies in ${table}.sql`);
  }
});

// Validate Phase 1 architecture rules
if (spec.key_rules) {
  if (!spec.key_rules.includes("one_listing_equals_one_physical_item")) {
    fail("Supabase schema must enforce one listing = one physical item.");
  }
}

console.log("✅ Supabase schema validated successfully.");
