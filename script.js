let students = [];

// تعريف عناصر الصفحة
const statusEl = document.getElementById("status");
const qEl = document.getElementById("q"); // مربع البحث
const tbody = document.getElementById("tbody"); // جسم الجدول

// دالة تحديث شريط الحالة
function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}

// دالة تنظيف النصوص (إزالة المسافات الزائدة وتوحيد الحروف)
function normalize(s) {
  return (s ?? "")
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// 1. التشغيل التلقائي عند فتح الصفحة
document.addEventListener('DOMContentLoaded', () => {
  // يحاول تحميل data.csv تلقائياً
  fetchCSV('data.csv');
});

// دالة جلب الملف من الرابط (GitHub)
async function fetchCSV(url) {
  setStatus("جاري الاتصال بقاعدة البيانات...");
  try {
    // إضافة timestamp لمنع المتصفح من حفظ النسخة القديمة
    const response = await fetch(url + '?t=' + new Date().getTime());
    
    if (!response.ok) {
      throw new Error("لم يتم العثور على الملف");
    }

    const text = await response.text();
    processData(text); // معالجة البيانات
    setStatus("تم تحميل البيانات بنجاح. ابحث الآن!");
    
  } catch (error) {
    console.error(error);
    setStatus("لم يتم العثور على ملف data.csv تلقائياً. يمكنك رفعه يدوياً.");
  }
}

// دالة معالجة النص وتحويله لبيانات
function processData(csvText) {
  const rows = parseCSV(csvText);
  if (rows.length < 2) {
    setStatus("الملف فارغ أو غير صالح");
    return;
  }
  students = mapRowsToObjects(rows);
  
  // عرض أول 50 طالب للتأكد
  render(students.slice(0, 50));
  setStatus(`تم تحميل ${students.length} طالب. جاهز للبحث.`);
}

// قارئ CSV يدعم الفواصل والاقتباسات
function parseCSV(text) {
  // حذف أي رموز غريبة في بداية الملف (BOM)
  text = text.replace(/^\uFEFF/, '');
  
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

    if (!inQuotes && (ch === "," || ch === "\t" || ch === ";")) { 
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
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter(r => r.some(c => c.trim() !== ""));
}

// ربط الأعمدة (ذكاء في تحديد مكان الاسم والرقم)
function mapRowsToObjects(rows) {
  const header = rows[0].map(h => normalize(h));
  const data = rows.slice(1);

  // البحث عن أرقام الأعمدة بناءً على الكلمات المفتاحية في ملفك
  const col = {
    name: header.findIndex(h => h.includes("اسم") || h.includes("name")),
    id: header.findIndex(h => h.includes("رقم") || h.includes("id")),
    grade: header.findIndex(h => h.includes("صف") || h.includes("grade")),
    section: header.findIndex(h => h.includes("شعبة") || h.includes("section")),
    nat: header.findIndex(h => h.includes("جنسية") || h.includes("national"))
  };

  // إذا لم يجد العناوين، نستخدم الترتيب الافتراضي (0,1,2,3,4)
  const safeIndex = (idx, fallback) => idx > -1 ? idx : fallback;

  return data.map(r => ({
    name: r[safeIndex(col.name, 0)] ?? "", // العمود الأول للاسم
    id: r[safeIndex(col.id, 1)] ?? "",     // العمود الثاني للرقم
    grade: r[safeIndex(col.grade, 2)] ?? "",
    section: r[safeIndex(col.section, 3)] ?? "",
    nat: r[safeIndex(col.nat, 4)] ?? "",
  }));
}

// دالة رسم الجدول
function render(list) {
  if(!tbody) return;
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

// دالة البحث
function doSearch() {
  const q = normalize(qEl.value);
  if (!students.length) {
    setStatus("لا توجد بيانات: انتظر التحميل أو ارفع الملف يدوياً.");
    return;
  }
  if (!q) {
    render(students.slice(0, 50));
    setStatus(`عرض أول 50 من أصل ${students.length}.`);
    return;
  }

  const res = students.filter(s => {
    const name = normalize(s.name);
    const id = normalize(s.id);
    // البحث بالاسم أو الرقم
    return name.includes(q) || id.includes(q);
  });

  render(res);
  setStatus(`تم العثور على ${res.length} نتيجة.`);
}

// التحميل اليدوي (احتياطي)
function loadCSVFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      processData(reader.result);
    } catch (e) {
      setStatus("فشل قراءة الملف.");
      console.error(e);
    }
  };
  reader.readAsText(file, "utf-8");
}

// تفعيل الأزرار
document.getElementById("loadBtn")?.addEventListener("click", () => {
  const file = document.getElementById("csvFile")?.files?.[0];
  if (!file) {
    setStatus("اختر ملف CSV أولاً.");
    return;
  }
  loadCSVFromFile(file);
});

document.getElementById("btn")?.addEventListener("click", doSearch);
document.getElementById("clear")?.addEventListener("click", () => {
  if(qEl) qEl.value = "";
  doSearch();
});
qEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doSearch();
});
