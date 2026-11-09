import process from "node:process";

const apiUrl = (process.env.API_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
const anonKey = process.env.ANON_KEY || process.env.PUBLISHABLE_KEY || "";
const serviceKey = process.env.SERVICE_ROLE_KEY || process.env.SECRET_KEY || "";

if (!apiUrl || !anonKey || !serviceKey) {
  throw new Error("Missing local Supabase API_URL, ANON_KEY/PUBLISHABLE_KEY or SERVICE_ROLE_KEY/SECRET_KEY.");
}
if (!apiUrl.includes("127.0.0.1") && !apiUrl.includes("localhost")) {
  throw new Error(`Refusing non-local Supabase URL: ${apiUrl}`);
}

let checks = 0;
function check(condition, label) {
  checks += 1;
  if (!condition) throw new Error(`FAIL [${checks}]: ${label}`);
  console.log(`ok ${checks} - ${label}`);
}

async function http(path, { key = anonKey, token = key, method = "GET", body, prefer } = {}) {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch { data = raw; }
  }
  return { status: response.status, data, raw };
}

function expectStatus(result, allowed, label) {
  check(allowed.includes(result.status), `${label} (HTTP ${result.status}; expected ${allowed.join("/")})`);
  return result;
}

async function createUser(email, password) {
  const result = await http("/auth/v1/admin/users", {
    key: serviceKey,
    token: serviceKey,
    method: "POST",
    body: { email, password, email_confirm: true },
  });
  expectStatus(result, [200, 201], `Auth admin creates ${email}`);
  const user = result.data?.user || result.data;
  if (!user?.id) throw new Error(`Auth admin response did not contain user id for ${email}: ${result.raw}`);
  return { id: user.id, email, password };
}

async function signIn(user) {
  const result = await http("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email: user.email, password: user.password },
  });
  expectStatus(result, [200], `Auth issues a password session for ${user.email}`);
  if (!result.data?.access_token || result.data?.user?.id !== user.id) {
    throw new Error(`Unexpected Auth session response for ${user.email}`);
  }
  return { ...user, token: result.data.access_token };
}

async function seed(table, rows) {
  const result = await http(`/rest/v1/${table}`, {
    key: serviceKey,
    token: serviceKey,
    method: "POST",
    body: rows,
    prefer: "return=minimal",
  });
  expectStatus(result, [201, 204], `Local service role seeds ${table}`);
}

async function rows(actor, table, query = "") {
  const path = `/rest/v1/${table}?select=*${query ? `&${query}` : ""}`;
  const result = await http(path, { token: actor.token });
  expectStatus(result, [200], `${actor.email} can query ${table}`);
  if (!Array.isArray(result.data)) throw new Error(`Expected array response from ${table}: ${result.raw}`);
  return result.data;
}

async function denied(result, label) {
  expectStatus(result, [400, 401, 403, 409, 422], label);
}

async function rpc(actor, name, body) {
  return http(`/rest/v1/rpc/${name}`, {
    token: actor.token,
    method: "POST",
    body,
  });
}

const ids = {
  orgA: "11111111-1111-1111-1111-111111111111",
  orgB: "22222222-2222-2222-2222-222222222222",
  patientA1: "cccccccc-cccc-cccc-cccc-ccccccccccc1",
  patientA2: "cccccccc-cccc-cccc-cccc-ccccccccccc2",
  patientB1: "dddddddd-dddd-dddd-dddd-ddddddddddd1",
  professionalA: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1",
  scheduledA1: "ffffffff-ffff-ffff-ffff-fffffffffff1",
  completedA1: "ffffffff-ffff-ffff-ffff-fffffffffff2",
  completedA2: "ffffffff-ffff-ffff-ffff-fffffffffff3",
  scheduledB1: "ffffffff-ffff-ffff-ffff-fffffffffff4",
};

