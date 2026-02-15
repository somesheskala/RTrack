const utils = window.AppUtils || {
  getCurrentMonth: () => new Date().toISOString().slice(0, 7),
  formatMonth: (yyyyMm) => {
    const [year, month] = yyyyMm.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  },
  formatMonthShort: (yyyyMm) => {
    const [year, month] = yyyyMm.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  },
  formatDate: (yyyyMmDd) => {
    if (!yyyyMmDd) return "-";
    const [year, month, day] = yyyyMmDd.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString();
  },
  money: (amount) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
      Number(amount || 0)
    ),
  normalizeDate: (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()),
  parseIndianMobile: (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    let digits = raw.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    if (!/^[6-9]\d{9}$/.test(digits)) return null;
    return `+91 ${digits}`;
  },
  escapeHtml: (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;"),
  normalizeUnitText: (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim(),
  getUnitKey: (buildingName, unitNumber) => {
    const normalize = (value) =>
      String(value || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    return `${normalize(buildingName)}::${normalize(unitNumber)}`;
  },
  parseEmailList: (raw) =>
    String(raw || "")
      .split(/[\n,; ]+/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .filter((email, index, arr) => arr.indexOf(email) === index),
  leasesOverlap: (startA, endA, startB, endB) => {
    const aStart = new Date(startA);
    const aEnd = new Date(endA);
    const bStart = new Date(startB);
    const bEnd = new Date(endB);
    return aStart <= bEnd && aEnd >= bStart;
  }
};
const {
  escapeHtml,
  formatDate,
  formatMonth,
  formatMonthShort,
  getCurrentMonth,
  getUnitKey,
  leasesOverlap,
  money,
  normalizeDate,
  normalizeUnitText,
  parseEmailList,
  parseIndianMobile
} = utils;

const STORAGE_KEY = "rental-manager-data-v1";
const EDIT_ACCESS_KEY = "rental-manager-edit-access-v1";
const REMOTE_FALLBACK_WARNED_KEY = "rental-manager-remote-fallback-warned";
const LOCAL_DOC_TOTAL_LIMIT_BYTES = 3 * 1024 * 1024;
const LOCAL_DOC_SINGLE_FILE_LIMIT_BYTES = 700 * 1024;
const DEFAULT_SUPABASE_DOC_BUCKET = "tenant-documents";
const EDIT_USERS = [
  { username: "viewer", pin: "1111", role: "viewer" },
  { username: "manager", pin: "2222", role: "manager" },
  { username: "admin", pin: "3333", role: "admin" }
];
const PIN_TO_USER = { "1111": "viewer", "2222": "manager", "3333": "admin" };

const state = {
  activeMonth: getCurrentMonth(),
  tenants: [],
  units: [],
  notifyConfig: {
    admins: [],
    managers: [],
    emailjsPublicKey: "",
    emailjsServiceId: "",
    emailjsTemplateId: "",
    senderName: "Rental Management",
    reviewSubjectTemplate: "Payment Review Required: {unit} {tenant name}",
    buildingAddresses: {},
    buildingLandlords: {}
  }
};

const metricsEl = document.getElementById("metrics");
const activeTenantGroupsEl = document.getElementById("activeTenantGroups");
const todayDateEl = document.getElementById("todayDate");
const activeTenantAddCardEl = document.getElementById("activeTenantAddCard");
const activeTenantEditCardEl = document.getElementById("activeTenantEditCard");
const activeTenantEditFormEl = document.getElementById("activeTenantEditForm");
const editExistingDocsEl = document.getElementById("editExistingDocs");
const cancelTenantEditEl = document.getElementById("cancelTenantEdit");
const cancelAddTenantEl = document.getElementById("cancelAddTenant");
const addTenantFromActiveEl = document.getElementById("addTenantFromActive");
const expandAllActiveTenantsEl = document.getElementById("expandAllActiveTenants");
const collapseAllActiveTenantsEl = document.getElementById("collapseAllActiveTenants");
const unitFormEl = document.getElementById("unit-form");
const unitFormTitleEl = document.getElementById("unitFormTitle");
const unitSubmitBtnEl = document.getElementById("unitSubmitBtn");
const cancelUnitEditEl = document.getElementById("cancelUnitEdit");
const addUnitFromUnitsEl = document.getElementById("addUnitFromUnits");
const unitAddCardEl = document.getElementById("unitAddCard");
const buildingNameEl = document.getElementById("buildingName");
const unitNumberEl = document.getElementById("unitNumber");
const occupancyStatusEl = document.getElementById("occupancyStatus");
const unitTenantNameEl = document.getElementById("unitTenantName");
const unitNotesEl = document.getElementById("unitNotes");
const unitGroupsEl = document.getElementById("unitGroups");
const expandUnitsEl = document.getElementById("expandUnits");
const collapseUnitsEl = document.getElementById("collapseUnits");
const unitSummaryEl = document.getElementById("unitSummary");
const unitOverallSummaryEl = document.getElementById("unitOverallSummary");
const unitBuildingSummaryEl = document.getElementById("unitBuildingSummary");
const propertyNameSelectEl = document.getElementById("propertyName");
const editPropertyNameSelectEl = document.getElementById("editPropertyName");
const dashboardTenantGroupsEl = document.getElementById("dashboardTenantGroups");
const expandDashboardTenantsEl = document.getElementById("expandDashboardTenants");
const collapseDashboardTenantsEl = document.getElementById("collapseDashboardTenants");
const leaseStatusGroupsEl = document.getElementById("leaseStatusGroups");
const leaseStatusMonthLabelEl = document.getElementById("leaseStatusMonthLabel");
const expandLeaseStatusEl = document.getElementById("expandLeaseStatus");
const collapseLeaseStatusEl = document.getElementById("collapseLeaseStatus");
const adminEmailListEl = document.getElementById("adminEmailList");
const managerEmailListEl = document.getElementById("managerEmailList");
const emailjsPublicKeyEl = document.getElementById("emailjsPublicKey");
const emailjsServiceIdEl = document.getElementById("emailjsServiceId");
const emailjsTemplateIdEl = document.getElementById("emailjsTemplateId");
const notifySenderNameEl = document.getElementById("notifySenderName");
const reviewSubjectTemplateEl = document.getElementById("reviewSubjectTemplate");
const saveNotifyConfigEl = document.getElementById("saveNotifyConfig");
const buildingAddressFieldsEl = document.getElementById("buildingAddressFields");
const exportMonthlyReportBtnEl = document.getElementById("exportMonthlyReport");
const tenantForm = document.getElementById("tenant-form");
const activeMonthInput = document.getElementById("activeMonth");
const tabsContainerEl = document.querySelector(".tabs");
const dashboardPanelEl = document.querySelector('[data-tab-panel="dashboard"]');
const settingsTabBtnEl = document.getElementById("settingsTabBtn");
const settingsPanelEl = document.getElementById("settingsPanel");
const dashboardNonMetricSections = Array.from(dashboardPanelEl.querySelectorAll(".card")).filter(
  (section) => section !== metricsEl && section.dataset.alwaysHidden !== "true"
);
const tabButtons = document.querySelectorAll("[data-tab-target]");
const tabPanels = document.querySelectorAll("[data-tab-panel]");
const editorAccessFormEl = document.getElementById("editor-access-form");
const editorUserLegacyEl = document.getElementById("editorUser");
const editorPinEl = document.getElementById("editorPin");
const editorLoginBtnEl = document.getElementById("editorLoginBtn");
const editorLogoutEl = document.getElementById("editorLogout");
const editorStatusEl = document.getElementById("editorStatus");
let editingTenantId = "";
let editingUnitId = "";
let editDocKeysToDelete = new Set();
let editorUser = "";
let supabaseClient = null;
let remoteEnabled = false;
let sharedStateRowId = "shared";
let supabaseDocBucket = DEFAULT_SUPABASE_DOC_BUCKET;

init();
disableServiceWorkerAndCaches();

async function init() {
  initEditorAccess();
  await initializeDataLayer();
  activeMonthInput.value = state.activeMonth;
  todayDateEl.textContent = new Date().toLocaleDateString();
  renderAll();

  tenantForm.addEventListener("submit", onAddTenant);
  activeMonthInput.addEventListener("change", () => {
    state.activeMonth = sanitizeMonthKey(activeMonthInput.value);
    activeMonthInput.value = state.activeMonth;
    saveState();
    renderAll();
  });
  activeTenantEditFormEl.addEventListener("submit", onEditTenant);
  cancelTenantEditEl.addEventListener("click", cancelEditTenant);
  if (editExistingDocsEl) {
    editExistingDocsEl.addEventListener("click", onEditExistingDocAction);
  }
  cancelAddTenantEl.addEventListener("click", () => {
    tenantForm.reset();
    activeTenantAddCardEl.classList.add("hidden");
  });
  addTenantFromActiveEl.addEventListener("click", () => {
    if (!hasPermission("tenant_add")) {
      alert("You do not have permission to add tenants.");
      return;
    }
    activeTenantAddCardEl.classList.remove("hidden");
    const propertyField = document.getElementById("propertyName");
    propertyField.scrollIntoView({ behavior: "smooth", block: "center" });
    propertyField.focus();
  });
  if (expandAllActiveTenantsEl) {
    expandAllActiveTenantsEl.addEventListener("click", () => setAllActiveTenantGroups(true));
  }
  if (collapseAllActiveTenantsEl) {
    collapseAllActiveTenantsEl.addEventListener("click", () => setAllActiveTenantGroups(false));
  }
  if (activeTenantGroupsEl) {
    activeTenantGroupsEl.addEventListener("click", onActiveTenantGroupAction);
  }
  unitFormEl.addEventListener("submit", onAddUnit);
  occupancyStatusEl.addEventListener("change", syncUnitTenantField);
  cancelUnitEditEl.addEventListener("click", cancelUnitEdit);
  addUnitFromUnitsEl.addEventListener("click", () => {
    if (!hasPermission("unit_add")) {
      alert("You do not have permission to add units.");
      return;
    }
    unitAddCardEl.classList.remove("hidden");
    buildingNameEl.scrollIntoView({ behavior: "smooth", block: "center" });
    buildingNameEl.focus();
  });
  saveNotifyConfigEl.addEventListener("click", saveNotifyConfig);
  if (exportMonthlyReportBtnEl) {
    exportMonthlyReportBtnEl.addEventListener("click", exportMonthlyReportPdf);
  }
  if (expandDashboardTenantsEl) {
    expandDashboardTenantsEl.addEventListener("click", () => setAllDashboardTenantGroups(true));
  }
  if (collapseDashboardTenantsEl) {
    collapseDashboardTenantsEl.addEventListener("click", () => setAllDashboardTenantGroups(false));
  }
  if (expandLeaseStatusEl) {
    expandLeaseStatusEl.addEventListener("click", () => setAllLeaseStatusGroups(true));
  }
  if (collapseLeaseStatusEl) {
    collapseLeaseStatusEl.addEventListener("click", () => setAllLeaseStatusGroups(false));
  }
  if (expandUnitsEl) {
    expandUnitsEl.addEventListener("click", () => setAllUnitGroups(true));
  }
  if (collapseUnitsEl) {
    collapseUnitsEl.addEventListener("click", () => setAllUnitGroups(false));
  }
  syncUnitTenantField();

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveTab(button.dataset.tabTarget);
    });
  });
}

async function onAddTenant(event) {
  event.preventDefault();
  if (!hasPermission("tenant_add")) {
    alert("You do not have permission to add tenants.");
    return;
  }
  const leaseStart = document.getElementById("leaseStart").value;
  const leaseEnd = document.getElementById("leaseEnd").value;
  const documentFiles = document.getElementById("tenantDocuments").files;
  const linkedUnitId = propertyNameSelectEl.value;
  const parsedMobile = parseIndianMobile(document.getElementById("tenantMobile").value);

  if (new Date(leaseStart) > new Date(leaseEnd)) {
    alert("Lease start date cannot be after lease end date.");
    return;
  }
  if (!linkedUnitId) {
    alert("Select a building-unit from Available Units.");
    return;
  }
  if (parsedMobile === null) {
    alert("Enter a valid Indian mobile number (10 digits, optionally with +91).");
    return;
  }
  const conflictingTenant = findConflictingTenantForUnit(linkedUnitId, leaseStart, leaseEnd);
  if (conflictingTenant) {
    alert(`This unit is already occupied by ${conflictingTenant.tenantName} for overlapping lease dates.`);
    return;
  }
  const localDocCheck = validateLocalDocumentUpload(documentFiles);
  if (!localDocCheck.ok) {
    alert(localDocCheck.message);
    return;
  }

  let documents = [];
  const tenantId = crypto.randomUUID();
  try {
    documents = await readFilesAsDocuments(documentFiles, { tenantId });
  } catch (error) {
    const message = String(error?.message || "");
    if (message) {
      alert(message);
    } else {
      alert("Failed to store one or more attached documents.");
    }
    return;
  }

  const tenant = {
    id: tenantId,
    propertyName: getUnitLabelById(propertyNameSelectEl.value),
    tenantName: document.getElementById("tenantName").value.trim(),
    email: document.getElementById("tenantEmail").value.trim(),
    mobile: parsedMobile || "",
    monthlyRent: Number(document.getElementById("monthlyRent").value),
    leaseStart,
    leaseEnd,
    deposit: Number(document.getElementById("deposit").value || 0),
    notes: document.getElementById("tenantNotes").value.trim(),
    documents,
    linkedUnitId,
    payments: {}
  };

  state.tenants.push(tenant);
  syncUnitFromTenant(tenant, "");
  tenantForm.reset();
  saveState();
  renderAll();
}

