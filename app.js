const data = window.JOURNAL_DATA;

const searchInput = document.querySelector("#search-input");
const keywordInput = document.querySelector("#keyword-input");
const fieldFilter = document.querySelector("#field-filter");
const quartileFilter = document.querySelector("#quartile-filter");
const results = document.querySelector("#results");
const heroStats = document.querySelector("#hero-stats");
const journalModal = document.querySelector("#journal-modal");
const modalTitle = document.querySelector("#modal-title");
const modalContent = document.querySelector("#modal-content");
const modalClose = document.querySelector("#modal-close");
const DEFAULT_PREVIEW_LIMIT = 12;
const expandedFields = new Set();

const allDegrees = Object.keys(data.groups);
const allFields = allDegrees.flatMap((degree) =>
  data.groups[degree].map((field) => ({
    id: field.id,
    name: field.name,
    degree,
  }))
);

function formatNumber(value) {
  return new Intl.NumberFormat("th-TH").format(value);
}

function setupHeader() {
  heroStats.innerHTML = "";

  const stats = [
    { label: "วารสารที่เข้ากลุ่ม", value: data.meta.totalMatchedJournals },
    { label: "มี percentile/Q", value: data.meta.metricsMatched || 0 },
    {
      label: "สาขาวิชา",
      value: allDegrees.reduce((sum, degree) => sum + data.groups[degree].length, 0),
    },
  ];

  stats.forEach((stat) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `<p class="panel-label">${stat.label}</p><strong>${stat.value}</strong>`;
    heroStats.appendChild(card);
  });
}

function setupFilters() {
  allFields.forEach((field) => {
    const option = document.createElement("option");
    option.value = field.id;
    option.textContent = `${field.name} (${field.degree})`;
    fieldFilter.appendChild(option);
  });
}

function matchesAllTerms(text, rawQuery) {
  const normalizedTerms = rawQuery
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (!normalizedTerms.length) {
    return true;
  }

  return normalizedTerms.every((term) => text.includes(term));
}

function journalMatches(item, titleQuery, keywordQuery, allowedFieldId, allowedQuartile) {
  const titleText = [item.title, item.issn, item.eissn].join(" ").toLowerCase();
  const keywordText = [
    item.publisher,
    item.coverage,
    item.asjc,
    item.topLevels.join(" "),
    item.metrics?.quartile || "",
    item.metrics?.highestPercentileValue || "",
    item.metrics?.percentileRank || "",
    item.metrics?.percentileSubject || "",
    item.classifications.map((entry) => `${entry.degree} ${entry.fieldName} ${entry.matchedBy}`).join(" "),
  ]
    .join(" ")
    .toLowerCase();
  const fieldAllowed =
    allowedFieldId === "ทั้งหมด" ||
    item.classifications.some((entry) => entry.fieldId === allowedFieldId);
  const quartileValue = item.metrics?.quartile || "";
  const quartileAllowed =
    allowedQuartile === "ทั้งหมด" ||
    (allowedQuartile === "ไม่มีข้อมูล" ? !quartileValue : quartileValue === allowedQuartile);

  if (!fieldAllowed || !quartileAllowed) {
    return false;
  }

  return matchesAllTerms(titleText, titleQuery) && matchesAllTerms(keywordText, keywordQuery);
}

