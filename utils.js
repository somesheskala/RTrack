(function () {
  const INDIA_TZ = "Asia/Kolkata";

  const getIndiaDateParts = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: INDIA_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type)?.value || "";
    return {
      year: get("year"),
      month: get("month"),
      day: get("day")
    };
  };

  const getCurrentMonth = () => {
    const { year, month } = getIndiaDateParts();
    return `${year}-${month}`;
  };

  const getTodayIsoIndia = () => {
    const { year, month, day } = getIndiaDateParts();
    return `${year}-${month}-${day}`;
  };

  const parseIsoDateLocal = (value) => {
    const raw = String(value || "").trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      return new Date(year, month - 1, day);
    }
    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? new Date(0) : fallback;
  };

  const formatMonth = (yyyyMm) => {
    const [year, month] = yyyyMm.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric"
    });
  };

  const formatMonthShort = (yyyyMm) => {
    const [year, month] = yyyyMm.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric"
    });
  };

  const formatDate = (yyyyMmDd) => {
    if (!yyyyMmDd) return "-";
    const [year, month, day] = yyyyMmDd.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-IN");
  };

  const money = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(Number(amount || 0));

  const normalizeDate = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const parseIndianMobile = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    let digits = raw.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) {
      digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith("0")) {
      digits = digits.slice(1);
    }
    if (!/^[6-9]\d{9}$/.test(digits)) {
      return null;
    }
    return `+91 ${digits}`;
  };

  const escapeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const normalizeUnitText = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim();

  const getUnitKey = (buildingName, unitNumber) =>
    `${normalizeUnitText(buildingName).toLowerCase()}::${normalizeUnitText(unitNumber).toLowerCase()}`;

  const parseEmailList = (raw) =>
    String(raw || "")
      .split(/[\n,; ]+/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .filter((email, index, arr) => arr.indexOf(email) === index);

  const leasesOverlap = (startA, endA, startB, endB) => {
    const aStart = parseIsoDateLocal(startA);
    const aEnd = parseIsoDateLocal(endA);
    const bStart = parseIsoDateLocal(startB);
    const bEnd = parseIsoDateLocal(endB);
    return aStart <= bEnd && aEnd >= bStart;
  };

  window.AppUtils = {
    escapeHtml,
    formatDate,
    formatMonth,
    formatMonthShort,
    getCurrentMonth,
    getTodayIsoIndia,
    getUnitKey,
    leasesOverlap,
    money,
    normalizeDate,
    normalizeUnitText,
    parseEmailList,
    parseIndianMobile
  };
})();