function renderAll() {
  syncDashboardPaymentsVisibility();
  renderMetrics();
  try {
    renderActiveTenantsToday();
    renderRows();
    renderLeaseStatusRows();
    renderUnits();
    renderNotifyConfig();
    renderTenantNameOptions();
    renderPropertyNameOptions();
    updateEditorStatusUi();
    applyAnonymousVisibility();
  } catch (error) {
    console.error("Render failure:", error);
    if (!metricsEl.innerHTML.trim()) {
      const occupancy = getUnitOccupancySummary();
      metricsEl.innerHTML = `
        <div class="metrics-row">
          <div class="metric-box">Total Units<strong>${occupancy.total}</strong></div>
          <div class="metric-box">Occupied Units<strong>${occupancy.occupied}</strong></div>
          <div class="metric-box">Vacant Units<strong>${occupancy.vacant}</strong></div>
        </div>
      `;
    }
  }
}

function syncDashboardPaymentsVisibility() {
  const shouldShow = isAuthenticated();

  const byId = document.getElementById("dashboardPaymentsCard");
  if (byId) {
    byId.classList.toggle("hidden", !shouldShow);
    byId.hidden = !shouldShow;
    byId.style.display = shouldShow ? "" : "none";
  }
  const legacyGroups = document.getElementById("dashboardTenantGroups");
  const card = legacyGroups ? legacyGroups.closest(".card") : null;
  if (card && card !== metricsEl) {
    card.classList.toggle("hidden", !shouldShow);
    card.hidden = !shouldShow;
    card.style.display = shouldShow ? "" : "none";
  }
}

