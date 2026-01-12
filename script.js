let students = [];

const statusEl = document.getElementById("status");
const qEl = document.getElementById("q");
const tbody = document.getElementById("tbody");

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}

function normalize(s) {
  return (s ?? "")
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// CSV parser بسيط يدعم الفواصل والاقتباسات
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"'; i++; continue;
    }
    if (ch === '"') { inQuotes = !inQuotes; continue; }

    if (!inQuotes && (ch === "," || ch === "\t")) { // يدعم CSV أو TSV
      row.push(cur); cur = ""; continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur); rows.push(row);
      row = []; cur = "";
      continue;
    }

    cur += ch;
  }

  // آخر خلية
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }

  return rows.filter(r => r.some(c => c.trim() !== ""));
}

function mapRowsToObjects(rows) {
  const header = rows[0].map(h => normalize(h));
  const data = rows.slice(1);

  // نحاول نتعرّف الأعمدة حتى لو أسماءها مختلفة
  const col = {
    name: header.findIndex(h => h.includes("الاسم") || h.includes("name")),
    id: header.findIndex(h => h.includes("الرقم") || h.includes("id") || h.includes("student")),
    grade: header.findIndex(h => h.includes("الصف") || h.includes("grade") || h.includes("class")),
    section: header.findIndex(h => h.includes("الشعبة") || h.includes("section")),
    nat: header.findIndex(h => h.includes("الجنسية") || h.includes("national"))
  };

  return data.map(r => ({
    name: r[col.name] ?? "",
    id: r[col.id] ?? "",
    grade: r[col.grade] ?? "",
    section: r[col.section] ?? "",
    nat: r[col.nat] ?? "",
  }));
}

function render(list) {
  tbody.innerHTML = "";
  list.forEach((s, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${s.name}</td>
      <td>${s.id}</td>
      <td>${s.grade}</td>
      <td>${s.section}</td>
      <td>${s.nat}</td>
    `;
    tbody.appendChild(tr);
  });
}

function doSearch() {
  const q = normalize(qEl.value);
  if (!students.length) {
    setStatus("لا توجد بيانات: حمّل ملف CSV أولاً.");
    return;
  }
  if (!q) {
    render(students.slice(0, 200));
    setStatus(`عرض أول 200 من أصل ${students.length}.`);
    return;
  }

  const res = students.filter(s => {
    const name = normalize(s.name);
    const id = normalize(s.id);
    return name.includes(q) || id.includes(q);
  });

  render(res);
  setStatus(`تم العثور على ${res.length} نتيجة.`);
}

function loadCSVFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = reader.result;
      const rows = parseCSV(text);
      students = mapRowsToObjects(rows);
      setStatus(`تم تحميل ${students.length} طالب. اكتب للبحث.`);
      render(students.slice(0, 50));
    } catch (e) {
      setStatus("فشل قراءة الملف. تأكد أنه CSV صحيح.");
      console.error(e);
    }
  };
  reader.onerror = () => setStatus("خطأ في قراءة الملف.");
  reader.readAsText(file, "utf-8");
}

document.getElementById("loadBtn")?.addEventListener("click", () => {
  const file = document.getElementById("csvFile")?.files?.[0];
  if (!file) {
    setStatus("اختر ملف CSV أولاً.");
    return;
  }
  setStatus("جاري تحميل البيانات...");
  loadCSVFromFile(file);
});

document.getElementById("btn")?.addEventListener("click", doSearch);
document.getElementById("clear")?.addEventListener("click", () => {
  qEl.value = "";
  render(students.slice(0, 50));
  setStatus(students.length ? `تم تحميل ${students.length} طالب.` : "لم يتم تحميل ملف بعد.");
});
qEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doSearch();
});