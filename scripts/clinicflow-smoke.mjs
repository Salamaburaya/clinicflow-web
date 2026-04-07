const baseUrl =
  process.env.CLINICFLOW_QA_BASE_URL?.trim() ||
  "https://clinicflow-web-alpha.vercel.app";

async function fetchText(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "user-agent": "clinicflow-smoke/1.0",
      accept: "text/html,application/json",
    },
  });

  const body = await response.text();
  return { response, body };
}

function stripScripts(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(body, expected, label) {
  assert(
    body.includes(expected),
    `${label}: expected response to include "${expected}"`,
  );
}

function assertNotIncludes(body, forbidden, label) {
  assert(
    !body.includes(forbidden),
    `${label}: response unexpectedly included "${forbidden}"`,
  );
}

async function checkPage(path, checks) {
  const { response, body } = await fetchText(path);
  const label = path || "/";
  const visibleBody = stripScripts(body);

  assert(response.ok, `${label}: expected HTTP 200, got ${response.status}`);
  assertNotIncludes(visibleBody, "This page couldn’t load", label);
  assertNotIncludes(visibleBody, "This page couldn't load", label);

  if (!checks.allowEmbeddedNotFoundTemplate) {
    assertNotIncludes(visibleBody, "לא מצאנו את המטופל הזה", label);
  }

  for (const expected of checks.includes ?? []) {
    assertIncludes(visibleBody, expected, label);
  }

  for (const forbidden of checks.excludes ?? []) {
    assertNotIncludes(visibleBody, forbidden, label);
  }
}

async function main() {
  console.log(`ClinicFlow smoke QA starting against ${baseUrl}`);

  await checkPage("/", {
    includes: ["ClinicFlow", "לוח בקרה", "מטופלים"],
  });

  await checkPage("/patients", {
    includes: ["מאגר מטופלים", "פתיחת תיק מלא"],
  });

  await checkPage("/patients/seed-patient-noa", {
    includes: ["תיק מטופל", "נועה אלקיים"],
    excludes: ["invalid input syntax for type uuid"],
    allowEmbeddedNotFoundTemplate: false,
  });

  const api = await fetch(
    `${baseUrl}/api/clinicflow/patient-record?patientId=seed-patient-noa`,
    {
      headers: {
        "user-agent": "clinicflow-smoke/1.0",
        accept: "application/json",
      },
    },
  );
  const apiJson = await api.json();

  assert(api.ok, `/api/clinicflow/patient-record: expected 200, got ${api.status}`);
  assert(apiJson?.patient?.full_name === "נועה אלקיים", "patient-record: expected seeded patient payload");
  assert(Array.isArray(apiJson?.appointments), "patient-record: expected appointments array");
  assert(Array.isArray(apiJson?.paymentEntries), "patient-record: expected paymentEntries array");
  assert(Array.isArray(apiJson?.journalEntries), "patient-record: expected journalEntries array");
  assert(
    apiJson?.appointments.length > 0,
    "patient-record: expected at least one seeded appointment",
  );

  console.log("ClinicFlow smoke QA passed");
}

main().catch((error) => {
  console.error("ClinicFlow smoke QA failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
