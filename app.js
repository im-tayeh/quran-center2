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

const GITHUB_OWNER = "im-tayeh";
const GITHUB_REPO = "quran-center2";

const REPORTS_FOLDERS = {
    primary: "primary",
    prep: "prep",
    secondary: "secondary",
    teachers: "teachers"
};

const splashEl = document.getElementById("splash");
const mainEl = document.getElementById("main");
const startBtn = document.getElementById("startBtn");
const backToSplashBtn = document.getElementById("backToSplashBtn");
const studentsMainBtn = document.getElementById("studentsMainBtn");
const reportsMainBtn = document.getElementById("reportsMainBtn");
const levelButtons = document.querySelectorAll(".level-btn");
const tableTitleEl = document.getElementById("tableTitle");
const tableSubtitleEl = document.getElementById("tableSubtitle");
const tableHeaderRowEl = document.getElementById("tableHeaderRow");
const tableBodyEl = document.getElementById("tableBody");
const loadingOverlayEl = document.getElementById("loadingOverlay");
const reloadBtn = document.getElementById("reloadBtn");
const statusPillEl = document.getElementById("statusPill");
const searchInputEl = document.getElementById("searchInput");
const mainModeTitleEl = document.getElementById("mainModeTitle");
const levelSectionTitleEl = document.getElementById("levelSectionTitle");
const dataViewEl = document.getElementById("dataView");
const reportsViewEl = document.getElementById("reportsView");

let currentLevelKey = null;
let currentAllRows = null;
let currentMode = "data";
let currentReports = [];

function showSplash() {
    splashEl.classList.remove("hidden");
    mainEl.classList.add("hidden");
}

function showMain() {
    splashEl.classList.add("hidden");
    mainEl.classList.remove("hidden");
}

function switchToDataMode() {
    currentMode = "data";
    studentsMainBtn.classList.add("active");
    reportsMainBtn.classList.remove("active");
    mainModeTitleEl.textContent = "القائمة الرئيسية";
    levelSectionTitleEl.textContent = "اختر المرحلة الدراسية أو قسم المحفظين لعرض بياناته";
    dataViewEl.classList.remove("hidden");
    reportsViewEl.classList.add("hidden");
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
    searchInputEl.placeholder = "بحث باسم الطالب أو الحلقة...";
}

function switchToReportsMode() {
    currentMode = "reports";
    studentsMainBtn.classList.remove("active");
    reportsMainBtn.classList.add("active");
    mainModeTitleEl.textContent = "التقارير الشهرية";
    levelSectionTitleEl.textContent = "اختر المرحلة الدراسية أو قسم المحفظين لعرض تقاريره";
    dataViewEl.classList.add("hidden");
    reportsViewEl.classList.remove("hidden");
    currentLevelKey = null;
    currentReports = [];
    reportsViewEl.innerHTML = "";
    tableHeaderRowEl.innerHTML = "";
    tableBodyEl.innerHTML = "";
    tableTitleEl.textContent = "اختر مرحلة من الأعلى لعرض تقاريره";
    tableSubtitleEl.textContent = "سيتم عرض جميع ملفات التقارير (PDF) للمرحلة المختارة.";
    levelButtons.forEach(btn => btn.classList.remove("active"));
    statusPillEl.classList.remove("ok");
    statusPillEl.textContent = "لا يوجد تحميل حالياً";
    searchInputEl.value = "";
    searchInputEl.placeholder = "بحث باسم التقرير...";
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

function renderReports(reports, filterTerm = "") {
    reportsViewEl.innerHTML = "";

    const normalizedFilter = (filterTerm || "").trim().toLowerCase();

    const filtered = normalizedFilter
        ? reports.filter(r => r.name.toLowerCase().includes(normalizedFilter))
        : reports;

    if (!filtered.length) {
        const div = document.createElement("div");
        div.className = "muted-text";
        div.style.padding = "10px 4px";
        div.textContent = normalizedFilter
            ? "لا توجد تقارير مطابقة لبحثك."
            : "لا توجد تقارير مضافة لهذه المرحلة حالياً.";
        reportsViewEl.appendChild(div);
        tableSubtitleEl.textContent = normalizedFilter
            ? `لا توجد تقارير مطابقة لبحثك (إجمالي الملفات: ${reports.length})`
            : "لا توجد تقارير مضافة لهذه المرحلة حالياً.";
        return;
    }

    filtered
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, "ar"))
        .forEach(report => {
            const a = document.createElement("a");
            a.href = report.url;
            a.download = report.name;
            a.className = "report-item";
            a.target = "_blank";

            const left = document.createElement("div");
            left.className = "report-item-left";

            const iconSpan = document.createElement("span");
            iconSpan.textContent = "📄";

            const textWrapper = document.createElement("div");
            const nameSpan = document.createElement("div");
            nameSpan.className = "report-name";
            nameSpan.textContent = report.name;

            const metaSpan = document.createElement("div");
            metaSpan.className = "report-meta";
            metaSpan.textContent = "ملف PDF - اضغط للتحميل";

            textWrapper.appendChild(nameSpan);
            textWrapper.appendChild(metaSpan);

            left.appendChild(iconSpan);
            left.appendChild(textWrapper);

            const downloadSpan = document.createElement("span");
            downloadSpan.className = "report-download-btn";
            downloadSpan.textContent = "تحميل";

            a.appendChild(left);
            a.appendChild(downloadSpan);

            reportsViewEl.appendChild(a);
        });

    tableSubtitleEl.textContent = `إجمالي التقارير: ${filtered.length} من ${reports.length}`;
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