const suffix = process.env.GITHUB_RUN_ID || String(Date.now());
const password = `Kovo-Local-Test-${suffix}-Strong!9`;
const users = {
  psychA: await createUser(`psych-a-${suffix}@kovo.test`, password),
  receptionA: await createUser(`reception-a-${suffix}@kovo.test`, password),
  financeA: await createUser(`finance-a-${suffix}@kovo.test`, password),
  psychB: await createUser(`psych-b-${suffix}@kovo.test`, password),
  inactiveA: await createUser(`inactive-a-${suffix}@kovo.test`, password),
  outsider: await createUser(`outsider-${suffix}@kovo.test`, password),
};
for (const key of Object.keys(users)) users[key] = await signIn(users[key]);

await seed("organizations", [
  { id: ids.orgA, name: "KOVO HTTP Test Clinic A", is_demo: false },
  { id: ids.orgB, name: "KOVO HTTP Test Clinic B", is_demo: false },
]);
await seed("memberships", [
  { org_id: ids.orgA, user_id: users.psychA.id, role: "psychologa", active: true },
  { org_id: ids.orgA, user_id: users.receptionA.id, role: "recepcion", active: true },
  { org_id: ids.orgA, user_id: users.financeA.id, role: "gestoria", active: true },
  { org_id: ids.orgB, user_id: users.psychB.id, role: "psychologa", active: true },
  { org_id: ids.orgA, user_id: users.inactiveA.id, role: "recepcion", active: false },
]);
await seed("patients", [
  { id: ids.patientA1, org_id: ids.orgA, patient_code: "HTTP-A-001", first_name: "Paciente", last_name: "Uno" },
  { id: ids.patientA2, org_id: ids.orgA, patient_code: "HTTP-A-002", first_name: "Paciente", last_name: "Dos" },
  { id: ids.patientB1, org_id: ids.orgB, patient_code: "HTTP-B-001", first_name: "Paciente", last_name: "Tres" },
]);
await seed("professionals", [
  { id: ids.professionalA, org_id: ids.orgA, display_name: "Profesional HTTP A" },
]);
await seed("appointments", [
  {
    id: ids.scheduledA1, org_id: ids.orgA, patient_id: ids.patientA1,
    professional_id: ids.professionalA, starts_at: "2030-01-10T10:00:00+01:00",
    ends_at: "2030-01-10T10:50:00+01:00", status: "scheduled",
  },
  {
    id: ids.completedA1, org_id: ids.orgA, patient_id: ids.patientA1,
    professional_id: null, starts_at: "2030-01-10T12:00:00+01:00",
    ends_at: "2030-01-10T12:50:00+01:00", status: "completed",
  },
  {
    id: ids.completedA2, org_id: ids.orgA, patient_id: ids.patientA2,
    professional_id: null, starts_at: "2030-01-10T13:00:00+01:00",
    ends_at: "2030-01-10T13:50:00+01:00", status: "completed",
  },
  {
    id: ids.scheduledB1, org_id: ids.orgB, patient_id: ids.patientB1,
    professional_id: null, starts_at: "2030-01-10T10:00:00+01:00",
    ends_at: "2030-01-10T10:50:00+01:00", status: "scheduled",
  },
]);
await seed("organization_billing_profiles", [
  {
    org_id: ids.orgA, legal_name: "KOVO Test Clinic", tax_id: "X0000000T",
    address_line: "Calle de Prueba 1", postal_code: "29001", city: "Malaga",
    country_code: "ES", invoice_series: "HTTP",
  },
]);
await seed("patient_billing_profiles", [
  {
    org_id: ids.orgA, patient_id: ids.patientA1, legal_name: "Paciente Uno",
    tax_id: "12345678Z", address_line: "Calle Ficticia 2", postal_code: "29002",
    city: "Malaga", country_code: "ES",
  },
]);
await seed("patient_consent_status", [
  {
    org_id: ids.orgA, patient_id: ids.patientA1, consent_type: "privacy",
    document_version: "v1", status: "granted",
  },
]);

