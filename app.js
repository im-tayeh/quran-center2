const SPREADSHEET_ID = "14bW4VEbCGTOq55aYXiti6xZUPRkwMax7iC7NiynOjb4";

const SHEETS_CONFIG = {
    primary: { sheetName: "المرحلة الابتدائية", title: "المرحلة الابتدائية" },
    prep: { sheetName: "المرحلة الإعدادية", title: "المرحلة الإعدادية" },
    secondary: { sheetName: "المرحلة الثانوية", title: "المرحلة الثانوية" },
    teachers: { sheetName: "المحفظين", title: "المحفظون" }
};

const COLUMN_RANGES = {
    primary: { start: 2, end: 10 },
    prep: { start: 2, end: 10 },
    secondary: { start: 2, end: 10 },
    teachers: { start: 0, end: 11 }
};

const splashEl = document.getElementById("splash");
const mainEl = document.getElementById("main");
const startBtn = document.getElementById("startBtn");
const backToSplashBtn = document.getElementById("backToSplashBtn");
const studentsMainBtn = document.getElementById("studentsMainBtn");
const levelButtons = document.querySelectorAll(".level-btn");
const tableTitleEl = document.getElementById("tableTitle");
const tableSubtitleEl = document.getElementById("tableSubtitle");
const tableHeaderRowEl = document.getElementById("tableHeaderRow");
const tableBodyEl = document.getElementById("tableBody");
const loadingOverlayEl = document.getElementById("loadingOverlay");
const reloadBtn = document.getElementById("reloadBtn");
const statusPillEl = document.getElementById("statusPill");
const searchInputEl = document.getElementById("searchInput");

let currentLevelKey = null;
let currentAllRows = null;

function showSplash() {
    splashEl.classList.remove("hidden");
    mainEl.classList.add("hidden");
}

function showMain() {
    splashEl.classList.add("hidden");
    mainEl.classList.remove("hidden");
}

function resetToMainState() {
    currentLevelKey = null;
    currentAllRows = null;
    tableHeaderRowEl.innerHTML = "";
    tableBodyEl.innerHTML = `<tr><td colspan="10" class="muted-text">لم يتم اختيار مرحلة بعد.</td></tr>`;
    tableTitleEl.textContent = "اختر مرحلة من الأعلى لعرض بيانات الطلاب أو المحفظين";
    tableSubtitleEl.textContent = "لا يتم حفظ أي بيانات في هذه الصفحة، فقط قراءة مباشرة من Google Sheets.";
    levelButtons.forEach(btn => btn.classList.remove("active"));
    statusPillEl.classList.remove("ok");
    statusPillEl.textContent = "لا يوجد تحميل حالياً";
    searchInputEl.value = "";
}

function setLoadingState(isLoading, text) {
    if (isLoading) {
        loadingOverlayEl.classList.remove("hidden");
        statusPillEl.classList.add("ok");
        statusPillEl.textContent = text || "جاري تحميل البيانات...";
    } else {
        loadingOverlayEl.classList.add("hidden");
        statusPillEl.classList.remove("ok");
        statusPillEl.textContent = text || "جاهز";
    }
}

function setErrorState(message) {
    loadingOverlayEl.classList.add("hidden");
    statusPillEl.classList.remove("ok");
    statusPillEl.textContent = "حدث خطأ في التحميل";
    tableHeaderRowEl.innerHTML = "";
    tableBodyEl.innerHTML = `<tr><td colspan="10" class="error-msg">${message}</td></tr>`;
}