function groupByBuilding(items, getBuilding) {
  const grouped = new Map();
  items.forEach((item) => {
    const building = getBuilding(item);
    if (!grouped.has(building)) grouped.set(building, []);
    grouped.get(building).push(item);
  });
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function buildTenantCardHeader({ propertyLabel, tenantName, leaseStart, leaseEnd, actionsHtml = "", propertyClass = "" }) {
  const leaseText = leaseStart && leaseEnd ? `${formatDate(leaseStart)} to ${formatDate(leaseEnd)}` : "";
  return `
    <div class="tenant-card-head">
      <div>
        <strong class="${escapeHtml(propertyClass)}">${escapeHtml(propertyLabel || "-")}</strong>
      </div>
      <div class="tenant-card-center">${escapeHtml(tenantName || "-")}</div>
      <div class="tenant-card-right">
        ${leaseText ? `<div class="tenant-lease"><span>Lease</span><strong>${leaseText}</strong></div>` : ""}
        ${actionsHtml ? `<div class="actions">${actionsHtml}</div>` : ""}
      </div>
    </div>
  `;
}

function renderActiveTenantsToday() {
  activeTenantGroupsEl.innerHTML = "";
  const today = new Date();
  const visibleTenants = [...state.tenants];

  if (!visibleTenants.length) {
    const empty = document.createElement("div");
    empty.className = "empty-note";
    empty.textContent = "No tenants found.";
    activeTenantGroupsEl.appendChild(empty);
    return;
  }

  groupByBuilding(visibleTenants, getTenantBuildingName).forEach(([building, tenants]) => {
      const totalCount = tenants.length;
      const group = document.createElement("details");
      group.className = "tenant-group";
      group.open = false;
      group.innerHTML = `
        <summary>
          <span>${escapeHtml(building)}</span>
          <span class="tenant-group-count">${totalCount} tenant${totalCount === 1 ? "" : "s"}</span>
        </summary>
      `;

      const list = document.createElement("div");
      list.className = "tenant-card-list";

      tenants
        .slice()
        .sort(compareTenantsByUnitAscending)
        .forEach((tenant) => {
          const canManageTenantsInActiveList = isAuthenticated() && getCurrentRole() !== "viewer";
          const editAction = canManageTenantsInActiveList
            ? `<button type="button" class="btn btn-small edit-tenant" data-tenant-id="${tenant.id}">Edit</button>`
            : "";
          const deleteAction = canManageTenantsInActiveList
            ? `<button type="button" class="btn btn-small btn-danger delete-tenant" data-tenant-id="${tenant.id}">Delete</button>`
            : "";
          const actionsContent = editAction || deleteAction ? `${editAction}${deleteAction}` : '<span>No actions</span>';

          const card = document.createElement("article");
          card.className = "tenant-card active-tenant-card";
          if (isTenantLeaseEnded(tenant, today)) {
            card.classList.add("lease-ended-row");
          }
          card.innerHTML = `
            <div class="tenant-card-head">
              <div class="payment-head-left">
                <strong class="unit-header-badge">${escapeHtml(getTenantPropertyName(tenant))}</strong>
                <div class="payment-tenant-name">${escapeHtml(getTenantDisplayName(tenant))}</div>
              </div>
              <div class="payment-lease-center">
                <span>Lease</span>
                <strong>${formatDate(tenant.leaseStart)} to ${formatDate(tenant.leaseEnd)}</strong>
              </div>
              <div class="tenant-card-right">
                <div class="actions">${actionsContent}</div>
              </div>
            </div>
            <div class="tenant-card-grid">
              <div><span>Email</span><strong>${tenant.email ? escapeHtml(tenant.email) : "-"}</strong></div>
              <div><span>Mobile</span><strong>${tenant.mobile ? escapeHtml(tenant.mobile) : "-"}</strong></div>
              <div><span>Rent</span><strong>${money(tenant.monthlyRent)}</strong></div>
              <div><span>Deposit</span><strong>${money(tenant.deposit || 0)}</strong></div>
              <div><span>Documents</span><strong>${renderDocumentLinks(tenant.documents)}</strong></div>
            </div>
            <div class="tenant-card-notes"><span>Notes:</span> ${tenant.notes ? escapeHtml(tenant.notes) : "-"}</div>
          `;
          list.appendChild(card);
        });

      group.appendChild(list);
      activeTenantGroupsEl.appendChild(group);
  });
}

function setAllActiveTenantGroups(isOpen) {
  activeTenantGroupsEl.querySelectorAll(".tenant-group").forEach((group) => {
    group.open = isOpen;
  });
}

function onActiveTenantGroupAction(event) {
  const editBtn = event.target.closest(".edit-tenant");
  if (editBtn) {
    const tenantId = editBtn.dataset.tenantId || "";
    if (tenantId) startEditTenant(tenantId);
    return;
  }
  const deleteBtn = event.target.closest(".delete-tenant");
  if (deleteBtn) {
    const tenantId = deleteBtn.dataset.tenantId || "";
    if (tenantId) removeTenant(tenantId);
  }
}

function isTenantLeaseEnded(tenant, today = new Date()) {
  const end = normalizeDate(new Date(tenant.leaseEnd));
  const target = normalizeDate(today);
  return end < target;
}

function renderMetrics() {
  if (!metricsEl) return;
  const monthKey = sanitizeMonthKey(state.activeMonth);
  state.activeMonth = monthKey;
  const currentMonthLabel = formatMonth(getCurrentMonth());
  const occupancy = getUnitOccupancySummary();
  const buildingUnitCounts = new Map(occupancy.byBuilding);
  const sortedBuildingCounts = [...buildingUnitCounts.entries()].sort(([a], [b]) => a.localeCompare(b));
  const availableByBuilding = sortedBuildingCounts
    .map(([building, counts]) => `${building}: ${counts.total}`)
    .join(" | ");
  const occupiedByBuilding = sortedBuildingCounts
    .map(([building, counts]) => `${building}: ${counts.occupied}`)
    .join(" | ");
  const vacantByBuilding = sortedBuildingCounts
    .map(([building, counts]) => `${building}: ${counts.vacant}`)
    .join(" | ");
  const totalUnits = occupancy.total;
  const occupiedUnits = occupancy.occupied;
  const vacantUnits = occupancy.vacant;

  if (!isAuthenticated()) {
    metricsEl.innerHTML = `
      <div class="metrics-section-title">Units (${escapeHtml(currentMonthLabel)})</div>
      <div class="metrics-row">
        <div class="metric-box">Total Units<strong>${totalUnits}</strong><small>${escapeHtml(availableByBuilding || "-")}</small></div>
        <div class="metric-box">Occupied Units<strong>${occupiedUnits}</strong><small>${escapeHtml(occupiedByBuilding || "-")}</small></div>
        <div class="metric-box">Vacant Units<strong>${vacantUnits}</strong><small>${escapeHtml(vacantByBuilding || "-")}</small></div>
      </div>
    `;
    metricsEl.dataset.appRendered = "1";
    return;
  }

  const activeTenants = getActiveTenantsForMonth(monthKey);
  const totals = activeTenants.reduce(
    (acc, tenant) => {
      const paymentStatus = getPaymentStatus(tenant, monthKey);
      const paid = paymentStatus === "paid";
      acc.expected += tenant.monthlyRent;
      if (paid) {
        acc.collected += tenant.monthlyRent;
      }
      return acc;
    },
    { expected: 0, collected: 0 }
  );
  const totalSecurityDeposit = activeTenants.reduce((sum, tenant) => sum + Number(tenant.deposit || 0), 0);
  const byBuilding = getBuildingTotalsForMonth(monthKey, activeTenants);
  const depositByBuilding = getBuildingDepositTotals(activeTenants);
  const sortedBuildingTotals = byBuilding.slice().sort(([a], [b]) => a.localeCompare(b));
  const expectedBreakdown = sortedBuildingTotals
    .map(([building, totalsByBuilding]) => `${escapeHtml(building)} Rent Expected: ${money(totalsByBuilding.expected)}`)
    .join("<br>");
  const collectedBreakdown = sortedBuildingTotals
    .map(([building, totalsByBuilding]) => `${escapeHtml(building)} Rent Collected: ${money(totalsByBuilding.collected)}`)
    .join("<br>");
  const outstandingBreakdown = sortedBuildingTotals
    .map(
      ([building, totalsByBuilding]) =>
        `${escapeHtml(building)} Rent Outstanding: ${money(totalsByBuilding.expected - totalsByBuilding.collected)}`
    )
    .join("<br>");
  const depositBreakdown = sortedBuildingTotals
    .map(([building]) => `${escapeHtml(building)} Security Deposit: ${money(depositByBuilding.get(building) || 0)}`)
    .join("<br>");

  metricsEl.innerHTML = `
    <div class="metrics-section-title">Units (${escapeHtml(currentMonthLabel)})</div>
    <div class="metrics-row">
      <div class="metric-box">Total Units<strong>${totalUnits}</strong><small>${escapeHtml(availableByBuilding || "-")}</small></div>
      <div class="metric-box">Occupied Units<strong>${occupiedUnits}</strong><small>${escapeHtml(occupiedByBuilding || "-")}</small></div>
      <div class="metric-box">Vacant Units<strong>${vacantUnits}</strong><small>${escapeHtml(vacantByBuilding || "-")}</small></div>
    </div>
    <div class="metrics-section-title">Rent Summary (${formatMonth(monthKey)})</div>
    <div class="metrics-row">
      <div class="metric-box">Total Rent Expected<strong>${money(totals.expected)}</strong><small>${expectedBreakdown || "-"}</small></div>
      <div class="metric-box">Total Rent Collected<strong>${money(totals.collected)}</strong><small>${collectedBreakdown || "-"}</small></div>
      <div class="metric-box">Total Rent Outstanding<strong>${money(totals.expected - totals.collected)}</strong><small>${outstandingBreakdown || "-"}</small></div>
      <div class="metric-box">Total Security Deposit<strong>${money(totalSecurityDeposit)}</strong><small>${depositBreakdown || "-"}</small></div>
    </div>
  `;
  metricsEl.dataset.appRendered = "1";
}

function renderRows() {
  const openDashboardGroups = new Set(
    Array.from(dashboardTenantGroupsEl.querySelectorAll(".dashboard-group[open]"))
      .map((group) => group.dataset.building || "")
      .filter(Boolean)
  );
  dashboardTenantGroupsEl.innerHTML = "";
  const safeMonth = sanitizeMonthKey(state.activeMonth);
  state.activeMonth = safeMonth;
  const monthLabel = formatMonth(safeMonth);
  const activeTenants = getActiveTenantsForMonth(safeMonth);

  if (!activeTenants.length) {
    const empty = document.createElement("div");
    empty.className = "empty-note";
    empty.textContent = `No tenants are active for ${formatMonth(safeMonth)}.`;
    dashboardTenantGroupsEl.appendChild(empty);
    return;
  }

  groupByBuilding(activeTenants, getTenantBuildingName).forEach(([building, tenants]) => {
      const collectedForBuilding = tenants.reduce((sum, tenant) => {
        return sum + (getPaymentStatus(tenant, safeMonth) === "paid" ? Number(tenant.monthlyRent || 0) : 0);
      }, 0);
      const paidTenantCount = tenants.filter((tenant) => getPaymentStatus(tenant, safeMonth) === "paid").length;
      const group = document.createElement("details");
      group.className = "tenant-group dashboard-group";
      group.dataset.building = building;
      group.open = openDashboardGroups.has(building);
      group.innerHTML = `
        <summary>
          <span>${escapeHtml(building)} (${escapeHtml(monthLabel)})</span>
          <span class="tenant-group-count">Paid: ${paidTenantCount}/${tenants.length} | Collected: ${money(collectedForBuilding)}</span>
        </summary>
      `;

      const list = document.createElement("div");
      list.className = "tenant-card-list";

      tenants
        .slice()
        .sort(compareTenantsByUnitAscending)
        .forEach((tenant) => {
          const payment = tenant.payments[safeMonth] || { status: "due", paidDate: "" };
          const paymentStatus = getPaymentStatus(tenant, safeMonth);
          const card = document.createElement("article");
          card.className = "tenant-card payment-card";
          card.innerHTML = `
            <div class="tenant-card-head">
              <div class="payment-head-left">
                <strong class="unit-header-badge">${escapeHtml(getTenantPropertyName(tenant))}</strong>
                <div class="payment-tenant-name">${escapeHtml(getTenantDisplayName(tenant))}</div>
              </div>
              <div class="payment-lease-center">
                <span>Lease</span>
                <strong>${formatDate(tenant.leaseStart)} to ${formatDate(tenant.leaseEnd)}</strong>
              </div>
              <div class="tenant-card-right"></div>
            </div>
            <div class="payment-summary-row">
              <div class="payment-summary-item"><span>Rent</span><strong>${money(tenant.monthlyRent)}</strong></div>
              <div class="payment-summary-item"><span>Paid Date</span><strong class="payment-date-inline">${paymentStatus === "paid" && payment.paidDate ? formatDate(payment.paidDate) : "-"}</strong></div>
              <div class="payment-summary-item"><span>Status</span><strong><span class="pill ${paymentStatus}">${formatPaymentStatus(paymentStatus)}</span></strong></div>
            </div>
          `;

          const actionsCell = document.createElement("div");
          actionsCell.className = "actions";
          const rightCell = card.querySelector(".tenant-card-right");

          if (hasPermission("mark_paid") && paymentStatus !== "paid") {
            const markPaidBtn = document.createElement("button");
            markPaidBtn.type = "button";
            markPaidBtn.className = "btn btn-small mark-paid";
            markPaidBtn.textContent = "Mark Paid";
            markPaidBtn.addEventListener("click", () => markPaid(tenant.id));
            actionsCell.appendChild(markPaidBtn);
          }

          if (hasPermission("mark_unpaid") && paymentStatus === "paid") {
            const markUnpaidBtn = document.createElement("button");
            markUnpaidBtn.type = "button";
            markUnpaidBtn.className = "btn btn-small btn-muted mark-unpaid";
            markUnpaidBtn.textContent = "Mark Unpaid";
            markUnpaidBtn.addEventListener("click", () => markUnpaid(tenant.id));
            actionsCell.appendChild(markUnpaidBtn);
          }

          if (hasPermission("notify_tenant") && paymentStatus !== "paid") {
            const notifyBtn = document.createElement("button");
            notifyBtn.type = "button";
            notifyBtn.className = "btn btn-small";
            notifyBtn.textContent = "Notify Payment";
            notifyBtn.addEventListener("click", () => notifyTenant(tenant, safeMonth));
            actionsCell.appendChild(notifyBtn);
          }

          if (hasPermission("mark_paid") && paymentStatus === "paid") {
            const receiptBtn = document.createElement("button");
            receiptBtn.type = "button";
            receiptBtn.className = "btn btn-small";
            receiptBtn.textContent = "Print Receipt";
            receiptBtn.addEventListener("click", () => printRentalReceipt(tenant, safeMonth));
            actionsCell.appendChild(receiptBtn);
          }

          if (!actionsCell.children.length) {
            actionsCell.textContent = "No actions";
          }
          rightCell.appendChild(actionsCell);

          card.dataset.tenantId = tenant.id;
          list.appendChild(card);
        });

      group.appendChild(list);
      dashboardTenantGroupsEl.appendChild(group);
  });
}

function setAllDashboardTenantGroups(isOpen) {
  dashboardTenantGroupsEl.querySelectorAll(".dashboard-group").forEach((group) => {
    group.open = isOpen;
  });
}

function printRentalReceipt(tenant, monthKey) {
  const payment = tenant.payments?.[monthKey] || {};
  const status = getPaymentStatus(tenant, monthKey);
  if (status !== "paid") {
    alert("Receipt can be printed only for paid months.");
    return;
  }

  const buildingName = getTenantBuildingName(tenant);
  const unitNumber = getTenantUnitNumber(tenant);
  const buildingUnitLabel = `#${buildingName}, ${unitNumber}`;
  const buildingAddress = getBuildingAddress(buildingName);
  const printableAddress = buildingAddress ? `${buildingUnitLabel} ${buildingAddress}` : buildingUnitLabel;
  const paidDateRaw = payment.paidDate || new Date().toISOString().slice(0, 10);
  const paidDate = formatDateDdMmYyyy(paidDateRaw);
  const paidPeriod = formatMonth(monthKey);
  const amountValue = Number(tenant.monthlyRent || 0);
  const amountWords = numberToWordsIndian(amountValue);
  const paymentMode = "Bank Transfer";
  const paymentRef = payment.refNo || payment.referenceNo || payment.utr || "-";
  const landlordName = getBuildingLandlord(buildingName) || state.notifyConfig.senderName || "Rental Management";
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Popup blocked. Please allow popups and try again.");
    return;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>Rental Receipt - ${escapeHtml(getTenantPropertyName(tenant))}</title>
        <style>
          body { font-family: "Times New Roman", serif; color: #111; margin: 0; padding: 28px; }
          .receipt { max-width: 820px; margin: 0 auto; border: 1px solid #222; padding: 26px; }
          h1 { margin: 0 0 18px; font-size: 30px; text-align: center; letter-spacing: 0.08em; }
          p { margin: 12px 0; font-size: 18px; line-height: 1.5; }
          .line { display: inline-block; border-bottom: 1px solid #222; padding: 0 4px; min-width: 60px; }
          .line-wide { min-width: 360px; }
          .line-medium { min-width: 220px; }
          .line-small { min-width: 120px; }
          .sign-row { margin-top: 34px; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <h1>RENT RECEIPT</h1>
          <p>Date: <span class="line line-small">${escapeHtml(paidDate)}</span></p>
          <p>
            Received a sum of ₹<span class="line line-small">${escapeHtml(String(amountValue))}</span>
            (in words: <span class="line line-wide">${escapeHtml(amountWords)}</span>)
            from Mr./Ms. <span class="line line-medium">${escapeHtml(tenant.tenantName || "-")}</span>
            towards the rent of the premises located at
            <span class="line line-wide">${escapeHtml(printableAddress)}</span>
            for the period <span class="line line-small">${escapeHtml(paidPeriod)}</span>.
          </p>
          <p>
            Payment Mode: Cash / Cheque / Bank Transfer
            (UTR/Ref No: <span class="line line-medium">${escapeHtml(paymentMode === "Bank Transfer" ? paymentRef : "-")}</span>)
          </p>
          <p class="sign-row">
            Landlord Name: <span class="line line-medium">${escapeHtml(landlordName)}</span>
          </p>
          <p>
            Landlord Signature: <span class="line line-medium"></span>
          </p>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function formatDateDdMmYyyy(yyyyMmDd) {
  const raw = String(yyyyMmDd || "").trim();
  if (!raw) return "-";
  const parts = raw.split("-");
  if (parts.length !== 3) return raw;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

function numberToWordsIndian(amount) {
  const n = Math.floor(Number(amount || 0));
  if (!Number.isFinite(n) || n <= 0) return "zero rupees only";
  const ones = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen"
  ];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

  function twoDigits(num) {
    if (num < 20) return ones[num];
    const t = Math.floor(num / 10);
    const o = num % 10;
    return `${tens[t]}${o ? ` ${ones[o]}` : ""}`.trim();
  }

  function threeDigits(num) {
    const h = Math.floor(num / 100);
    const rem = num % 100;
    const hText = h ? `${ones[h]} hundred` : "";
    const rText = rem ? twoDigits(rem) : "";
    return `${hText}${hText && rText ? " " : ""}${rText}`.trim();
  }

  let value = n;
  const crore = Math.floor(value / 10000000);
  value %= 10000000;
  const lakh = Math.floor(value / 100000);
  value %= 100000;
  const thousand = Math.floor(value / 1000);
  value %= 1000;
  const rest = value;

  const parts = [];
  if (crore) parts.push(`${twoDigits(crore)} crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} thousand`);
  if (rest) parts.push(threeDigits(rest));

  return `${parts.join(" ").trim()} rupees only`;
}

function getBuildingTotalsForMonth(monthKey, activeTenants) {
  const byBuilding = new Map();
  const knownBuildings = [
    ...new Set(
      state.units
        .map((unit) => String(unit.buildingName || "").trim())
        .filter(Boolean)
        .concat(activeTenants.map((tenant) => getTenantBuildingName(tenant)))
    )
  ].sort((a, b) => a.localeCompare(b));

  knownBuildings.forEach((building) => {
    byBuilding.set(building, { expected: 0, collected: 0 });
  });

  activeTenants.forEach((tenant) => {
    const building = getTenantBuildingName(tenant);
    if (!byBuilding.has(building)) {
      byBuilding.set(building, { expected: 0, collected: 0 });
    }
    const bucket = byBuilding.get(building);
    bucket.expected += Number(tenant.monthlyRent || 0);
    if (getPaymentStatus(tenant, monthKey) === "paid") {
      bucket.collected += Number(tenant.monthlyRent || 0);
    }
  });

  return [...byBuilding.entries()];
}

function getBuildingDepositTotals(activeTenants) {
  const totals = new Map();
  activeTenants.forEach((tenant) => {
    const building = getTenantBuildingName(tenant);
    const current = totals.get(building) || 0;
    totals.set(building, current + Number(tenant.deposit || 0));
  });
  return totals;
}


function renderLeaseStatusRows() {
  leaseStatusGroupsEl.innerHTML = "";
  const currentMonthKey = getCurrentMonth();
  if (leaseStatusMonthLabelEl) {
    leaseStatusMonthLabelEl.textContent = formatMonth(currentMonthKey);
  }

  if (!state.tenants.length) {
    const empty = document.createElement("div");
    empty.className = "empty-note";
    empty.textContent = "No tenants yet. Add your first tenant above.";
    leaseStatusGroupsEl.appendChild(empty);
    return;
  }

  groupByBuilding(state.tenants, getTenantBuildingName).forEach(([building, tenants]) => {
      const dueMonthsCount = tenants.reduce((sum, tenant) => {
        const tenantDueMonths = getLeaseMonths(tenant.leaseStart, tenant.leaseEnd).reduce((count, monthKey) => {
          if (monthKey > currentMonthKey) return count;
          const status = getPaymentStatus(tenant, monthKey);
          return status === "paid" ? count : count + 1;
        }, 0);
        return sum + tenantDueMonths;
      }, 0);
      const group = document.createElement("details");
      group.className = "tenant-group lease-group";
      group.open = false;
      group.innerHTML = `
        <summary>
          <span>${escapeHtml(building)}</span>
          <span class="tenant-group-count">${tenants.length} tenant${tenants.length === 1 ? "" : "s"} | Due Months: ${dueMonthsCount}</span>
        </summary>
      `;

      const list = document.createElement("div");
      list.className = "tenant-card-list";

      tenants
        .slice()
        .sort(compareTenantsByUnitAscending)
        .forEach((tenant) => {
          const statusChips = getLeaseMonths(tenant.leaseStart, tenant.leaseEnd)
            .map((monthKey) => {
              const paymentStatus = getPaymentStatus(tenant, monthKey);
              if (paymentStatus === "paid") {
                return `<span class="lease-chip paid">${formatMonthShort(monthKey)}: Paid</span>`;
              }
              if (monthKey > currentMonthKey) {
                return `<span class="lease-chip future">${formatMonthShort(monthKey)}: Future</span>`;
              }
              return `<span class="lease-chip due">${formatMonthShort(monthKey)}: Due</span>`;
            })
            .join("");

          const card = document.createElement("article");
          card.className = "tenant-card lease-status-card";
          card.innerHTML = `
            <div class="tenant-card-head lease-inline-head">
              <div class="lease-inline-left">
                <strong class="unit-header-badge">${escapeHtml(getTenantPropertyName(tenant))}</strong>
                <span class="lease-inline-name">${escapeHtml(getTenantDisplayName(tenant))}</span>
              </div>
              <div class="tenant-card-right">
                <div class="tenant-lease"><span>Lease</span><strong>${formatDate(tenant.leaseStart)} to ${formatDate(tenant.leaseEnd)}</strong></div>
              </div>
            </div>
            <div class="tenant-card-notes"><span>All Monthly Status:</span> <div class="lease-chip-wrap">${statusChips}</div></div>
          `;
          list.appendChild(card);
        });

      group.appendChild(list);
      leaseStatusGroupsEl.appendChild(group);
  });
}

function setAllLeaseStatusGroups(isOpen) {
  leaseStatusGroupsEl.querySelectorAll(".lease-group").forEach((group) => {
    group.open = isOpen;
  });
}

function markPaid(tenantId) {
  if (!hasPermission("mark_paid")) {
    alert("You do not have permission to mark rent paid.");
    return;
  }
  const tenant = state.tenants.find((entry) => entry.id === tenantId);
  if (!tenant) return;
  if (!isTenantActiveForMonth(tenant, state.activeMonth)) return;
  const role = getCurrentRole();
  const existing = tenant.payments[state.activeMonth] || { status: "due", paidDate: "" };
  const today = new Date().toISOString().slice(0, 10);

  if (role === "manager") {
    if (getPaymentStatus(tenant, state.activeMonth) === "paid") {
      alert("This payment is already verified and marked as paid.");
      return;
    }
    tenant.payments[state.activeMonth] = {
      ...existing,
      status: "review",
      reviewDate: today,
      paid: false
    };
    notifyAdminsForReview(tenant, state.activeMonth).catch(() => {
      alert("Payment marked as Review, but failed to send admin review email.");
    });
  } else {
    tenant.payments[state.activeMonth] = {
      ...existing,
      status: "paid",
      paidDate: today,
      paid: true
    };
  }
  saveState();
  renderAll();
}

function markUnpaid(tenantId) {
  if (!hasPermission("mark_unpaid")) {
    alert("You do not have permission to mark rent unpaid.");
    return;
  }
  const tenant = state.tenants.find((entry) => entry.id === tenantId);
  if (!tenant) return;
  if (!isTenantActiveForMonth(tenant, state.activeMonth)) return;
  tenant.payments[state.activeMonth] = { status: "due", paid: false, paidDate: "" };
  saveState();
  renderAll();
}

function removeTenant(tenantId) {
  if (!hasPermission("tenant_delete")) {
    alert("You do not have permission to delete tenants.");
    return;
  }
  const approved = confirm("Delete this tenant and all payment history?");
  if (!approved) return;
  const tenant = state.tenants.find((entry) => entry.id === tenantId);
  const linkedUnitId = tenant?.linkedUnitId || "";
  const docsToDelete = Array.isArray(tenant?.documents) ? tenant.documents : [];
  state.tenants = state.tenants.filter((entry) => entry.id !== tenantId);
  deleteRemoteDocuments(docsToDelete).catch(() => {});
  if (linkedUnitId) {
    const stillLinked = state.tenants.some((entry) => entry.linkedUnitId === linkedUnitId);
    if (!stillLinked) {
      const unit = state.units.find((entry) => entry.id === linkedUnitId);
      if (unit) {
        unit.status = "vacant";
        unit.tenantName = "";
      }
    }
  }
  saveState();
  renderAll();
}

function onAddUnit(event) {
  event.preventDefault();
  if (!hasPermission("unit_add")) {
    alert("You do not have permission to add or update units.");
    return;
  }
  const buildingName = normalizeUnitText(buildingNameEl.value);
  const unitNumber = normalizeUnitText(unitNumberEl.value);
  const status = occupancyStatusEl.value;
  const tenantName = status === "occupied" ? unitTenantNameEl.value.trim() : "";
  const notes = unitNotesEl.value.trim();

  if (!buildingName || !unitNumber) return;
  if (status === "occupied" && !tenantName) {
    alert("Tenant name is required for occupied units.");
    return;
  }

  const currentEditingUnitId = editingUnitId || "";

  const newUnitKey = getUnitKey(buildingName, unitNumber);
  const existingUnit = state.units.find(
    (unit) => unit.id !== currentEditingUnitId && getUnitKey(unit.buildingName, unit.unitNumber) === newUnitKey
  );
  if (existingUnit) {
    setActiveTab("available-units");
    setTimeout(() => {
      const card = unitGroupsEl.querySelector(`[data-unit-id="${existingUnit.id}"]`);
      if (!card) return;
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.add("row-highlight");
      window.setTimeout(() => card.classList.remove("row-highlight"), 1700);
    }, 60);
    alert(
      `Unit already exists: ${existingUnit.buildingName} - ${existingUnit.unitNumber}. It has been highlighted in Available Units.`
    );
    return;
  }

  if (status === "occupied") {
    const tenantAssignedElsewhere = state.units.find(
      (unit) =>
        unit.id !== currentEditingUnitId &&
        unit.status === "occupied" &&
        String(unit.tenantName || "").trim().toLowerCase() === tenantName.toLowerCase()
    );
    if (tenantAssignedElsewhere) {
      alert(
        `Tenant "${tenantName}" is already tagged to ${tenantAssignedElsewhere.buildingName} - ${tenantAssignedElsewhere.unitNumber}. One tenant can be tagged to only one unit.`
      );
      return;
    }

    const selectedTenant = state.tenants.find(
      (tenant) => String(tenant.tenantName || "").trim().toLowerCase() === tenantName.toLowerCase()
    );
    if (selectedTenant && selectedTenant.linkedUnitId && selectedTenant.linkedUnitId !== currentEditingUnitId) {
      const linkedUnit = state.units.find((entry) => entry.id === selectedTenant.linkedUnitId);
      const linkedLabel = linkedUnit ? `${linkedUnit.buildingName} - ${linkedUnit.unitNumber}` : "another unit";
      alert(`Tenant "${selectedTenant.tenantName}" is already linked to ${linkedLabel}.`);
      return;
    }
  }

  const previousUnitState = editingUnitId
    ? state.units.find((entry) => entry.id === editingUnitId)
    : null;
  const previousTenantName = previousUnitState?.tenantName || "";
  const previousStatus = previousUnitState?.status || "vacant";

  let savedUnit = null;
  if (editingUnitId) {
    const unit = state.units.find((entry) => entry.id === editingUnitId);
    if (!unit) return;
    unit.buildingName = buildingName;
    unit.unitNumber = unitNumber;
    unit.status = status;
    unit.tenantName = tenantName;
    unit.notes = notes;
    savedUnit = unit;
  } else {
    savedUnit = {
      id: crypto.randomUUID(),
      buildingName,
      unitNumber,
      status,
      tenantName,
      notes
    };
    state.units.push(savedUnit);
  }

  syncTenantLinksFromUnit(savedUnit, {
    previousTenantName,
    previousStatus
  });

  resetUnitForm();
  saveState();
  renderAll();
}

function syncTenantLinksFromUnit(unit, options = {}) {
  if (!unit) return;
  const previousTenantName = String(options.previousTenantName || "").trim();
  const previousStatus = String(options.previousStatus || "vacant");
  const currentTenantName = String(unit.tenantName || "").trim();
  const isOccupied = unit.status === "occupied" && currentTenantName;

  const clearLinkByUnitId = () => {
    state.tenants.forEach((tenant) => {
      if (tenant.linkedUnitId === unit.id) {
        tenant.linkedUnitId = "";
        tenant.propertyName = "";
      }
    });
  };

  const clearSpecificTenantLink = (tenantName) => {
    const name = String(tenantName || "").trim().toLowerCase();
    if (!name) return;
    state.tenants.forEach((tenant) => {
      if (String(tenant.tenantName || "").trim().toLowerCase() === name && tenant.linkedUnitId === unit.id) {
        tenant.linkedUnitId = "";
        tenant.propertyName = "";
      }
    });
  };

  if (!isOccupied) {
    clearLinkByUnitId();
    return;
  }

  const selectedTenant = state.tenants.find(
    (tenant) => String(tenant.tenantName || "").trim().toLowerCase() === currentTenantName.toLowerCase()
  );
  if (!selectedTenant) return;

  if (previousStatus === "occupied" && previousTenantName && previousTenantName.toLowerCase() !== currentTenantName.toLowerCase()) {
    clearSpecificTenantLink(previousTenantName);
  }

  state.tenants.forEach((tenant) => {
    if (tenant.linkedUnitId === unit.id && tenant.id !== selectedTenant.id) {
      tenant.linkedUnitId = "";
      tenant.propertyName = "";
    }
  });

  selectedTenant.linkedUnitId = unit.id;
  selectedTenant.propertyName = getUnitLabel(unit);
}

function renderUnits() {
  unitGroupsEl.innerHTML = "";
  const occupancy = getUnitOccupancySummary();
  const byBuilding = new Map(occupancy.byBuilding);

  if (!state.units.length) {
    const empty = document.createElement("div");
    empty.className = "empty-note";
    empty.textContent = "No units yet. Add your first building unit above.";
    unitGroupsEl.appendChild(empty);
  } else {
    groupByBuilding(state.units, (unit) => String(unit.buildingName || "").trim() || "Unknown").forEach(
      ([building, units]) => {
        const group = document.createElement("details");
        group.className = "tenant-group unit-group";
        group.open = false;
        const counts = byBuilding.get(building) || { total: units.length, occupied: 0, vacant: units.length };
        group.innerHTML = `
          <summary>
            <span>${escapeHtml(building)}</span>
            <span class="tenant-group-count">Total: ${counts.total} | Occupied: ${counts.occupied} | Vacant: ${counts.vacant}</span>
          </summary>
        `;

        const list = document.createElement("div");
        list.className = "tenant-card-list";

        units
          .slice()
          .sort(compareUnitsAscending)
          .forEach((unit) => {
            const occupiedNow = unit.status === "occupied";
            const statusLabel = occupiedNow ? "occupied" : "vacant";
            const activeTenantName = unit.tenantName || "";
            const actions = [];
            if (hasPermission("unit_edit")) {
              actions.push('<button class="btn btn-small edit-unit">Edit</button>');
            }
            if (hasPermission("unit_delete")) {
              actions.push('<button class="btn btn-small btn-danger delete-unit">Delete</button>');
            }
            const card = document.createElement("article");
            card.className = "tenant-card unit-card";
            card.dataset.unitId = unit.id;
            const statusHtml = `<span class="unit-status-pill ${statusLabel}">${occupiedNow ? "Occupied" : "Vacant"}</span>`;
            card.innerHTML = `
              ${buildTenantCardHeader({
                propertyLabel: getUnitLabel(unit),
                tenantName: activeTenantName || "-",
                actionsHtml: statusHtml,
                propertyClass: "unit-header-badge"
              })}
              <div class="actions unit-card-actions">${actions.join("") || "<span>No actions</span>"}</div>
              <div class="tenant-card-notes"><span>Notes:</span> ${unit.notes ? escapeHtml(unit.notes) : "-"}</div>
            `;
            if (hasPermission("unit_edit")) {
              card.querySelector(".edit-unit").addEventListener("click", () => startEditUnit(unit.id));
            }
            if (hasPermission("unit_delete")) {
              card.querySelector(".delete-unit").addEventListener("click", () => removeUnit(unit.id));
            }
            list.appendChild(card);
          });

        group.appendChild(list);
        unitGroupsEl.appendChild(group);
      }
    );
  }

  const occupiedCount = occupancy.occupied;
  const vacantCount = occupancy.vacant;
  const sortedByBuilding = [...byBuilding.entries()].sort(([a], [b]) => a.localeCompare(b));
  const totalUnitsBreakdown = sortedByBuilding
    .map(([building, totals]) => `${escapeHtml(building)} Total Units: ${totals.total}`)
    .join("<br>");
  const occupiedUnitsBreakdown = sortedByBuilding
    .map(([building, totals]) => `${escapeHtml(building)} Occupied Units: ${totals.occupied}`)
    .join("<br>");
  const vacantUnitsBreakdown = sortedByBuilding
    .map(([building, totals]) => `${escapeHtml(building)} Vacant Units: ${totals.vacant}`)
    .join("<br>");

  const overallSummaryHtml = `
    <div class="metric-box">Total Units<strong>${state.units.length}</strong><small>${totalUnitsBreakdown || "-"}</small></div>
    <div class="metric-box">Occupied Units<strong>${occupiedCount}</strong><small>${occupiedUnitsBreakdown || "-"}</small></div>
    <div class="metric-box">Vacant Units<strong>${vacantCount}</strong><small>${vacantUnitsBreakdown || "-"}</small></div>
  `;
  if (unitSummaryEl) {
    unitSummaryEl.innerHTML = overallSummaryHtml;
  }
  if (unitOverallSummaryEl) {
    unitOverallSummaryEl.innerHTML = overallSummaryHtml;
  }

  if (unitBuildingSummaryEl) {
    unitBuildingSummaryEl.innerHTML = "";
    unitBuildingSummaryEl.classList.add("hidden");
  }
  const buildingSummaryHeading = document.querySelector('[data-tab-panel="available-units"] .subhead');
  if (buildingSummaryHeading) {
    buildingSummaryHeading.classList.add("hidden");
  }
}

function setAllUnitGroups(isOpen) {
  unitGroupsEl.querySelectorAll(".unit-group").forEach((group) => {
    group.open = isOpen;
  });
}

function getUnitOccupancySummary() {
  const byBuilding = new Map();
  const totals = { total: 0, occupied: 0, vacant: 0, byBuilding };

  state.units.forEach((unit) => {
    const building = String(unit.buildingName || "").trim() || "Unknown";
    if (!byBuilding.has(building)) {
      byBuilding.set(building, { total: 0, occupied: 0, vacant: 0 });
    }
    const bucket = byBuilding.get(building);
    const occupied = unit.status === "occupied";
    bucket.total += 1;
    bucket.occupied += occupied ? 1 : 0;
    bucket.vacant += occupied ? 0 : 1;
    totals.total += 1;
    totals.occupied += occupied ? 1 : 0;
    totals.vacant += occupied ? 0 : 1;
  });

  return totals;
}

function notifyTenant(tenant, monthKey) {
  if (!hasPermission("notify_tenant")) {
    alert("You do not have permission to notify tenants.");
    return;
  }
  if (!tenant.email) {
    alert("Tenant email is missing.");
    return;
  }
  if (!isEmailServiceConfigured()) {
    alert("Email service is not configured. Admin must configure EmailJS in Settings.");
    return;
  }
  sendReminderByEmailJs(tenant, monthKey)
    .then(() => {
      alert(`Reminder email sent to ${tenant.email}`);
    })
    .catch(() => {
      alert("Failed to send email reminder. Check EmailJS settings/template.");
    });
}

function renderNotifyConfig() {
  const canManage = hasPermission("manage_notify_lists");
  settingsTabBtnEl.classList.toggle("hidden", !canManage);
  settingsPanelEl.classList.toggle("hidden", !canManage);
  if (!canManage) {
    if (document.querySelector('[data-tab-panel="settings"]').classList.contains("active")) {
      setActiveTab("dashboard");
    }
    return;
  }
  adminEmailListEl.value = state.notifyConfig.admins.join(", ");
  managerEmailListEl.value = state.notifyConfig.managers.join(", ");
  emailjsPublicKeyEl.value = state.notifyConfig.emailjsPublicKey || "";
  emailjsServiceIdEl.value = state.notifyConfig.emailjsServiceId || "";
  emailjsTemplateIdEl.value = state.notifyConfig.emailjsTemplateId || "";
  notifySenderNameEl.value = state.notifyConfig.senderName || "Rental Management";
  reviewSubjectTemplateEl.value =
    state.notifyConfig.reviewSubjectTemplate || "Payment Review Required: {unit} {tenant name}";
  renderBuildingAddressFields();
}

function saveNotifyConfig() {
  if (!hasPermission("manage_notify_lists")) {
    alert("You do not have permission to manage email lists.");
    return;
  }
  state.notifyConfig.admins = parseEmailList(adminEmailListEl.value);
  state.notifyConfig.managers = parseEmailList(managerEmailListEl.value);
  state.notifyConfig.emailjsPublicKey = emailjsPublicKeyEl.value.trim();
  state.notifyConfig.emailjsServiceId = emailjsServiceIdEl.value.trim();
  state.notifyConfig.emailjsTemplateId = emailjsTemplateIdEl.value.trim();
  state.notifyConfig.senderName = notifySenderNameEl.value.trim() || "Rental Management";
  state.notifyConfig.reviewSubjectTemplate =
    reviewSubjectTemplateEl.value.trim() || "Payment Review Required: {unit} {tenant name}";
  state.notifyConfig.buildingAddresses = getBuildingAddressesFromSettings();
  state.notifyConfig.buildingLandlords = getBuildingLandlordsFromSettings();
  saveState();
  alert("Notification, email service settings, and building details saved.");
}

function exportMonthlyReportPdf() {
  if (!isAuthenticated()) {
    alert("Please login to export monthly report.");
    return;
  }

  const monthKey = state.activeMonth;
  const monthLabel = formatMonth(monthKey);
  const totalTenants = state.tenants.length;
  const activeTenants = getActiveTenantsForMonth(monthKey);
  const inactiveTenants = state.tenants.filter((tenant) => !isTenantActiveForMonth(tenant, monthKey));
  const byBuilding = new Map();
  const paidTenants = [];
  const unpaidTenants = [];

  activeTenants.forEach((tenant) => {
    const building = getTenantBuildingName(tenant);
    if (!byBuilding.has(building)) {
      byBuilding.set(building, {
        paidTenants: 0,
        paidAmount: 0,
        pendingTenants: 0,
        pendingAmount: 0,
        totalRent: 0
      });
    }
    const status = getPaymentStatus(tenant, monthKey);
    const rent = Number(tenant.monthlyRent || 0);
    const bucket = byBuilding.get(building);
    bucket.totalRent += rent;
    if (status === "paid") {
      bucket.paidTenants += 1;
      bucket.paidAmount += rent;
      paidTenants.push({
        building: getTenantBuildingName(tenant),
        unit: getTenantPropertyName(tenant),
        tenantName: tenant.tenantName,
        mobile: tenant.mobile || "-",
        paidDate: tenant.payments?.[monthKey]?.paidDate ? formatDate(tenant.payments[monthKey].paidDate) : "-",
        amount: rent
      });
    } else {
      bucket.pendingTenants += 1;
      bucket.pendingAmount += rent;
      unpaidTenants.push({
        building: getTenantBuildingName(tenant),
        unit: getTenantPropertyName(tenant),
        tenantName: tenant.tenantName,
        mobile: tenant.mobile || "-",
        paidDate: "-",
        amount: rent,
        status: formatPaymentStatus(status)
      });
    }
  });

  const buildingRowsHtml = [...byBuilding.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([building, summary]) => {
      return `
        <tr>
          <td>${escapeHtml(building)}</td>
          <td>${money(summary.totalRent)}</td>
          <td>${money(summary.paidAmount)}</td>
          <td>${money(summary.pendingAmount)}</td>
        </tr>
      `;
    })
    .join("");

  const overall = [...byBuilding.values()].reduce(
    (acc, summary) => {
      acc.expected += summary.totalRent;
      acc.collected += summary.paidAmount;
      acc.dues += summary.pendingAmount;
      return acc;
    },
    { expected: 0, collected: 0, dues: 0 }
  );

  const paidRowsByBuilding = new Map();
  paidTenants.forEach((entry) => {
    if (!paidRowsByBuilding.has(entry.building)) paidRowsByBuilding.set(entry.building, []);
    paidRowsByBuilding.get(entry.building).push(entry);
  });

  const unpaidRowsByBuilding = new Map();
  unpaidTenants.forEach((entry) => {
    if (!unpaidRowsByBuilding.has(entry.building)) unpaidRowsByBuilding.set(entry.building, []);
    unpaidRowsByBuilding.get(entry.building).push(entry);
  });

  const paidSectionsHtml = [...paidRowsByBuilding.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([building, rows]) => {
      const rowHtml = rows
        .slice()
        .sort((a, b) => a.tenantName.localeCompare(b.tenantName))
        .map(
          (entry) => `
            <tr>
              <td>${escapeHtml(entry.unit)}</td>
              <td>${escapeHtml(entry.tenantName)}</td>
              <td>${escapeHtml(entry.mobile)}</td>
              <td>${escapeHtml(entry.paidDate)}</td>
              <td>${money(entry.amount)}</td>
            </tr>
          `
        )
        .join("");
      return `
        <h3>${escapeHtml(building)}</h3>
        <table>
          <thead>
            <tr>
              <th>Unit</th><th>Tenant Name</th><th>Mobile</th><th>Paid Date</th><th>Amount</th>
            </tr>
          </thead>
          <tbody>${rowHtml}</tbody>
        </table>
      `;
    })
    .join("");

  const unpaidSectionsHtml = [...unpaidRowsByBuilding.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([building, rows]) => {
      const rowHtml = rows
        .slice()
        .sort((a, b) => a.tenantName.localeCompare(b.tenantName))
        .map(
          (entry) => `
            <tr>
              <td>${escapeHtml(entry.unit)}</td>
              <td>${escapeHtml(entry.tenantName)}</td>
              <td>${escapeHtml(entry.mobile)}</td>
              <td>${escapeHtml(entry.status)}</td>
              <td>${money(entry.amount)}</td>
            </tr>
          `
        )
        .join("");
      return `
        <h3>${escapeHtml(building)}</h3>
        <table>
          <thead>
            <tr>
              <th>Unit</th><th>Tenant Name</th><th>Mobile</th><th>Status</th><th>Amount</th>
            </tr>
          </thead>
          <tbody>${rowHtml}</tbody>
        </table>
      `;
    })
    .join("");

  const inactiveRowsHtml = inactiveTenants
    .slice()
    .sort((a, b) => getTenantBuildingName(a).localeCompare(getTenantBuildingName(b)) || a.tenantName.localeCompare(b.tenantName))
    .map(
      (tenant) => `
        <tr>
          <td>${escapeHtml(getTenantBuildingName(tenant))}</td>
          <td>${escapeHtml(getTenantPropertyName(tenant))}</td>
          <td>${escapeHtml(tenant.tenantName)}</td>
          <td>${escapeHtml(formatDate(tenant.leaseStart))}</td>
          <td>${escapeHtml(formatDate(tenant.leaseEnd))}</td>
        </tr>
      `
    )
    .join("");

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Popup blocked. Please allow popups and try Export again.");
    return;
  }
  printWindow.document.write(`
    <html>
      <head>
        <title>Monthly Report - ${escapeHtml(monthLabel)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #1a1a1a; padding: 24px; }
          h1, h2 { margin: 0 0 10px; }
          h3 { margin: 10px 0 6px; font-size: 14px; }
          p { margin: 0 0 14px; color: #444; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0 22px; }
          th, td { border: 1px solid #d5d5d5; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #f0ece7; }
          .meta { margin-bottom: 16px; }
          .empty { color: #666; font-style: italic; padding: 8px 0 16px; }
        </style>
      </head>
      <body>
        <h1>Monthly Rent Report</h1>
        <div class="meta">
          <p><strong>Month:</strong> ${escapeHtml(monthLabel)}</p>
          <p><strong>Generated:</strong> ${escapeHtml(new Date().toLocaleString("en-IN"))}</p>
          <p><strong>Tenant Count:</strong> Total ${totalTenants} | Active ${activeTenants.length} | Out of lease ${inactiveTenants.length}</p>
        </div>

        <h2>Overall Summary</h2>
        <table>
          <thead>
            <tr>
              <th>Overall Expected</th><th>Overall Collected</th><th>Overall Dues</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${money(overall.expected)}</td><td>${money(overall.collected)}</td><td>${money(overall.dues)}</td>
            </tr>
          </tbody>
        </table>

        <h2>Building Summary</h2>
        ${
          byBuilding.size
            ? `<table>
                <thead>
                  <tr>
                    <th>Building</th><th>Expected</th><th>Collected</th><th>Dues</th>
                  </tr>
                </thead>
                <tbody>${buildingRowsHtml}</tbody>
              </table>`
            : '<div class="empty">No active tenants for selected month.</div>'
        }

        <h2>Paid Tenants</h2>
        ${
          paidTenants.length
            ? paidSectionsHtml
            : '<div class="empty">No paid tenants for selected month.</div>'
        }

        <h2>Not Paid Tenants</h2>
        ${
          unpaidTenants.length
            ? unpaidSectionsHtml
            : '<div class="empty">No pending tenants for selected month.</div>'
        }

        <h2>Out of Lease (Selected Month)</h2>
        ${
          inactiveTenants.length
            ? `<table>
                <thead>
                  <tr>
                    <th>Building</th><th>Unit</th><th>Tenant Name</th><th>Lease Start</th><th>Lease End</th>
                  </tr>
                </thead>
                <tbody>${inactiveRowsHtml}</tbody>
              </table>`
            : '<div class="empty">All tenants are active for selected month.</div>'
        }
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function removeUnit(unitId) {
  if (!hasPermission("unit_delete")) {
    alert("You do not have permission to delete units.");
    return;
  }
  const approved = confirm("Delete this unit?");
  if (!approved) return;
  state.units = state.units.filter((unit) => unit.id !== unitId);
  if (editingUnitId === unitId) {
    resetUnitForm();
  }
  saveState();
  renderAll();
}

function renderTenantNameOptions() {
  if (!unitTenantNameEl) return;
  const currentValue = unitTenantNameEl.value;
  const uniqueNames = [...new Set(state.tenants.map((tenant) => tenant.tenantName).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: "base" }));
  unitTenantNameEl.innerHTML =
    `<option value="">Select tenant from Active Tenants</option>` +
    uniqueNames.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  if (currentValue && uniqueNames.includes(currentValue)) {
    unitTenantNameEl.value = currentValue;
  }
}

function renderPropertyNameOptions() {
  const addCurrent = propertyNameSelectEl.value;
  const editCurrent = editPropertyNameSelectEl.value;
  propertyNameSelectEl.innerHTML = `<option value="">Select Building - Unit</option>${getAddTenantUnitOptionsHtml()}`;
  editPropertyNameSelectEl.innerHTML = `<option value="">Select Building - Unit</option>${getUnitOptionsHtml()}`;
  if (addCurrent && state.units.some((unit) => unit.id === addCurrent && unit.status === "vacant")) {
    propertyNameSelectEl.value = addCurrent;
  }
  if (editCurrent && state.units.some((unit) => unit.id === editCurrent)) {
    editPropertyNameSelectEl.value = editCurrent;
  }
}

function syncUnitTenantField() {
  const occupied = occupancyStatusEl.value === "occupied";
  unitTenantNameEl.disabled = !occupied;
  if (!occupied) {
    unitTenantNameEl.value = "";
  }
}

function startEditUnit(unitId) {
  if (!hasPermission("unit_edit")) {
    alert("You do not have edit access.");
    return;
  }
  const unit = state.units.find((entry) => entry.id === unitId);
  if (!unit) return;
  unitAddCardEl.classList.remove("hidden");
  editingUnitId = unit.id;
  buildingNameEl.value = unit.buildingName;
  unitNumberEl.value = unit.unitNumber;
  occupancyStatusEl.value = unit.status;
  unitTenantNameEl.value = unit.tenantName || "";
  unitNotesEl.value = unit.notes || "";
  syncUnitTenantField();
  unitFormTitleEl.textContent = "Unit Occupancy - Edit Unit";
  unitSubmitBtnEl.textContent = "Update Unit";
  cancelUnitEditEl.textContent = "Cancel Edit";
}

function cancelUnitEdit() {
  resetUnitForm();
  unitAddCardEl.classList.add("hidden");
}

function resetUnitForm() {
  editingUnitId = "";
  unitFormEl.reset();
  occupancyStatusEl.value = "vacant";
  syncUnitTenantField();
  unitFormTitleEl.textContent = "Unit Occupancy - Add Unit";
  unitSubmitBtnEl.textContent = "Save Unit";
  cancelUnitEditEl.textContent = "Cancel";
}

function setUnitVacant(unitId) {
  if (!hasPermission("unit_set_vacant")) {
    alert("You do not have edit access.");
    return;
  }
  const unit = state.units.find((entry) => entry.id === unitId);
  if (!unit) return;
  unit.status = "vacant";
  unit.tenantName = "";
  if (editingUnitId === unitId) {
    buildingNameEl.value = unit.buildingName;
    unitNumberEl.value = unit.unitNumber;
    occupancyStatusEl.value = unit.status;
    unitTenantNameEl.value = "";
    syncUnitTenantField();
  }
  saveState();
  renderAll();
}

async function initializeDataLayer() {
  const appConfig = window.APP_CONFIG || {};
  const supabaseUrl = String(appConfig.SUPABASE_URL || "").trim();
  const supabaseAnonKey = String(appConfig.SUPABASE_ANON_KEY || "").trim();
  sharedStateRowId = String(appConfig.SHARED_STATE_ROW_ID || "shared").trim() || "shared";
  supabaseDocBucket =
    String(appConfig.SUPABASE_STORAGE_BUCKET || DEFAULT_SUPABASE_DOC_BUCKET).trim() || DEFAULT_SUPABASE_DOC_BUCKET;

  if (supabaseUrl && supabaseAnonKey && window.supabase?.createClient) {
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
    remoteEnabled = true;
    const remoteLoaded = await loadRemoteState();
    if (!remoteLoaded) {
      loadLocalState();
      await saveRemoteState();
    }
    subscribeToRemoteChanges();
    return;
  }

  loadLocalState();
}

function loadLocalState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    applyParsedState(JSON.parse(raw));
  } catch {
    state.tenants = [];
    state.units = [];
  }
}

function saveState() {
  if (remoteEnabled) {
    saveRemoteState().catch(() => {
      const savedLocal = saveLocalState(false);
      if (savedLocal) {
        if (!localStorage.getItem(REMOTE_FALLBACK_WARNED_KEY)) {
          alert("Remote sync failed. Saved locally on this device.");
          localStorage.setItem(REMOTE_FALLBACK_WARNED_KEY, "1");
        }
      } else {
        alert("Remote sync failed and local backup could not be saved. Please retry after internet is stable.");
      }
    });
    return;
  }
  saveLocalState(true);
}

function saveLocalState(showAlert = true) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getSerializedState()));
    return true;
  } catch {
    if (showAlert) {
      alert("Unable to save app data. Attached files are too large for browser storage.");
    }
    return false;
  }
}

async function loadRemoteState() {
  if (!supabaseClient) return false;
  const { data, error } = await supabaseClient
    .from("app_state")
    .select("data")
    .eq("id", sharedStateRowId)
    .maybeSingle();
  if (error || !data?.data) return false;
  applyParsedState(data.data);
  return true;
}

async function saveRemoteState() {
  if (!supabaseClient) return;
  const payload = {
    id: sharedStateRowId,
    data: getSerializedState(),
    updated_at: new Date().toISOString()
  };
  const { error } = await supabaseClient.from("app_state").upsert(payload);
  if (error) throw error;
}

function subscribeToRemoteChanges() {
  if (!supabaseClient) return;
  supabaseClient
    .channel("app_state_sync")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "app_state", filter: `id=eq.${sharedStateRowId}` },
      (payload) => {
        const incoming = payload.new?.data || payload.record?.data;
        if (!incoming) return;
        applyParsedState(incoming);
        activeMonthInput.value = state.activeMonth;
        renderAll();
      }
    )
    .subscribe();
}

function getSerializedState() {
  return {
    activeMonth: state.activeMonth,
    tenants: state.tenants,
    units: state.units,
    notifyConfig: state.notifyConfig
  };
}

function applyParsedState(parsed) {
  state.tenants = Array.isArray(parsed.tenants)
    ? parsed.tenants.map((tenant) => ({
        ...tenant,
        propertyName: tenant.propertyName || "",
        email: tenant.email || "",
        mobile: tenant.mobile || "",
        deposit: Number(tenant.deposit || 0),
        notes: tenant.notes || "",
        documents: Array.isArray(tenant.documents) ? tenant.documents : [],
        payments: normalizePayments(tenant.payments),
        linkedUnitId: tenant.linkedUnitId || ""
      }))
    : [];
  state.units = Array.isArray(parsed.units)
    ? parsed.units.map((unit) => ({
        id: unit.id || crypto.randomUUID(),
        buildingName: normalizeUnitText(unit.buildingName),
        unitNumber: normalizeUnitText(unit.unitNumber),
        status: unit.status === "occupied" ? "occupied" : "vacant",
        tenantName: unit.tenantName || "",
        notes: unit.notes || ""
      }))
    : [];
  state.notifyConfig = normalizeNotifyConfig(parsed.notifyConfig);
  relinkTenantsToUnits();
  state.activeMonth = sanitizeMonthKey(parsed.activeMonth);
}

function sanitizeMonthKey(value) {
  const raw = String(value || "").trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return raw;
  return getCurrentMonth();
}

function getPaymentStatus(tenant, monthKey) {
  const payment = tenant.payments?.[monthKey];
  if (!payment) return "due";
  if (payment.status === "paid" || payment.status === "review" || payment.status === "due") {
    return payment.status;
  }
  return payment.paid ? "paid" : "due";
}

function formatPaymentStatus(status) {
  if (status === "paid") return "Paid";
  if (status === "review") return "Review";
  return "Due";
}

function normalizePayments(payments) {
  if (!payments || typeof payments !== "object") return {};
  const normalized = {};
  Object.entries(payments).forEach(([monthKey, payment]) => {
    if (!payment || typeof payment !== "object") {
      normalized[monthKey] = { status: "due", paid: false, paidDate: "" };
      return;
    }
    const status =
      payment.status === "paid" || payment.status === "review" || payment.status === "due"
        ? payment.status
        : payment.paid
          ? "paid"
          : "due";
    normalized[monthKey] = {
      ...payment,
      status,
      paid: status === "paid"
    };
  });
  return normalized;
}

function getActiveTenantsForMonth(yyyyMm) {
  return state.tenants.filter((tenant) => isTenantActiveForMonth(tenant, yyyyMm));
}

function isTenantActiveForMonth(tenant, yyyyMm) {
  const [year, month] = yyyyMm.split("-").map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const leaseStart = new Date(tenant.leaseStart);
  const leaseEnd = new Date(tenant.leaseEnd);
  return leaseStart <= monthEnd && leaseEnd >= monthStart;
}

function getLeaseMonths(leaseStart, leaseEnd) {
  const months = [];
  const start = new Date(leaseStart);
  const end = new Date(leaseEnd);
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= endMonth) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    months.push(`${year}-${month}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

async function readFilesAsDocuments(fileList, options = {}) {
  const files = Array.from(fileList || []);
  if (!files.length) return [];
  if (remoteEnabled && supabaseClient) {
    return uploadFilesToSupabaseStorage(files, options.tenantId || crypto.randomUUID());
  }
  return Promise.all(
    files.map((file) =>
      fileToDataUrl(file).then((dataUrl) => ({
        name: file.name,
        type: file.type || "application/octet-stream",
        dataUrl
      }))
    )
  );
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read attached document."));
    reader.readAsDataURL(file);
  });
}

async function uploadFilesToSupabaseStorage(files, tenantId) {
  if (!supabaseClient) {
    throw new Error("Supabase client is not initialized.");
  }
  const storage = supabaseClient.storage.from(supabaseDocBucket);
  const uploaded = [];

  for (const file of files) {
    const safeName = sanitizeFileName(file.name || "document");
    const path = `${sharedStateRowId}/${tenantId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const { error } = await storage.upload(path, file, {
      upsert: false,
      cacheControl: "3600",
      contentType: file.type || "application/octet-stream"
    });
    if (error) {
      throw new Error(
        `Failed to upload "${file.name}". Ensure Supabase Storage bucket "${supabaseDocBucket}" exists and is writable.`
      );
    }
    const { data } = storage.getPublicUrl(path);
    uploaded.push({
      name: file.name,
      type: file.type || "application/octet-stream",
      path,
      url: data?.publicUrl || ""
    });
  }
  return uploaded;
}

function sanitizeFileName(name) {
  return String(name || "file")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function deleteRemoteDocuments(documents) {
  if (!remoteEnabled || !supabaseClient) return;
  const paths = (Array.isArray(documents) ? documents : [])
    .map((doc) => String(doc?.path || "").trim())
    .filter(Boolean);
  if (!paths.length) return;
  await supabaseClient.storage.from(supabaseDocBucket).remove(paths);
}

function validateLocalDocumentUpload(fileList) {
  if (remoteEnabled) return { ok: true, message: "" };
  const files = Array.from(fileList || []);
  if (!files.length) return { ok: true, message: "" };

  const oversized = files.find((file) => Number(file.size || 0) > LOCAL_DOC_SINGLE_FILE_LIMIT_BYTES);
  if (oversized) {
    return {
      ok: false,
      message: `File "${oversized.name}" is too large for local mode. Keep each file below ${Math.round(
        LOCAL_DOC_SINGLE_FILE_LIMIT_BYTES / 1024
      )} KB.`
    };
  }

  const newBytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
  const existingBytes = getStoredDocumentApproxBytes();
  if (existingBytes + newBytes > LOCAL_DOC_TOTAL_LIMIT_BYTES) {
    return {
      ok: false,
      message:
        "Attached documents exceed local browser storage capacity. Use smaller files or enable Supabase storage/realtime."
    };
  }

  return { ok: true, message: "" };
}

function getStoredDocumentApproxBytes() {
  return state.tenants.reduce((sum, tenant) => {
    const docs = Array.isArray(tenant.documents) ? tenant.documents : [];
    return (
      sum +
      docs.reduce((docSum, doc) => {
        const dataUrl = String(doc?.dataUrl || "");
        if (!dataUrl) return docSum;
        return docSum + Math.floor(dataUrl.length * 0.75);
      }, 0)
    );
  }, 0);
}

function renderDocumentLinks(documents) {
  if (!Array.isArray(documents) || !documents.length) return "-";
  return documents
    .map((doc) => {
      const href = String(doc?.url || doc?.dataUrl || "").trim();
      if (!href) return escapeHtml(doc?.name || "Document");
      return `<a class="doc-link" href="${href}" download="${escapeHtml(doc?.name || "document")}" target="_blank" rel="noopener noreferrer">${escapeHtml(doc?.name || "Document")}</a>`;
    })
    .join("");
}

function setActiveTab(tabName) {
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tabTarget === tabName);
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.tabPanel === tabName);
  });
}

function startEditTenant(tenantId) {
  if (!hasPermission("tenant_edit")) {
    alert("You do not have edit access.");
    return;
  }
  const tenant = state.tenants.find((entry) => entry.id === tenantId);
  if (!tenant) return;

  editingTenantId = tenant.id;
  editDocKeysToDelete = new Set();
  editPropertyNameSelectEl.value = tenant.linkedUnitId || "";
  document.getElementById("editTenantName").value = tenant.tenantName;
  document.getElementById("editTenantEmail").value = tenant.email || "";
  document.getElementById("editTenantMobile").value = tenant.mobile || "";
  document.getElementById("editMonthlyRent").value = tenant.monthlyRent;
  document.getElementById("editDeposit").value = tenant.deposit || 0;
  document.getElementById("editLeaseStart").value = tenant.leaseStart;
  document.getElementById("editLeaseEnd").value = tenant.leaseEnd;
  document.getElementById("editTenantDocuments").value = "";
  document.getElementById("replaceDocuments").checked = false;
  document.getElementById("editTenantNotes").value = tenant.notes || "";
  renderEditExistingDocuments(tenant);

  activeTenantEditCardEl.classList.remove("hidden");
  activeTenantEditCardEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function onEditTenant(event) {
  event.preventDefault();
  if (!hasPermission("tenant_edit")) {
    alert("You do not have edit access.");
    return;
  }
  if (!editingTenantId) return;

  const tenant = state.tenants.find((entry) => entry.id === editingTenantId);
  if (!tenant) return;
  const previousLinkedUnitId = tenant.linkedUnitId || "";

  const leaseStart = document.getElementById("editLeaseStart").value;
  const leaseEnd = document.getElementById("editLeaseEnd").value;
  const linkedUnitId = editPropertyNameSelectEl.value;
  const parsedMobile = parseIndianMobile(document.getElementById("editTenantMobile").value);
  if (new Date(leaseStart) > new Date(leaseEnd)) {
    alert("Lease start date cannot be after lease end date.");
    return;
  }
  if (!linkedUnitId) {
    alert("Select a building-unit from Available Units.");
    return;
  }
  if (parsedMobile === null) {
    alert("Enter a valid Indian mobile number (10 digits, optionally with +91).");
    return;
  }
  const conflictingTenant = findConflictingTenantForUnit(linkedUnitId, leaseStart, leaseEnd, tenant.id);
  if (conflictingTenant) {
    alert(`This unit is already occupied by ${conflictingTenant.tenantName} for overlapping lease dates.`);
    return;
  }

  const files = document.getElementById("editTenantDocuments").files;
  const shouldReplaceDocs = document.getElementById("replaceDocuments").checked;
  let newDocs = [];
  const localDocCheck = validateLocalDocumentUpload(files);
  if (!localDocCheck.ok) {
    alert(localDocCheck.message);
    return;
  }

  try {
    newDocs = await readFilesAsDocuments(files, { tenantId: tenant.id });
  } catch (error) {
    const message = String(error?.message || "");
    if (message) {
      alert(message);
    } else {
      alert("Failed to store one or more attached documents.");
    }
    return;
  }

  const existingDocs = Array.isArray(tenant.documents) ? tenant.documents : [];
  const docsToDelete = shouldReplaceDocs
    ? existingDocs
    : existingDocs.filter((doc) => editDocKeysToDelete.has(getDocumentKey(doc)));
  const retainedDocs = shouldReplaceDocs
    ? []
    : existingDocs.filter((doc) => !editDocKeysToDelete.has(getDocumentKey(doc)));
  if (docsToDelete.length) {
    deleteRemoteDocuments(docsToDelete).catch(() => {});
  }

  tenant.linkedUnitId = linkedUnitId;
  tenant.propertyName = getUnitLabelById(tenant.linkedUnitId);
  tenant.tenantName = document.getElementById("editTenantName").value.trim();
  tenant.email = document.getElementById("editTenantEmail").value.trim();
  tenant.mobile = parsedMobile || "";
  tenant.monthlyRent = Number(document.getElementById("editMonthlyRent").value);
  tenant.deposit = Number(document.getElementById("editDeposit").value || 0);
  tenant.notes = document.getElementById("editTenantNotes").value.trim();
  tenant.leaseStart = leaseStart;
  tenant.leaseEnd = leaseEnd;
  tenant.documents = [...retainedDocs, ...newDocs];
  syncUnitFromTenant(tenant, previousLinkedUnitId);

  saveState();
  renderAll();
  cancelEditTenant();
}

function cancelEditTenant() {
  editingTenantId = "";
  editDocKeysToDelete = new Set();
  activeTenantEditFormEl.reset();
  if (editExistingDocsEl) editExistingDocsEl.innerHTML = "";
  activeTenantEditCardEl.classList.add("hidden");
}

function getDocumentKey(doc) {
  return String(doc?.path || doc?.url || doc?.dataUrl || doc?.name || "");
}

function onEditExistingDocAction(event) {
  const deleteBtn = event.target.closest(".delete-existing-doc");
  if (!deleteBtn || !editingTenantId) return;
  const key = String(deleteBtn.dataset.docKey || "");
  if (!key) return;
  if (editDocKeysToDelete.has(key)) {
    editDocKeysToDelete.delete(key);
  } else {
    editDocKeysToDelete.add(key);
  }
  const tenant = state.tenants.find((entry) => entry.id === editingTenantId);
  if (tenant) renderEditExistingDocuments(tenant);
}

function renderEditExistingDocuments(tenant) {
  if (!editExistingDocsEl) return;
  const docs = Array.isArray(tenant?.documents) ? tenant.documents : [];
  if (!docs.length) {
    editExistingDocsEl.innerHTML = '<div class="existing-docs-empty">Existing Documents: none</div>';
    return;
  }

  const items = docs
    .map((doc) => {
      const key = getDocumentKey(doc);
      const marked = editDocKeysToDelete.has(key);
      const href = String(doc?.url || doc?.dataUrl || "").trim();
      const linkHtml = href
        ? `<a class="doc-link" href="${href}" download="${escapeHtml(doc?.name || "document")}" target="_blank" rel="noopener noreferrer">${escapeHtml(doc?.name || "Document")}</a>`
        : `<span>${escapeHtml(doc?.name || "Document")}</span>`;
      const btnLabel = marked ? "Undo Delete" : "Delete";
      return `
        <div class="existing-doc-item ${marked ? "marked-delete" : ""}">
          <div>${linkHtml}</div>
          <button type="button" class="btn btn-small btn-danger delete-existing-doc" data-doc-key="${escapeHtml(key)}">${btnLabel}</button>
        </div>
      `;
    })
    .join("");

  editExistingDocsEl.innerHTML = `
    <div class="existing-docs-title">Existing Documents</div>
    <div class="existing-docs-note">Click Delete and Save to remove a file.</div>
    ${items}
  `;
}

function initEditorAccess() {
  // Backward compatibility for cached older HTML that still had required user selection.
  if (editorUserLegacyEl) {
    editorUserLegacyEl.required = false;
    editorUserLegacyEl.disabled = true;
    editorUserLegacyEl.classList.add("hidden");
  }
  editorUser = localStorage.getItem(EDIT_ACCESS_KEY) || "";
  if (!editorUser || !EDIT_USERS.some((user) => user.username === editorUser)) {
    editorUser = "";
  }

  if (editorAccessFormEl) {
    editorAccessFormEl.noValidate = true;
  }
  if (editorLoginBtnEl) {
    editorLoginBtnEl.addEventListener("click", (event) => {
      event.preventDefault();
      onEditorLogin(event);
    });
  }
  if (editorPinEl) {
    editorPinEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onEditorLogin(event);
      }
    });
  }
  editorLogoutEl.addEventListener("click", onEditorLogout);
  updateEditorStatusUi();
}

function onEditorLogin(event) {
  event.preventDefault();
  const pinRaw = String(editorPinEl.value || "").trim();
  const pin = pinRaw.replace(/\D/g, "");
  if (!pin) {
    alert("Enter PIN.");
    return;
  }
  const mappedUser = PIN_TO_USER[pin] || "";
  const matched = mappedUser ? EDIT_USERS.find((user) => user.username === mappedUser) : null;
  if (!matched) {
    alert("Invalid PIN.");
    return;
  }
  editorUser = matched.username;
  localStorage.setItem(EDIT_ACCESS_KEY, editorUser);
  editorPinEl.value = "";
  updateEditorStatusUi();
  try {
    renderAll();
  } catch (error) {
    console.error("Post-login render failed:", error);
  }
}

function onEditorLogout() {
  editorUser = "";
  localStorage.removeItem(EDIT_ACCESS_KEY);
  editorPinEl.value = "";
  cancelEditTenant();
  cancelUnitEdit();
  activeTenantAddCardEl.classList.add("hidden");
  unitAddCardEl.classList.add("hidden");
  updateEditorStatusUi();
  renderAll();
}

function getCurrentUserRecord() {
  return EDIT_USERS.find((user) => user.username === editorUser) || null;
}

function isAuthenticated() {
  return Boolean(getCurrentUserRecord());
}

function getCurrentRole() {
  const user = getCurrentUserRecord();
  return user ? user.role : "anonymous";
}

function hasPermission(permission) {
  const role = getCurrentRole();

  if (role === "admin") return true;
  if (role === "manager") {
    return permission === "mark_paid" || permission === "notify_tenant";
  }
  return false;
}

function updateEditorStatusUi() {
  const role = getCurrentRole();
  if (isAuthenticated()) {
    editorStatusEl.textContent = role === "admin" ? "Admin" : role === "manager" ? "Manager" : "Viewer";
    editorStatusEl.classList.add("ok");
    editorAccessFormEl.classList.add("authenticated");
  } else {
    editorStatusEl.textContent = "Not signed in";
    editorStatusEl.classList.remove("ok");
    editorAccessFormEl.classList.remove("authenticated");
  }

  const canAddTenant = hasPermission("tenant_add");
  const canAddUnit = hasPermission("unit_add");
  addTenantFromActiveEl.classList.toggle("hidden", !canAddTenant);
  addUnitFromUnitsEl.classList.toggle("hidden", !canAddUnit);
  if (!canAddTenant) activeTenantAddCardEl.classList.add("hidden");
  if (!canAddUnit) unitAddCardEl.classList.add("hidden");
}

function applyAnonymousVisibility() {
  if (isAuthenticated()) {
    tabsContainerEl.classList.remove("hidden");
    dashboardNonMetricSections.forEach((section) => section.classList.remove("hidden"));
    tabPanels.forEach((panel) => {
      if (panel.dataset.tabPanel !== "dashboard" && panel.dataset.tabPanel !== "settings") {
        panel.classList.remove("hidden");
      }
    });
    return;
  }

  setActiveTab("dashboard");
  tabsContainerEl.classList.add("hidden");
  dashboardNonMetricSections.forEach((section) => section.classList.add("hidden"));
  tabPanels.forEach((panel) => {
    if (panel.dataset.tabPanel !== "dashboard") {
      panel.classList.add("hidden");
    }
  });
  settingsTabBtnEl.classList.add("hidden");
  settingsPanelEl.classList.add("hidden");
  activeTenantAddCardEl.classList.add("hidden");
  activeTenantEditCardEl.classList.add("hidden");
  unitAddCardEl.classList.add("hidden");
}

function getUnitLabel(unit) {
  return `${unit.buildingName} - ${unit.unitNumber}`;
}

function getTenantPropertyName(tenant) {
  if (tenant.linkedUnitId) {
    const linkedUnit = state.units.find((unit) => unit.id === tenant.linkedUnitId);
    if (linkedUnit) return getUnitLabel(linkedUnit);
  }
  return tenant.propertyName || "-";
}

function getTenantDisplayName(tenant) {
  if (tenant.linkedUnitId) {
    const linkedUnit = state.units.find((unit) => unit.id === tenant.linkedUnitId);
    if (linkedUnit?.tenantName) return linkedUnit.tenantName;
  }
  return tenant.tenantName || "-";
}

function getTenantUnitNumber(tenant) {
  if (tenant.linkedUnitId) {
    const linkedUnit = state.units.find((unit) => unit.id === tenant.linkedUnitId);
    if (linkedUnit?.unitNumber) return linkedUnit.unitNumber;
  }
  const matchedByName = state.units.find((unit) => {
    if (unit.status !== "occupied") return false;
    const unitTenant = String(unit.tenantName || "").trim().toLowerCase();
    const targetTenant = String(tenant?.tenantName || "").trim().toLowerCase();
    return unitTenant && targetTenant && unitTenant === targetTenant;
  });
  if (matchedByName?.unitNumber) return matchedByName.unitNumber;
  const property = String(getTenantPropertyName(tenant) || "");
  const idx = property.indexOf(" - ");
  if (idx >= 0 && idx + 3 < property.length) {
    return property.slice(idx + 3).trim();
  }
  return property || "-";
}

function getTenantBuildingName(tenant) {
  if (tenant.linkedUnitId) {
    const unit = state.units.find((entry) => entry.id === tenant.linkedUnitId);
    if (unit?.buildingName) return unit.buildingName;
  }
  const matchedByName = state.units.find((unit) => {
    if (unit.status !== "occupied") return false;
    const unitTenant = String(unit.tenantName || "").trim().toLowerCase();
    const targetTenant = String(tenant?.tenantName || "").trim().toLowerCase();
    return unitTenant && targetTenant && unitTenant === targetTenant;
  });
  if (matchedByName?.buildingName) return matchedByName.buildingName;
  const fallback = String(tenant.propertyName || "").trim();
  if (!fallback) return "Unknown";
  const idx = fallback.indexOf(" - ");
  return idx > 0 ? fallback.slice(0, idx).trim() : fallback;
}

function getBuildingAddress(buildingName) {
  const key = normalizeUnitText(buildingName);
  if (!key) return "";
  const addresses = state.notifyConfig.buildingAddresses || {};
  return String(addresses[key] || "").trim();
}

function getBuildingLandlord(buildingName) {
  const key = normalizeUnitText(buildingName);
  if (!key) return "";
  const landlords = state.notifyConfig.buildingLandlords || {};
  return String(landlords[key] || "").trim();
}

function getUnitOptionsHtml() {
  return state.units
    .slice()
    .sort(compareUnitsAscending)
    .map((unit) => `<option value="${unit.id}">${escapeHtml(getUnitLabel(unit))}</option>`)
    .join("");
}

function getAddTenantUnitOptionsHtml() {
  const vacant = state.units
    .filter((unit) => unit.status === "vacant")
    .sort(compareUnitsAscending)
    .map((unit) => `<option value="${unit.id}">${escapeHtml(getUnitLabel(unit))}</option>`);
  const occupiedReadOnly = state.units
    .filter((unit) => unit.status === "occupied")
    .sort(compareUnitsAscending)
    .map((unit) => `<option value="${unit.id}" disabled>${escapeHtml(getUnitLabel(unit))} (Occupied)</option>`);
  return [...vacant, ...occupiedReadOnly].join("");
}

function compareUnitsAscending(a, b) {
  const buildingA = String(a.buildingName || "").trim();
  const buildingB = String(b.buildingName || "").trim();
  const buildingCmp = buildingA.localeCompare(buildingB, undefined, { numeric: true, sensitivity: "base" });
  if (buildingCmp !== 0) return buildingCmp;
  return String(a.unitNumber || "").localeCompare(String(b.unitNumber || ""), undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

function compareTenantsByUnitAscending(a, b) {
  const unitCmp = getTenantUnitNumber(a).localeCompare(getTenantUnitNumber(b), undefined, {
    numeric: true,
    sensitivity: "base"
  });
  if (unitCmp !== 0) return unitCmp;
  return String(a.tenantName || "").localeCompare(String(b.tenantName || ""), undefined, {
    sensitivity: "base"
  });
}

function getUnitLabelById(unitId) {
  if (!unitId) return "";
  const unit = state.units.find((entry) => entry.id === unitId);
  return unit ? getUnitLabel(unit) : "";
}

function relinkTenantsToUnits() {
  state.tenants = state.tenants.map((tenant) => {
    if (tenant.linkedUnitId && state.units.some((unit) => unit.id === tenant.linkedUnitId)) {
      return tenant;
    }
    const matched = state.units.find(
      (unit) => getUnitLabel(unit).toLowerCase() === String(tenant.propertyName || "").toLowerCase()
    );
    return { ...tenant, linkedUnitId: matched ? matched.id : "" };
  });
}

function normalizeNotifyConfig(config) {
  if (!config || typeof config !== "object") {
    return {
      admins: [],
      managers: [],
      emailjsPublicKey: "",
      emailjsServiceId: "",
      emailjsTemplateId: "",
      senderName: "Rental Management",
      reviewSubjectTemplate: "Payment Review Required: {unit} {tenant name}",
      buildingAddresses: {},
      buildingLandlords: {}
    };
  }
  return {
    admins: Array.isArray(config.admins) ? config.admins.filter(Boolean) : [],
    managers: Array.isArray(config.managers) ? config.managers.filter(Boolean) : [],
    emailjsPublicKey: config.emailjsPublicKey || "",
    emailjsServiceId: config.emailjsServiceId || "",
    emailjsTemplateId: config.emailjsTemplateId || "",
    senderName: config.senderName || "Rental Management",
    reviewSubjectTemplate: config.reviewSubjectTemplate || "Payment Review Required: {unit} {tenant name}",
    buildingAddresses: normalizeBuildingAddresses(config.buildingAddresses),
    buildingLandlords: normalizeBuildingLandlords(config.buildingLandlords)
  };
}

function normalizeBuildingAddresses(addresses) {
  if (!addresses || typeof addresses !== "object") return {};
  const normalized = {};
  Object.entries(addresses).forEach(([building, address]) => {
    const name = normalizeUnitText(building);
    const value = String(address || "").trim();
    if (!name || !value) return;
    normalized[name] = value;
  });
  return normalized;
}

function normalizeBuildingLandlords(landlords) {
  if (!landlords || typeof landlords !== "object") return {};
  const normalized = {};
  Object.entries(landlords).forEach(([building, landlord]) => {
    const name = normalizeUnitText(building);
    const value = String(landlord || "").trim();
    if (!name || !value) return;
    normalized[name] = value;
  });
  return normalized;
}

function getKnownBuildingNames() {
  return [
    ...new Set(
      state.units
        .map((unit) => normalizeUnitText(unit.buildingName))
        .filter(Boolean)
        .concat(state.tenants.map((tenant) => normalizeUnitText(getTenantBuildingName(tenant))).filter(Boolean))
    )
  ].sort((a, b) => a.localeCompare(b));
}

function renderBuildingAddressFields() {
  if (!buildingAddressFieldsEl) return;
  const buildings = getKnownBuildingNames();
  const addressMap = state.notifyConfig.buildingAddresses || {};
  const landlordMap = state.notifyConfig.buildingLandlords || {};
  if (!buildings.length) {
    buildingAddressFieldsEl.innerHTML = '<div class="empty-note">No buildings found yet. Add units to configure addresses.</div>';
    return;
  }

  buildingAddressFieldsEl.innerHTML = "";
  buildings.forEach((building) => {
    const wrapper = document.createElement("div");
    wrapper.className = "building-setting-group";

    const landlordLabel = document.createElement("label");
    landlordLabel.textContent = `${building} Landlord Name`;
    const landlordInput = document.createElement("input");
    landlordInput.type = "text";
    landlordInput.placeholder = `Enter landlord name for ${building}`;
    landlordInput.dataset.buildingLandlord = building;
    landlordInput.value = landlordMap[building] || "";
    landlordLabel.appendChild(landlordInput);

    const addressLabel = document.createElement("label");
    addressLabel.textContent = `${building} Address`;
    const textarea = document.createElement("textarea");
    textarea.rows = 2;
    textarea.placeholder = `Enter address for ${building}`;
    textarea.dataset.buildingAddress = building;
    textarea.value = addressMap[building] || "";
    addressLabel.appendChild(textarea);

    wrapper.appendChild(landlordLabel);
    wrapper.appendChild(addressLabel);
    buildingAddressFieldsEl.appendChild(wrapper);
  });
}

function getBuildingAddressesFromSettings() {
  const existing = { ...(state.notifyConfig.buildingAddresses || {}) };
  if (!buildingAddressFieldsEl) return normalizeBuildingAddresses(existing);

  buildingAddressFieldsEl.querySelectorAll("textarea[data-building-address]").forEach((textarea) => {
    const building = normalizeUnitText(textarea.dataset.buildingAddress || "");
    if (!building) return;
    const value = String(textarea.value || "").trim();
    if (value) existing[building] = value;
    else delete existing[building];
  });

  return normalizeBuildingAddresses(existing);
}

function getBuildingLandlordsFromSettings() {
  const existing = { ...(state.notifyConfig.buildingLandlords || {}) };
  if (!buildingAddressFieldsEl) return normalizeBuildingLandlords(existing);

  buildingAddressFieldsEl.querySelectorAll("input[data-building-landlord]").forEach((input) => {
    const building = normalizeUnitText(input.dataset.buildingLandlord || "");
    if (!building) return;
    const value = String(input.value || "").trim();
    if (value) existing[building] = value;
    else delete existing[building];
  });

  return normalizeBuildingLandlords(existing);
}

function isEmailServiceConfigured() {
  return Boolean(
    state.notifyConfig.emailjsPublicKey &&
      state.notifyConfig.emailjsServiceId &&
      state.notifyConfig.emailjsTemplateId
  );
}

function sendReminderByEmailJs(tenant, monthKey) {
  const ccList = [...state.notifyConfig.admins, ...state.notifyConfig.managers].join(",");
  const subject = `Rent Reminder - ${formatMonth(monthKey)} - ${tenant.tenantName}`;
  const message = `Hello ${tenant.tenantName},

This is a reminder that rent for ${formatMonth(monthKey)} is still pending.
Amount: ${money(tenant.monthlyRent)}
Property: ${getTenantPropertyName(tenant)}

Please complete payment at the earliest.

Thank you,
${state.notifyConfig.senderName}`;

  return fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: state.notifyConfig.emailjsServiceId,
      template_id: state.notifyConfig.emailjsTemplateId,
      user_id: state.notifyConfig.emailjsPublicKey,
      template_params: {
        to_email: tenant.email,
        to_name: tenant.tenantName,
        cc_emails: ccList,
        subject,
        message
      }
    })
  }).then((response) => {
    if (!response.ok) {
      throw new Error("Email send failed");
    }
  });
}

function notifyAdminsForReview(tenant, monthKey) {
  if (!isEmailServiceConfigured()) {
    return Promise.reject(new Error("Email service not configured"));
  }
  const adminEmails = state.notifyConfig.admins || [];
  if (!adminEmails.length) {
    return Promise.reject(new Error("No admin emails configured"));
  }

  const requests = adminEmails.map((adminEmail) =>
    fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: state.notifyConfig.emailjsServiceId,
        template_id: state.notifyConfig.emailjsTemplateId,
        user_id: state.notifyConfig.emailjsPublicKey,
        template_params: {
          to_email: adminEmail,
          to_name: "Admin",
          cc_emails: "",
          subject: formatReviewSubject(tenant, monthKey),
          message: `A manager marked rent as Review.\n\nTenant: ${tenant.tenantName}\nProperty: ${getTenantPropertyName(tenant)}\nMonth: ${formatMonth(monthKey)}\nAmount: ${money(tenant.monthlyRent)}\n\nPlease review and verify payment.`
        }
      })
    }).then((response) => {
      if (!response.ok) {
        throw new Error("Admin review email send failed");
      }
    })
  );

  return Promise.all(requests).then(() => undefined);
}

function formatReviewSubject(tenant, monthKey) {
  const template =
    state.notifyConfig.reviewSubjectTemplate || "Payment Review Required: {unit} {tenant name}";
  const unitLabel = getTenantPropertyName(tenant);
  let subject = template
    .replaceAll("{unit}", getTenantPropertyName(tenant))
    .replaceAll("{property unit}", unitLabel)
    .replaceAll("{property}", unitLabel)
    .replaceAll("{tenant name}", tenant.tenantName)
    .replaceAll("{tenant_name}", tenant.tenantName)
    .replaceAll("{tenant}", tenant.tenantName)
    .replaceAll("{month}", formatMonth(monthKey))
    .replaceAll("{month_name}", formatMonth(monthKey))
    .replaceAll("{amount}", money(tenant.monthlyRent))
    .replaceAll("{{tenant_name}}", tenant.tenantName)
    .replaceAll("{{month}}", formatMonth(monthKey))
    .replaceAll("{{property}}", getTenantPropertyName(tenant))
    .replaceAll("{{amount}}", money(tenant.monthlyRent));
  if (unitLabel && !subject.toLowerCase().includes(unitLabel.toLowerCase())) {
    subject = `${subject} - ${unitLabel}`;
  }
  return subject;
}

function findConflictingTenantForUnit(unitId, leaseStart, leaseEnd, excludeTenantId = "") {
  return state.tenants.find((entry) => {
    if (excludeTenantId && entry.id === excludeTenantId) return false;
    if (entry.linkedUnitId !== unitId) return false;
    return leasesOverlap(entry.leaseStart, entry.leaseEnd, leaseStart, leaseEnd);
  });
}

function syncUnitFromTenant(tenant, previousLinkedUnitId) {
  if (previousLinkedUnitId && previousLinkedUnitId !== tenant.linkedUnitId) {
    const oldUnit = state.units.find((unit) => unit.id === previousLinkedUnitId);
    const oldUnitStillLinked = state.tenants.some(
      (entry) => entry.id !== tenant.id && entry.linkedUnitId === previousLinkedUnitId
    );
    if (oldUnit && !oldUnitStillLinked) {
      oldUnit.status = "vacant";
      oldUnit.tenantName = "";
    }
  }

  if (!tenant.linkedUnitId) return;
  const linkedUnit = state.units.find((unit) => unit.id === tenant.linkedUnitId);
  if (!linkedUnit) return;
  linkedUnit.status = "occupied";
  linkedUnit.tenantName = tenant.tenantName;
}

function disableServiceWorkerAndCaches() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch(() => {});

  if (!("caches" in window)) return;
  caches
    .keys()
    .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
    .catch(() => {});
}