// Read boundaries and tenant isolation, using real Auth-issued access tokens.
check((await rows(users.psychA, "patients", `org_id=eq.${ids.orgA}`)).length === 2, "psychologist reads own organization's patients");
check((await rows(users.psychA, "patients", `id=eq.${ids.patientB1}`)).length === 0, "psychologist cannot read another organization's patient");
check((await rows(users.receptionA, "patients", `org_id=eq.${ids.orgA}`)).length === 2, "reception reads own organization's patients");
check((await rows(users.receptionA, "patients", `id=eq.${ids.patientB1}`)).length === 0, "reception cannot read another organization's patient");
check((await rows(users.receptionA, "clinical_notes")).length === 0, "reception cannot read clinical-note content");
check((await rows(users.receptionA, "patient_consents")).length === 0, "reception cannot read private consent events");
check((await rows(users.receptionA, "patient_consent_status")).length === 1, "reception can read the limited consent-status projection");
check((await rows(users.receptionA, "organization_billing_profiles")).length === 0, "reception cannot read billing profiles");
check((await rows(users.financeA, "patients")).length === 0, "gestoría cannot read patient records");
check((await rows(users.financeA, "appointments")).length === 0, "gestoría cannot read appointments");
check((await rows(users.financeA, "organization_billing_profiles")).length === 1, "gestoría can read organization billing profile");
check((await rows(users.financeA, "patient_billing_profiles")).length === 1, "gestoría can read patient billing profile");
check((await rows(users.psychB, "patients", `id=eq.${ids.patientB1}`)).length === 1, "second psychologist reads own organization's patient");
check((await rows(users.psychB, "patients", `id=eq.${ids.patientA1}`)).length === 0, "second psychologist cannot read first organization's patient");
check((await rows(users.inactiveA, "patients")).length === 0, "inactive membership grants no patient access");
check((await rows(users.outsider, "patients")).length === 0, "authenticated user without membership sees no patients");

const unauthenticated = await http(`/rest/v1/patients?select=id&org_id=eq.${ids.orgA}`, { token: anonKey });
denied(unauthenticated, "anonymous request is denied patient data access");
const invalidSession = await http(`/rest/v1/patients?select=id`, { token: "not.a.valid.jwt" });
expectStatus(invalidSession, [401], "malformed/expired JWT is rejected by PostgREST");

// Patient write boundaries.
const allowedPatient = await http("/rest/v1/patients", {
  token: users.receptionA.token, method: "POST",
  prefer: "return=representation",
  body: { org_id: ids.orgA, patient_code: "HTTP-A-003", first_name: "Alta", last_name: "Recepcion" },
});
expectStatus(allowedPatient, [201], "reception can create a patient in its own organization");
const createdPatientId = allowedPatient.data?.[0]?.id;
check(Boolean(createdPatientId), "patient creation returns the database UUID");
const patientPatch = await http(`/rest/v1/patients?id=eq.${createdPatientId}`, {
  token: users.receptionA.token, method: "PATCH",
  prefer: "return=representation",
  body: { first_name: "Alta actualizada" },
});
expectStatus(patientPatch, [200], "reception can update a patient in its own organization");
check(patientPatch.data?.[0]?.first_name === "Alta actualizada", "patient update is persisted");
await denied(await http("/rest/v1/patients", {
  token: users.financeA.token, method: "POST",
  body: { org_id: ids.orgA, patient_code: "HTTP-FIN-001", first_name: "No", last_name: "Permitido" },
}), "gestoría cannot create patient records");
await denied(await http("/rest/v1/patients", {
  token: users.psychA.token, method: "POST",
  body: { org_id: ids.orgB, patient_code: "HTTP-CROSS-001", first_name: "Cross", last_name: "Tenant" },
}), "psychologist cannot create patient in another organization");
await denied(await http(`/rest/v1/patients?id=eq.${ids.patientA1}`, {
  token: users.psychA.token, method: "PATCH",
  body: { org_id: ids.orgB },
}), "psychologist cannot move a patient into another organization");
await denied(await http("/rest/v1/patients", {
  token: users.inactiveA.token, method: "POST",
  body: { org_id: ids.orgA, patient_code: "HTTP-INACTIVE-001", first_name: "No", last_name: "Permitido" },
}), "inactive membership cannot create patients");
await denied(await http("/rest/v1/patients", {
  token: users.outsider.token, method: "POST",
  body: { org_id: ids.orgA, patient_code: "HTTP-OUTSIDER-001", first_name: "No", last_name: "Permitido" },
}), "user without membership cannot create patients");