async function loadReports(levelKey) {
    const config = SHEETS_CONFIG[levelKey];
    const folder = REPORTS_FOLDERS[levelKey];

    if (!config || !folder) {
        setErrorState("لا يوجد مجلد تقارير مضبوط لهذه المرحلة.");
        return;
    }

    currentLevelKey = levelKey;
    currentReports = [];
    searchInputEl.value = "";

    tableTitleEl.textContent = `تقارير ${config.title}`;
    tableSubtitleEl.textContent = "جاري تحميل التقارير من المستودع...";

    levelButtons.forEach(btn => {
        if (btn.dataset.level === levelKey) btn.classList.add("active");
        else btn.classList.remove("active");
    });

    setLoadingState(true, "جاري تحميل تقارير " + config.title + "...");

    try {
        const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/reports/${folder}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("تعذر الوصول إلى مجلد التقارير في GitHub.");
        }

        const items = await response.json();

        const pdfFiles = items.filter(
            item => item.type === "file" && item.name.toLowerCase().endsWith(".pdf")
        );

        currentReports = pdfFiles.map(file => ({
            name: file.name,
            url: file.download_url || file.html_url
        }));

        renderReports(currentReports);
        setLoadingState(false, "تم تحميل التقارير");
    } catch (err) {
        console.error(err);
        setErrorState("تعذر تحميل التقارير: " + err.message);
    }
}

startBtn.addEventListener("click", () => {
    showMain();
    switchToDataMode();
});

backToSplashBtn.addEventListener("click", showSplash);

studentsMainBtn.addEventListener("click", () => {
    showMain();
    switchToDataMode();
});

reportsMainBtn.addEventListener("click", () => {
    showMain();
    switchToReportsMode();
});

levelButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        if (currentMode === "data") {
            loadLevel(btn.dataset.level);
        } else {
            loadReports(btn.dataset.level);
        }
    });
});

reloadBtn.addEventListener("click", () => {
    if (!currentLevelKey) {
        tableSubtitleEl.textContent =
            currentMode === "data"
                ? "اختر مرحلة أولاً ثم اضغط تحديث."
                : "اختر مرحلة أولاً ثم اضغط تحديث التقارير.";
        return;
    }

    if (currentMode === "data") {
        loadLevel(currentLevelKey);
    } else {
        loadReports(currentLevelKey);
    }
});

searchInputEl.addEventListener("input", () => {
    if (currentMode === "data") {
        if (!currentAllRows) return;
        renderTable(currentAllRows, searchInputEl.value);
    } else if (currentMode === "reports") {
        renderReports(currentReports, searchInputEl.value);
    }
});