function render() {
  const query = searchInput.value;
  const keywordQuery = keywordInput.value;
  const fieldId = fieldFilter.value;
  const quartile = quartileFilter.value;
  const hasQuery = query.trim().length > 0 || keywordQuery.trim().length > 0;
  const matchedItems = data.items.filter((item) =>
    journalMatches(item, query, keywordQuery, fieldId, quartile)
  );

  results.innerHTML = "";

  if (!matchedItems.length) {
    results.innerHTML = `<div class="empty-state">ไม่พบวารสารที่ตรงกับคำค้นหรือเงื่อนไขที่เลือก</div>`;
    return;
  }

  const allVisibleFields = allDegrees
    .flatMap((groupDegree) =>
      data.groups[groupDegree].map((field) => {
        const journals = matchedItems.filter((item) =>
          item.classifications.some((entry) => entry.fieldId === field.id)
        );
        return { ...field, journals };
      })
    )
    .filter((field) => field.journals.length > 0)
    .filter((field) => fieldId === "ทั้งหมด" || field.id === fieldId);

  const fieldList = document.createElement("div");
  fieldList.className = "field-list";

  allVisibleFields.forEach((field) => {
    const block = document.createElement("article");
    block.className = "field-block";

    const isExpanded = hasQuery || expandedFields.has(field.id);
    const visibleJournals = isExpanded ? field.journals : field.journals.slice(0, DEFAULT_PREVIEW_LIMIT);
    const cards = visibleJournals
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((journal) => {
            const currentTags = journal.classifications
              .filter((entry) => entry.fieldId === field.id)
              .map((entry) => `<span class="tag">${entry.matchedBy}</span>`)
              .join("");

            const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
              `"${journal.title}" journal official site`
            )}`;
            const topLevels = journal.topLevels.length
              ? `<div>${journal.topLevels.join(" | ")}</div>`
              : "";
            const metricsHtml = journal.metrics && journal.metrics.quartile
              ? `<div><strong>Highest percentile:</strong> ${journal.metrics.highestPercentileValue}% (${journal.metrics.quartile})</div>
                 <div><strong>Subject rank:</strong> ${journal.metrics.percentileRank || "-"} ${journal.metrics.percentileSubject ? `| ${journal.metrics.percentileSubject}` : ""}</div>`
              : `<div><strong>Highest percentile:</strong> -</div>`;

            return `
              <article class="journal-card">
                <h4><button class="journal-title-button" type="button" data-journal-title="${encodeURIComponent(journal.title)}">${journal.title}</button></h4>
                <div class="journal-meta">
                  <div><strong>Publisher:</strong> ${journal.publisher || "-"}</div>
                  <div><strong>Coverage:</strong> ${journal.coverage || "-"}</div>
                  <div><strong>ISSN / EISSN:</strong> ${journal.issn || "-"} / ${journal.eissn || "-"}</div>
                  <div><strong>ASJC:</strong> ${journal.asjc || "-"}</div>
                  ${metricsHtml}
                  ${topLevels}
                </div>
                <div class="journal-tags">${currentTags}</div>
                <div class="journal-links">
                  <a href="${googleSearchUrl}" target="_blank" rel="noopener noreferrer">ค้นหาเว็บไซต์วารสาร</a>
                </div>
              </article>
            `;
      })
      .join("");

    const previewMessage =
      !isExpanded && field.journals.length > DEFAULT_PREVIEW_LIMIT
        ? `<p class="preview-note">กำลังแสดงตัวอย่าง ${formatNumber(DEFAULT_PREVIEW_LIMIT)} จากทั้งหมด ${formatNumber(field.journals.length)} วารสาร พิมพ์คำค้นเพื่อดูผลลัพธ์ที่เจาะจงขึ้น</p>`
        : "";

    const toggleButton =
      field.journals.length > DEFAULT_PREVIEW_LIMIT && !hasQuery
        ? `<button class="count-badge toggle-button" type="button" data-field-id="${field.id}">
                ${isExpanded ? "ซ่อนบางส่วน" : `แสดงทั้งหมด ${formatNumber(field.journals.length)} วารสาร`}
              </button>`
        : `<span class="count-badge">${formatNumber(field.journals.length)} วารสาร</span>`;

    block.innerHTML = `
      <div class="field-header">
        <div>
          <h3>${field.name}</h3>
        </div>
        ${toggleButton}
      </div>
      ${previewMessage}
      <div class="journal-grid">${cards}</div>
    `;

    fieldList.appendChild(block);
  });

  results.appendChild(fieldList);
}

setupHeader();
setupFilters();
render();

searchInput.addEventListener("input", render);
keywordInput.addEventListener("input", render);
fieldFilter.addEventListener("change", render);
quartileFilter.addEventListener("change", render);
results.addEventListener("click", (event) => {
  const button = event.target.closest(".toggle-button");
  if (!button) {
    return;
  }

  const fieldId = button.dataset.fieldId;
  if (!fieldId) {
    return;
  }

  if (expandedFields.has(fieldId)) {
    expandedFields.delete(fieldId);
  } else {
    expandedFields.add(fieldId);
  }

  render();
});

function openJournalModal(journalTitle) {
  const journal = data.items.find((item) => item.title === journalTitle);
  if (!journal) {
    return;
  }

  const scopusSearchUrl = `https://www.scopus.com/results/results.uri?src=s&s=${encodeURIComponent(
    `SRCTITLE("${journal.title}")`
  )}`;
  const googlePercentileUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `"${journal.title}" "highest percentile" Scopus`
  )}`;
  const fieldList = journal.classifications
    .map((entry) => `<span class="tag">${entry.degree} | ${entry.fieldName}</span>`)
    .join("");
  const highestPercentileBlock =
    journal.metrics && journal.metrics.quartile
      ? `
        <div><strong>Highest percentile:</strong> ${journal.metrics.highestPercentileValue}%</div>
        <div><strong>Quartile:</strong> ${journal.metrics.quartile}</div>
        <div><strong>Rank:</strong> ${journal.metrics.percentileRank || "-"}</div>
        <div><strong>Subject:</strong> ${journal.metrics.percentileSubject || "-"}</div>
      `
      : `
        <div><strong>Highest percentile:</strong> -</div>
        <div><strong>Quartile:</strong> -</div>
      `;

  modalTitle.textContent = journal.title;
  modalContent.innerHTML = `
    <div class="modal-grid">
      <div class="modal-section">
        <p class="panel-label">ข้อมูลเบื้องต้น</p>
        <div class="journal-meta">
          <div><strong>Publisher:</strong> ${journal.publisher || "-"}</div>
          <div><strong>Coverage:</strong> ${journal.coverage || "-"}</div>
          <div><strong>ISSN:</strong> ${journal.issn || "-"}</div>
          <div><strong>EISSN:</strong> ${journal.eissn || "-"}</div>
          <div><strong>ASJC:</strong> ${journal.asjc || "-"}</div>
          <div><strong>Top level:</strong> ${journal.topLevels.join(" | ") || "-"}</div>
          ${highestPercentileBlock}
        </div>
      </div>
      <div class="modal-section">
        <p class="panel-label">สาขาที่เกี่ยวข้อง</p>
        <div class="journal-tags">${fieldList || '<span class="tag">-</span>'}</div>
      </div>
      <div class="modal-section">
        <p class="panel-label">Highest percentile</p>
        <p class="modal-note">ค่าด้านบนดึงจากไฟล์ 1000-source-results ที่ match ชื่อวารสารได้ ส่วนถ้ายังไม่พบ สามารถค้นหาต่อจากปุ่มด้านล่างได้</p>
        <div class="journal-links">
          <a href="${scopusSearchUrl}" target="_blank" rel="noopener noreferrer">ค้นหาใน Scopus</a>
          <a href="${googlePercentileUrl}" target="_blank" rel="noopener noreferrer">ค้นหา Highest percentile</a>
        </div>
      </div>
    </div>
  `;

  journalModal.showModal();
}

modalClose.addEventListener("click", () => {
  journalModal.close();
});

journalModal.addEventListener("click", (event) => {
  const rect = journalModal.querySelector(".modal-card").getBoundingClientRect();
  const clickedInside =
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom;

  if (!clickedInside) {
    journalModal.close();
  }
});

results.addEventListener("click", (event) => {
  const titleButton = event.target.closest(".journal-title-button");
  if (titleButton) {
    const journalTitle = decodeURIComponent(titleButton.dataset.journalTitle || "");
    openJournalModal(journalTitle);
    return;
  }
});