// Clinical notes: use the existing SECURITY DEFINER RPC through actual PostgREST.
const noteArgs = {
  p_org_id: ids.orgA,
  p_patient_id: ids.patientA1,
  p_appointment_id: ids.scheduledA1,
  p_note_type: "session",
  p_content: "HTTP integration test draft",
  p_note_id: null,
};
const noteCreate = await rpc(users.psychA, "save_clinical_note_draft", noteArgs);
expectStatus(noteCreate, [200], "psychologist can create a clinical draft through PostgREST");
const noteId = noteCreate.data;
check(typeof noteId === "string" && /^[0-9a-f-]{36}$/i.test(noteId), "clinical draft RPC returns UUID");
check((await rows(users.psychA, "clinical_notes", `id=eq.${noteId}`))[0]?.content === noteArgs.p_content, "clinical draft is readable by its author");
const noteUpdate = await rpc(users.psychA, "save_clinical_note_draft", { ...noteArgs, p_content: "HTTP integration test updated", p_note_id: noteId });
expectStatus(noteUpdate, [200], "psychologist can edit own clinical draft through PostgREST");
check(noteUpdate.data === noteId, "editing a draft preserves its UUID");
check((await rows(users.psychA, "clinical_notes", `id=eq.${noteId}`))[0]?.content === "HTTP integration test updated", "clinical draft update persisted");
await denied(await rpc(users.psychA, "save_clinical_note_draft", {
  ...noteArgs, p_appointment_id: ids.completedA2, p_content: "Wrong patient appointment",
}), "clinical-note RPC rejects appointment linked to a different patient");
await denied(await rpc(users.psychA, "save_clinical_note_draft", {
  ...noteArgs, p_org_id: ids.orgB, p_patient_id: ids.patientB1, p_appointment_id: ids.scheduledB1,
}), "psychologist cannot create clinical note in another organization");
await denied(await rpc(users.receptionA, "save_clinical_note_draft", noteArgs), "reception cannot create clinical drafts");
await denied(await rpc(users.financeA, "save_clinical_note_draft", noteArgs), "gestoría cannot create clinical drafts");
const signResult = await rpc(users.psychA, "sign_clinical_note", { p_note: noteId });
expectStatus(signResult, [200], "psychologist can sign own draft using the controlled RPC");
await denied(await rpc(users.psychA, "save_clinical_note_draft", { ...noteArgs, p_content: "Attempt after signing", p_note_id: noteId }), "signed clinical note cannot be edited as a draft");
check((await rows(users.receptionA, "clinical_notes", `id=eq.${noteId}`)).length === 0, "reception still cannot read note after signing");

// Consent writes are scoped to the psychologist role and idempotency key.
const consentArgs = {
  p_org_id: ids.orgA, p_patient_id: ids.patientA1,
  p_consent_type: "privacy", p_document_version: "http-v1",
  p_status: "granted", p_signed_at: "2030-01-10T09:00:00+01:00",
  p_withdrawn_at: null, p_evidence_document_id: null,
  p_request_key: "88888888-8888-8888-8888-888888888881",
};
const consentCreate = await rpc(users.psychA, "record_patient_consent", consentArgs);
expectStatus(consentCreate, [200], "psychologist can record consent through PostgREST RPC");
const consentRetry = await rpc(users.psychA, "record_patient_consent", consentArgs);
expectStatus(consentRetry, [200], "identical consent retry is accepted");
check(consentRetry.data === consentCreate.data, "consent retry returns the same event UUID");
check((await rows(users.psychA, "patient_consents", `request_key=eq.${consentArgs.p_request_key}`)).length === 1, "consent retry does not duplicate event");
await denied(await rpc(users.receptionA, "record_patient_consent", consentArgs), "reception cannot record consent");
await denied(await rpc(users.financeA, "record_patient_consent", consentArgs), "gestoría cannot record consent");

