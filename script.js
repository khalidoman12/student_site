/* =========================
   Diagnostic script.js
   - Cache busting
   - On-screen debug logger (#debug-log)
   - Path fallback ./data.csv -> data.csv
   - UTF-8 (incl. BOM removal)
   - Column detection: (الاسم الكامل, الرقم المدرسي, الصف, الشعبة, الجنسية)
   ========================= */

(() => {
  "use strict";

  // --- DOM refs (your existing IDs) ---
  const statusEl = document.getElementById("status");
  const qEl = document.getElementById("q");
  const tbody = document.getElementById("tbody");

  // Optional: your page might have buttons; if not, it still works.
  const btnEl = document.getElementById("btn");
  const clearEl = document.getElementById("clear");

  // --- Debug box (must exist in HTML: <div id="debug-log"></div>) ---
  const debugEl = document.getElementById("debug-log");

  // In-memory data
  let students = [];
  let colIndex = { name: -1, id: -1, grade: -1, section: -1, nat: -1 };
  let headers = [];

  // ===== Helpers =====
  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function nowStamp() {
    // strong cache busting, changes every load
    return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }

  function logToScreen(level, message, extra) {
    // level: "info" | "warn" | "error"
    const text =
      `[${new Date().toLocaleTimeString()}] ${level.toUpperCase()}: ${message}` +
      (extra ? `\n${safeStringify(extra)}` : "");

    // Always also log to console (if available)
    try {
      if (level === "error") console.error(message, extra ?? "");
      else if (level === "warn") console.warn(message, extra ?? "");
      else console.log(message, extra ?? "");
    } catch (_) {}

    // If debug div is not present, silently skip UI log.
    if (!debugEl) return;

    debugEl.style.display = "block";
    debugEl.style.whiteSpace = "pre-wrap";
    debugEl.style.direction = "ltr"; // keep logs readable
    debugEl.style.textAlign = "left";
    debugEl.style.padding = "10px";
    debugEl.style.margin = "10px 0";
    debugEl.style.borderRadius = "8px";
    debugEl.style.border = "1px solid rgba(0,0,0,0.15)";
    debugEl.style.fontSize = "12px";
    debugEl.style.lineHeight = "1.4";
    debugEl.style.maxHeight = "220px";
    debugEl.style.overflow = "auto";

    if (level === "error") {
      debugEl.style.background = "#ffe8e8";
      debugEl.style.color = "#7a0000";
      debugEl.style.borderColor = "#ffb3b3";
    } else if (level === "warn") {
      debugEl.style.background = "#fff6e5";
      debugEl.style.color = "#6b4a00";
      debugEl.style.borderColor = "#ffd28a";
    } else {
      debugEl.style.background = "#e9f3ff";
      debugEl.style.color = "#003b73";
      debugEl.style.borderColor = "#b7d7ff";
    }

    debugEl.textContent = (debugEl.textContent ? debugEl.textContent + "\n\n" : "") + text;
  }

  function safeStringify(x) {
    try {
      if (x instanceof Error) {
        return `${x.name}: ${x.message}\n${x.stack || ""}`.trim();
      }
      return JSON.stringify(x, null, 2);
    } catch {
      return String(x);
    }
  }

  function normalize(s) {
    return (s ?? "")
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\u200f|\u200e/g, ""); // remove RTL/LTR marks
  }

  // ===== CSV parsing (handles quotes) =====
  function parseCSV(text, delim) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"' && inQuotes && next === '"') {
        // escaped quote
        cur += '"';
        i++;
        continue;
      }
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && (ch === "\r" || ch === "\n")) {
        if (ch === "\r" && next === "\n") i++;
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
        continue;
      }
      if (!inQuotes && ch === delim) {
        row.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }

    // last cell
    if (cur.length || row.length) {
      row.push(cur);
      rows.push(row);
    }

    // trim empty trailing rows
    return rows.filter(r => r.some(c => String(c || "").trim() !== ""));
  }

  function detectDelimiter(firstLine) {
    // prefer tab or semicolon if present
    if (firstLine.includes("\t")) return "\t";
    if (firstLine.includes(";")) return ";";
    return ",";
  }

  function stripBOM(s) {
    return s.replace(/^\uFEFF/, "");
  }

  // ===== Column mapping (Arabic headers) =====
  function mapColumns(hdrs) {
    const hNorm = hdrs.map(h => normalize(h));

    function findIndexByCandidates(cands) {
      for (const cand of cands) {
        const c = normalize(cand);
        const idx = hNorm.findIndex(h => h === c || h.includes(c));
        if (idx !== -1) return idx;
      }
      return -1;
    }

    // Your stated headers
    const nameIdx = findIndexByCandidates(["الاسم الكامل", "الاسم", "اسم الطالب", "name"]);
    const idIdx = findIndexByCandidates(["الرقم المدرسي", "رقم مدرسي", "الرقم", "student id", "id"]);
    const gradeIdx = findIndexByCandidates(["الصف", "الصف الدراسي", "grade", "class"]);
    const sectionIdx = findIndexByCandidates(["الشعبة", "شعبة", "section"]);
    const natIdx = findIndexByCandidates(["الجنسية", "nation", "nationality"]);

    return { name: nameIdx, id: idIdx, grade: gradeIdx, section: sectionIdx, nat: natIdx };
  }

  // ===== Render =====
  function clearTable() {
    if (tbody) tbody.innerHTML = "";
  }

  function renderRows(list) {
    if (!tbody) return;
    clearTable();

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:14px;">لا توجد نتائج</td></tr>`;
      return;
    }

    const frag = document.createDocumentFragment();
    list.forEach((s, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.id)}</td>
        <td>${escapeHtml(s.grade)}</td>
        <td>${escapeHtml(s.section)}</td>
        <td>${escapeHtml(s.nat)}</td>
      `;
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
  }

  function escapeHtml(v) {
    const s = String(v ?? "");
    return s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ===== Search =====
  function doSearch() {
    const q = normalize(qEl?.value || "");
    if (!q) {
      renderRows(students.slice(0, 200));
      setStatus(`تم التحميل. اعرض أول ${Math.min(200, students.length)} من أصل ${students.length}.`);
      return;
    }

    const res = students.filter(s => {
      return (
        normalize(s.name).includes(q) ||
        normalize(s.id).includes(q) ||
        normalize(s.grade).includes(q) ||
        normalize(s.section).includes(q) ||
        normalize(s.nat).includes(q)
      );
    });

    renderRows(res);
    setStatus(`عدد النتائج: ${res.length}`);
  }

  // ===== Fetch logic with diagnostics =====
  async function fetchWithDiagnostics(basePath) {
    const url = `${basePath}?t=${encodeURIComponent(nowStamp())}`;
    logToScreen("info", `Fetching: ${url}`);

    // Use no-store to reduce cache issues (not guaranteed on all layers, but helps)
    const resp = await fetch(url, { cache: "no-store" });

    logToScreen("info", `Response: ${resp.status} ${resp.statusText} for ${basePath}`);

    if (!resp.ok) {
      // show a meaningful hint
      throw new Error(`Fetch failed (${resp.status}) for ${basePath}`);
    }

    const text = await resp.text();
    return text;
  }

  async function loadCSVWithFallback() {
    setStatus("تحميل البيانات...");
    logToScreen("info", `Page URL: ${location.href}`);
    logToScreen("info", `Base path guess: ${location.pathname}`);

    const candidates = ["./data.csv", "data.csv"];

    for (const p of candidates) {
      try {
        const raw = await fetchWithDiagnostics(p);
        const cleaned = stripBOM(raw);

        // quick sanity check: has at least one newline and looks like CSV headers
        const firstLine = cleaned.split(/\r?\n/)[0] || "";
        const delim = detectDelimiter(firstLine);

        logToScreen("info", `Delimiter detected: ${JSON.stringify(delim)}. First line: ${firstLine}`);

        const rows = parseCSV(cleaned, delim);
        if (!rows.length || rows.length < 2) {
          throw new Error(`CSV parsed but appears empty or only headers. Rows=${rows.length}`);
        }

        headers = rows[0].map(h => String(h ?? "").trim());
        colIndex = mapColumns(headers);

        logToScreen("info", "Headers detected:", headers);
        logToScreen("info", "Column indices:", colIndex);

        // Validate required columns
        const required = ["name", "id", "grade", "section", "nat"];
        const missing = required.filter(k => colIndex[k] === -1);
        if (missing.length) {
          logToScreen(
            "warn",
            `Missing column mappings: ${missing.join(", ")}`,
            "هذا غالباً يعني أن عناوين الأعمدة في CSV تختلف عن (الاسم الكامل, الرقم المدرسي, الصف, الشعبة, الجنسية)."
          );
        }

        // Map rows to objects (use indices if found, else best-effort by position)
        const dataRows = rows.slice(1);
        students = dataRows
          .filter(r => r.some(c => String(c || "").trim() !== ""))
          .map(r => ({
            name: pickCell(r, colIndex.name, 0),
            id: pickCell(r, colIndex.id, 1),
            grade: pickCell(r, colIndex.grade, 2),
            section: pickCell(r, colIndex.section, 3),
            nat: pickCell(r, colIndex.nat, 4),
          }));

        setStatus(`تم تحميل البيانات: ${students.length} طالب/ـة`);
        renderRows(students.slice(0, 200));

        // Bind search after successful load
        bindUI();
        return; // success, stop fallback loop
      } catch (e) {
        logToScreen("error", `Failed candidate path: ${p}`, e);
      }
    }

    // If all candidates fail:
    setStatus("فشل تحميل CSV تلقائياً. استخدم الرفع اليدوي من زر اختيار الملف.");
    logToScreen(
      "error",
      "All CSV fetch attempts failed.",
      "الأسباب الشائعة: GitHub Pages لا يجد الملف (404)، أو اسم الملف/حروفه مختلفة، أو الموقع مُخزن نسخة قديمة، أو الملف موجود داخل مجلد وليس في الجذر."
    );
  }

  function pickCell(row, idx, fallbackIdx) {
    const i = (typeof idx === "number" && idx >= 0) ? idx : fallbackIdx;
    return (row[i] ?? "").toString().trim();
  }

  function bindUI() {
    // Avoid multiple bindings if reloaded
    if (btnEl && !btnEl.__bound) {
      btnEl.addEventListener("click", doSearch);
      btnEl.__bound = true;
    }
    if (clearEl && !clearEl.__bound) {
      clearEl.addEventListener("click", () => {
        if (qEl) qEl.value = "";
        doSearch();
      });
      clearEl.__bound = true;
    }
    if (qEl && !qEl.__bound) {
      qEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doSearch();
      });
      qEl.__bound = true;
    }
  }

  // ===== Global error hooks (so you see JS errors on screen) =====
  window.addEventListener("error", (event) => {
    logToScreen("error", "Window error event", {
      message: event.message,
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error ? (event.error.stack || String(event.error)) : null,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    logToScreen("error", "Unhandled promise rejection", event.reason);
  });

  // ===== Boot =====
  document.addEventListener("DOMContentLoaded", () => {
    logToScreen("info", "Diagnostic script loaded.");
    if (!debugEl) {
      // still usable; but user asked for it
      logToScreen("warn", "No #debug-log element found in HTML. Add <div id='debug-log'></div> near top of body.");
    }
    loadCSVWithFallback();
  });
})();