function buildCsvUrl(sheetName) {
    const cacheBuster = Date.now();
    return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&cb=${cacheBuster}`;
}

function parseCsv(csvText) {
    const rows = [];
    const lines = csvText.split(/\r?\n/).filter(l => l.length > 0);

    for (const line of lines) {
        const cells = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const ch = line[i];

            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch === "," && !inQuotes) {
                cells.push(current);
                current = "";
            } else {
                current += ch;
            }
        }

        cells.push(current);
        rows.push(cells);
    }

    return rows;
}

function getVisibleColumnIndexes(headerRow, levelKey) {
    const range = COLUMN_RANGES[levelKey];
    let indexes = [];

    if (range) {
        const start = Math.max(0, range.start);
        const end = Math.min(headerRow.length - 1, range.end);
        for (let i = start; i <= end; i++) indexes.push(i);
    } else {
        indexes = headerRow.map((_, i) => i);
    }

    if (indexes.length === 0) {
        indexes = headerRow.map((_, i) => i);
    }

    return indexes;
}

function normalizeCell(value) {
    if (value === undefined || value === null) return "";
    return String(value);
}

function renderTable(rows, filterTerm = "") {
    if (!rows || rows.length === 0) {
        tableHeaderRowEl.innerHTML = "";
        tableBodyEl.innerHTML = `<tr><td colspan="10" class="muted-text">لا توجد بيانات للعرض.</td></tr>`;
        return;
    }

    const headerRow = rows[0];
    const dataRows = rows.slice(1);
    const columnIndexes = getVisibleColumnIndexes(headerRow, currentLevelKey);

    tableHeaderRowEl.innerHTML = "";
    columnIndexes.forEach((colIndex, visibleIndex) => {
        const th = document.createElement("th");
        const headerText = normalizeCell(headerRow[colIndex]) || `عمود ${visibleIndex + 1}`;
        th.textContent = headerText;
        tableHeaderRowEl.appendChild(th);
    });

    tableBodyEl.innerHTML = "";

    if (dataRows.length === 0) {
        tableBodyEl.innerHTML = `<tr><td colspan="${columnIndexes.length}" class="muted-text">لا توجد سجلات بعد.</td></tr>`;
        tableSubtitleEl.textContent = "لا توجد سجلات لهذه المرحلة حالياً.";
        return;
    }

    const normalizedFilter = (filterTerm || "").trim().toLowerCase();

    const filteredRows = normalizedFilter
        ? dataRows.filter(row =>
            row.some(cell =>
                normalizeCell(cell).toLowerCase().includes(normalizedFilter)
            )
        )
        : dataRows;

    if (filteredRows.length === 0) {
        tableBodyEl.innerHTML = `<tr><td colspan="${columnIndexes.length}" class="muted-text">لا توجد سجلات مطابقة لبحثك.</td></tr>`;
    } else {
        filteredRows.forEach(row => {
            const tr = document.createElement("tr");
            columnIndexes.forEach(colIndex => {
                const td = document.createElement("td");
                td.textContent = normalizeCell(row[colIndex]);
                tr.appendChild(td);
            });
            tableBodyEl.appendChild(tr);
        });
    }

    if (normalizedFilter) {
        tableSubtitleEl.textContent = `إجمالي السجلات: ${filteredRows.length} من ${dataRows.length} (بعد التصفية)`;
    } else {
        tableSubtitleEl.textContent = `إجمالي السجلات: ${dataRows.length}`;
    }
}

async function loadLevel(levelKey) {
    const config = SHEETS_CONFIG[levelKey];
    if (!config || !config.sheetName || !SPREADSHEET_ID) {
        setErrorState("تأكد من ضبط SPREADSHEET_ID واسم الشيت لكل مرحلة في الكود.");
        return;
    }

    currentLevelKey = levelKey;
    currentAllRows = null;
    searchInputEl.value = "";

    tableTitleEl.textContent = `بيانات ${config.title}`;
    tableSubtitleEl.textContent = "جاري تحميل البيانات من الشيت...";

    levelButtons.forEach(btn => {
        if (btn.dataset.level === levelKey) btn.classList.add("active");
        else btn.classList.remove("active");
    });

    setLoadingState(true, "جاري تحميل بيانات " + config.title + "...");

    try {
        const url = buildCsvUrl(config.sheetName);
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("فشل الاتصال بـ Google Sheets، تأكد أن الشيت منشور للعامة.");
        }

        const csvText = await response.text();
        const rows = parseCsv(csvText);
        currentAllRows = rows;

        renderTable(currentAllRows);
        setLoadingState(false, "تم التحديث بنجاح");
    } catch (err) {
        console.error(err);
        setErrorState("تعذر تحميل البيانات: " + err.message);
    }
}

startBtn.addEventListener("click", showMain);

backToSplashBtn.addEventListener("click", showSplash);

studentsMainBtn.addEventListener("click", () => {
    showMain();
    resetToMainState();
});

levelButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        loadLevel(btn.dataset.level);
    });
});

reloadBtn.addEventListener("click", () => {
    if (currentLevelKey) {
        loadLevel(currentLevelKey);
    } else {
        tableSubtitleEl.textContent = "اختر مرحلة أولاً ثم اضغط تحديث.";
    }
});

searchInputEl.addEventListener("input", () => {
    if (!currentAllRows) return;
    renderTable(currentAllRows, searchInputEl.value);
});