// Invoice write boundary and authorized issue path.
await denied(await http("/rest/v1/invoices", {
  token: users.psychA.token, method: "POST",
  body: { org_id: ids.orgA, patient_id: ids.patientA1, status: "issued", issue_date: "2030-01-10" },
}), "direct REST insert cannot create an issued invoice");
const draftInvoice = await http("/rest/v1/invoices", {
  token: users.psychA.token, method: "POST", prefer: "return=representation",
  body: { org_id: ids.orgA, patient_id: ids.patientA1, status: "draft", issue_date: "2030-01-10" },
});
expectStatus(draftInvoice, [201], "psychologist can create a draft invoice");
const draftInvoiceId = draftInvoice.data?.[0]?.id;
check(Boolean(draftInvoiceId), "draft invoice creation returns its UUID");
await denied(await http(`/rest/v1/invoices?id=eq.${draftInvoiceId}`, {
  token: users.psychA.token, method: "PATCH", body: { status: "issued" },
}), "direct REST update cannot issue a draft invoice");
const validInvoiceCreate = await rpc(users.psychA, "save_invoice_draft", {
  p_org_id: ids.orgA,
  p_patient_id: ids.patientA1,
  p_issue_date: "2030-01-10",
  p_due_date: "2030-01-31",
  p_lines: [{
    description: "Sesión completada",
    quantity: 1,
    unit_price_cents: 6000,
    tax_rate: 0,
    appointment_id: ids.completedA1,
  }],
  p_legacy_id: null,
  p_retention_cents: 0,
});
expectStatus(validInvoiceCreate, [200], "authorized RPC creates invoice draft with completed appointment");
const validInvoiceId = validInvoiceCreate.data;
check(typeof validInvoiceId === "string", "invoice draft RPC returns invoice UUID");
const issueResult = await rpc(users.psychA, "emit_invoice", { p_invoice: validInvoiceId });
expectStatus(issueResult, [200], "authorized invoice RPC issues invoice with real Auth session");
const issuedInvoice = (await rows(users.psychA, "invoices", `id=eq.${validInvoiceId}`))[0];
check(issuedInvoice?.status === "issued", "invoice status becomes issued through authorized RPC");
check(Boolean(issuedInvoice?.issuer_snapshot?.legal_name), "issued invoice stores issuer snapshot");
check(Boolean(issuedInvoice?.recipient_snapshot?.legal_name), "issued invoice stores recipient snapshot");
await denied(await http(`/rest/v1/invoices?id=eq.${validInvoiceId}`, {
  token: users.psychA.token, method: "PATCH", body: { total_cents: 1 },
}), "issued invoice is immutable through direct REST update");

// Appointment overlap prevention via HTTP (not just SQL assertions).
await denied(await http("/rest/v1/appointments", {
  token: users.psychA.token, method: "POST",
  body: {
    org_id: ids.orgA, patient_id: ids.patientA1, professional_id: ids.professionalA,
    starts_at: "2030-01-10T10:20:00+01:00", ends_at: "2030-01-10T11:00:00+01:00",
    status: "scheduled",
  },
}), "PostgREST cannot create overlapping active appointment");
const adjacentAppointment = await http("/rest/v1/appointments", {
  token: users.psychA.token, method: "POST",
  body: {
    org_id: ids.orgA, patient_id: ids.patientA1, professional_id: ids.professionalA,
    starts_at: "2030-01-10T10:50:00+01:00", ends_at: "2030-01-10T11:40:00+01:00",
    status: "scheduled",
  },
});
expectStatus(adjacentAppointment, [201], "PostgREST allows back-to-back appointment intervals");

console.log(`PASS: ${checks} HTTP/Auth/PostgREST integration assertions passed against local Supabase.`);
