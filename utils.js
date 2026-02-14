(function () {
  const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

  const formatMonth = (yyyyMm) => {
    const [year, month] = yyyyMm.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric"
    });
  };

  const formatMonthShort = (yyyyMm) => {
    const [year, month] = yyyyMm.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
      month: "short",
      year: "numeric"
    });
  };

  const formatDate = (yyyyMmDd) => {
    if (!yyyyMmDd) return "-";
    const [year, month, day] = yyyyMmDd.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString();
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
    const aStart = new Date(startA);
    const aEnd = new Date(endA);
    const bStart = new Date(startB);
    const bEnd = new Date(endB);
    return aStart <= bEnd && aEnd >= bStart;
  };

  window.AppUtils = {
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
  };
})();
