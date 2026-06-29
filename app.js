(function () {
  const DATASET_INFO = {
    name: "DRGBT1K",
    trainSequences: 800,
    testSequences: 245,
    metrics: ["PR", "NPR", "SR"],
    source: "DRGBT1k_results.xlsx"
  };

  const BATCH_LABELS = {
    "第一批方法": "Batch 1",
    "第二批方法": "Batch 2"
  };

  const CATEGORY_LABELS = {
    "全微调 RGBT": "Full Fine-tuning RGBT",
    "部分微调 RGBT": "Partial Fine-tuning RGBT",
    "多模态跟踪 (仅训练RGBT)": "Multimodal Tracking (RGBT-Only Training)"
  };

  const DEFAULT_CATEGORY = "全微调 RGBT";
  const STATUS_LABELS = {
    evaluated: "Evaluated",
    pending: "Pending"
  };

  const state = {
    metric: "SR",
    query: "",
    data: null,
    sourceLabel: DATASET_INFO.source
  };

  const metricSelect = document.getElementById("metric-select");
  const searchInput = document.getElementById("search-input");
  const leaderboardBody = document.getElementById("leaderboard-body");
  const overview = document.getElementById("overview");
  const heroPanel = document.getElementById("hero-panel");
  const timelineChart = document.getElementById("timeline-chart");
  const timelineMeta = document.getElementById("timeline-meta");
  const dataStatus = document.getElementById("data-status");

  metricSelect.value = state.metric;

  metricSelect.addEventListener("change", (event) => {
    state.metric = event.target.value;
    render();
  });

  searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function scoreText(value) {
    if (value == null || Number.isNaN(Number(value))) {
      return "N/A";
    }
    return (Math.round(Number(value) * 1000) / 1000).toFixed(3);
  }

  function metricValue(method, metric) {
    const value = method.metrics ? method.metrics[metric] : null;
    return value == null || Number.isNaN(Number(value)) ? null : Number(value);
  }

  function normalizeHeader(value) {
    return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
  }

  function normalizeMethodKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/（/g, "(")
      .replace(/）/g, ")")
      .replace(/\(.*?\)/g, "")
      .replace(/[^a-z0-9]+/g, "");
  }

  function parseMetric(value) {
    if (value == null || value === "") {
      return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function extractYearNumber(rawValue) {
    const text = String(rawValue || "").trim();
    if (!text) {
      return null;
    }

    const matches = text.match(/(20\d{2}|\d{2})(?!.*\d)/);
    if (!matches) {
      return null;
    }

    const token = matches[1];
    return token.length === 4 ? Number(token) : 2000 + Number(token);
  }

  function extractVenue(rawValue) {
    const text = String(rawValue || "").trim();
    if (!text) {
      return "";
    }
    return text.replace(/[^A-Za-z]+/g, " ").trim().replace(/\s+/g, " ");
  }

  function cleanPublicationLabel(rawValue) {
    const text = String(rawValue || "").trim();
    if (!text) {
      return "";
    }

    const yearNumber = extractYearNumber(text);
    const venue = extractVenue(text);

    if (venue && yearNumber) {
      return `${venue} ${yearNumber}`;
    }
    if (yearNumber) {
      return String(yearNumber);
    }
    return venue || text;
  }

  function parseResource(value) {
    const candidate = String(value || "").trim();
    if (!candidate) {
      return { url: null, localPath: null };
    }
    if (/^(https?:)?\/\//.test(candidate) || candidate.startsWith("./") || candidate.startsWith("../") || candidate.startsWith("/")) {
      return { url: candidate, localPath: null };
    }
    if (/^doi:/i.test(candidate)) {
      return { url: `https://doi.org/${candidate.slice(4).trim()}`, localPath: null };
    }
    if (/^[A-Za-z]:\\/.test(candidate)) {
      return { url: null, localPath: candidate };
    }
    if (/^[A-Za-z0-9._-]+\.[A-Za-z]{2,}/.test(candidate)) {
      return { url: `https://${candidate}`, localPath: null };
    }
    return { url: null, localPath: candidate };
  }

  function safeUrl(url) {
    if (!url) {
      return null;
    }
    const candidate = String(url).trim();
    if (/^(https?:)?\/\//.test(candidate) || candidate.startsWith("./") || candidate.startsWith("../") || candidate.startsWith("/")) {
      return candidate;
    }
    return null;
  }

  function translateBatch(label) {
    return BATCH_LABELS[label] || label || "Batch";
  }

  function translateCategory(label) {
    return CATEGORY_LABELS[label] || label || "Uncategorized";
  }

  function statusLabel(status) {
    return STATUS_LABELS[status] || "Pending";
  }

  function loadConfigMap(configEntries) {
    const map = new Map();

    (configEntries || []).forEach((entry) => {
      const key = normalizeMethodKey(entry.id || entry.name);
      if (!key) {
        return;
      }

      const result = parseResource(entry.result_url || entry.result_path);
      const code = parseResource(entry.code_url || entry.code_path);
      const weight = parseResource(entry.weight_url || entry.weight_path);

      map.set(key, { result, code, weight });
    });

    return map;
  }

  function buildResources(paperUrl, methodKey, configMap) {
    const config = configMap.get(methodKey) || {};
    const result = config.result || { url: null, localPath: null };
    const code = config.code || { url: null, localPath: null };
    const weight = config.weight || { url: null, localPath: null };

    return [
      { key: "paper", label: "Paper", url: paperUrl, localPath: null },
      { key: "result", label: "Tracking Result", url: result.url, localPath: result.localPath },
      { key: "code", label: "Code", url: code.url, localPath: code.localPath },
      { key: "weight", label: "Weight", url: weight.url, localPath: weight.localPath }
    ];
  }

  function detectColumns(headers) {
    const columns = {
      paperTitle: null,
      method: null,
      year: null,
      pr: null,
      npr: null,
      sr: null,
      paper: null
    };

    headers.forEach((header, index) => {
      const normalized = normalizeHeader(header);
      const columnIndex = index + 1;

      if (normalized === "论文名" || normalized === "papertitle" || normalized === "title") {
        columns.paperTitle = columnIndex;
      } else if (normalized === "method" || normalized === "方法" || normalized === "方法名" || normalized.includes("训练方式")) {
        columns.method = columnIndex;
      } else if (normalized === "year" || normalized === "发表年份" || normalized === "time") {
        columns.year = columnIndex;
      } else if (normalized === "pr") {
        columns.pr = columnIndex;
      } else if (normalized === "npr") {
        columns.npr = columnIndex;
      } else if (normalized === "sr") {
        columns.sr = columnIndex;
      } else if (normalized === "paper" || normalized === "paperlink" || normalized === "论文链接") {
        columns.paper = columnIndex;
      }
    });

    return columns;
  }

  function cellAddress(rowIndex, columnIndex) {
    return XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex - 1 });
  }

  function sheetCell(sheet, rowIndex, columnIndex) {
    if (!columnIndex) {
      return null;
    }
    return sheet[cellAddress(rowIndex, columnIndex)];
  }

  function cellDisplayValue(sheet, rowIndex, columnIndex) {
    const cell = sheetCell(sheet, rowIndex, columnIndex);
    if (!cell) {
      return "";
    }
    return String(cell.w != null ? cell.w : cell.v != null ? cell.v : "").trim();
  }

  function cellRawValue(sheet, rowIndex, columnIndex) {
    const cell = sheetCell(sheet, rowIndex, columnIndex);
    return cell ? cell.v : null;
  }

  function cellLink(sheet, rowIndex, columnIndex) {
    const cell = sheetCell(sheet, rowIndex, columnIndex);
    return cell && cell.l ? cell.l.Target || cell.l.location || null : null;
  }

  function methodLooksLikeSection(methodName, yearRaw, pr, npr, sr, paperTitle, paperUrl) {
    if (!methodName) {
      return false;
    }
    if (yearRaw || paperTitle || paperUrl) {
      return false;
    }
    if ([pr, npr, sr].some((value) => value != null)) {
      return false;
    }
    return !/^[A-Za-z0-9]/.test(methodName);
  }

  function buildMethodsFromWorkbook(workbook, configMap, sourceName) {
    const methods = [];

    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(sheet["!ref"]);
      const headers = [];

      for (let column = range.s.c; column <= range.e.c; column += 1) {
        const address = XLSX.utils.encode_cell({ r: range.s.r, c: column });
        const cell = sheet[address];
        headers.push(cell ? (cell.w != null ? cell.w : cell.v) : "");
      }

      const columns = detectColumns(headers);
      let currentCategory = DEFAULT_CATEGORY;

      for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
        const rowIndex = row + 1;
        const methodName = cellDisplayValue(sheet, rowIndex, columns.method);
        if (!methodName) {
          continue;
        }

        const paperTitle = cellDisplayValue(sheet, rowIndex, columns.paperTitle).replace(/\s+/g, " ").trim();
        const yearRaw = cellDisplayValue(sheet, rowIndex, columns.year);
        const pr = parseMetric(cellRawValue(sheet, rowIndex, columns.pr));
        const npr = parseMetric(cellRawValue(sheet, rowIndex, columns.npr));
        const sr = parseMetric(cellRawValue(sheet, rowIndex, columns.sr));
        const paperCandidate = cellLink(sheet, rowIndex, columns.paper) || cellDisplayValue(sheet, rowIndex, columns.paper);
        const paperResource = parseResource(paperCandidate);

        if (methodLooksLikeSection(methodName, yearRaw, pr, npr, sr, paperTitle, paperResource.url)) {
          currentCategory = methodName;
          continue;
        }

        const methodKey = normalizeMethodKey(methodName);
        methods.push({
          id: `${translateBatch(sheetName).toLowerCase().replace(/\s+/g, "-")}-${methodKey || rowIndex}`,
          name: methodName,
          paperTitle,
          publication: cleanPublicationLabel(yearRaw),
          timeRaw: yearRaw,
          yearNumber: extractYearNumber(yearRaw),
          batchLabel: translateBatch(sheetName),
          categoryLabel: translateCategory(currentCategory),
          status: [pr, npr, sr].every((value) => value != null) ? "evaluated" : "pending",
          hasMetrics: [pr, npr, sr].every((value) => value != null),
          metrics: {
            PR: pr,
            NPR: npr,
            SR: sr
          },
          resources: buildResources(paperResource.url, methodKey, configMap)
        });
      }
    });

    return {
      generatedAt: new Date().toISOString(),
      dataset: {
        ...DATASET_INFO,
        source: sourceName
      },
      methods
    };
  }

  function hydrateFallbackData(data) {
    const methods = (data.methods || []).map((method, index) => {
      const metrics = method.metrics || {};
      const pr = parseMetric(metrics.PR);
      const npr = parseMetric(metrics.NPR);
      const sr = parseMetric(metrics.SR);
      const timeRaw = String(method.timeRaw || "").trim();

      return {
        id: method.id || `entry-${index}`,
        name: String(method.name || "").trim(),
        paperTitle: String(method.paperTitle || "").replace(/\s+/g, " ").trim(),
        publication: method.publication || cleanPublicationLabel(timeRaw),
        timeRaw,
        yearNumber: method.yearNumber || extractYearNumber(timeRaw),
        batchLabel: method.batchLabel || "Imported",
        categoryLabel: method.categoryLabel || "Imported",
        status: method.status || ([pr, npr, sr].every((value) => value != null) ? "evaluated" : "pending"),
        hasMetrics: method.hasMetrics != null ? Boolean(method.hasMetrics) : [pr, npr, sr].every((value) => value != null),
        metrics: {
          PR: pr,
          NPR: npr,
          SR: sr
        },
        resources: Array.isArray(method.resources) ? method.resources : []
      };
    });

    return {
      generatedAt: data.generatedAt || new Date().toISOString(),
      dataset: {
        ...DATASET_INFO,
        ...(data.dataset || {})
      },
      methods
    };
  }

  async function loadMethodConfig() {
    const response = await fetch("methods.config.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Unable to fetch methods.config.json (${response.status})`);
    }
    return response.json();
  }

  async function loadExcelData(configMap) {
    if (typeof XLSX === "undefined") {
      throw new Error("XLSX parser is unavailable");
    }

    const response = await fetch(DATASET_INFO.source, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Unable to fetch ${DATASET_INFO.source} (${response.status})`);
    }

    const buffer = await response.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    return buildMethodsFromWorkbook(workbook, configMap, DATASET_INFO.source);
  }

  async function loadData() {
    try {
      let configMap = new Map();
      try {
        const configEntries = await loadMethodConfig();
        configMap = loadConfigMap(configEntries);
      } catch (configError) {
        configMap = new Map();
      }

      const data = await loadExcelData(configMap);
      state.sourceLabel = DATASET_INFO.source;
      return data;
    } catch (error) {
      if (window.DRGBT_DATA) {
        const fallback = hydrateFallbackData(window.DRGBT_DATA);
        const fallbackSource = fallback.dataset && fallback.dataset.source ? fallback.dataset.source : "data.js";
        state.sourceLabel = `${fallbackSource} fallback`;
        return fallback;
      }
      throw error;
    }
  }

  function filterMethods(methods) {
    if (!state.query) {
      return methods;
    }

    return methods.filter((method) => {
      const haystack = [
        method.name,
        method.paperTitle || "",
        method.publication || "",
        method.timeRaw || "",
        method.batchLabel || "",
        method.categoryLabel || ""
      ].join(" ").toLowerCase();

      return haystack.includes(state.query);
    });
  }

  function sortMethods(methods) {
    return [...methods].sort((left, right) => {
      const leftValue = metricValue(left, state.metric);
      const rightValue = metricValue(right, state.metric);

      if (leftValue == null && rightValue == null) {
        return (right.yearNumber || 0) - (left.yearNumber || 0) || left.name.localeCompare(right.name);
      }
      if (leftValue == null) {
        return 1;
      }
      if (rightValue == null) {
        return -1;
      }

      const delta = rightValue - leftValue;
      if (delta !== 0) {
        return delta;
      }

      return (right.yearNumber || 0) - (left.yearNumber || 0) || left.name.localeCompare(right.name);
    });
  }

  function resourceButton(resource) {
    const label = escapeHtml(resource.label);
    const url = safeUrl(resource.url);

    if (url) {
      let titleAttr = "";
      if (url.includes("pwd=")) {
        const match = url.match(/[?&]pwd=([a-zA-Z0-9]+)/);
        if (match) {
          titleAttr = ` title="提取码: ${escapeHtml(match[1])}"`;
        }
      }
      return `<a class="link-pill" href="${escapeHtml(url)}" target="_blank" rel="noreferrer"${titleAttr}>${label}</a>`;
    }

    const title = resource.localPath ? ` title="${escapeHtml(resource.localPath)}"` : ` title="Link not available yet"`;
    return `<span class="link-pill-disabled"${title}>${label}</span>`;
  }

  function renderOverview(sortedMethods) {
    const evaluatedMethods = sortedMethods.filter((method) => method.status === "evaluated");
    const leader = evaluatedMethods[0] || null;

    overview.innerHTML = [
      {
        title: "Test Sequences",
        value: state.data.dataset.testSequences
      },
      {
        title: "Train Sequences",
        value: state.data.dataset.trainSequences
      },
      {
        title: "Methods Loaded",
        value: sortedMethods.length
      },
      {
        title: "Evaluated Methods",
        value: evaluatedMethods.length
      },
      {
        title: `Current Leader (${state.metric})`,
        value: leader ? leader.name : "-"
      }
    ].map((item) => `
      <article class="stat-card">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.value)}</p>
      </article>
    `).join("");
  }

  function renderHero(sortedMethods) {
    const topThree = sortedMethods.filter((method) => metricValue(method, state.metric) != null).slice(0, 3);

    heroPanel.innerHTML = `
      <h2>${escapeHtml(state.metric)} Top 3</h2>
      <p class="muted">The page keeps the original lightweight layout, now powered by DRGBT1k_results.xlsx with more methods, paper links, and reserved resource slots.</p>
      <ul>
        ${topThree.map((method, index) => `
          <li>
            <span>#${index + 1} ${escapeHtml(method.name)} <em>${escapeHtml(method.publication || method.batchLabel)}</em></span>
            <strong>${escapeHtml(scoreText(metricValue(method, state.metric)))}</strong>
          </li>
        `).join("")}
      </ul>
    `;
  }

  function buildRankMap(sortedMethods) {
    const rankMap = new Map();
    let rank = 0;

    sortedMethods.forEach((method) => {
      if (metricValue(method, state.metric) == null) {
        return;
      }
      rank += 1;
      rankMap.set(method.id, rank);
    });

    return rankMap;
  }

  function renderTable(sortedMethods) {
    if (!sortedMethods.length) {
      leaderboardBody.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="empty-state">No methods match the current search.</div>
          </td>
        </tr>
      `;
      return;
    }

    const rankMap = buildRankMap(sortedMethods);

    leaderboardBody.innerHTML = sortedMethods.map((method) => {
      const paperResource = method.resources.find((resource) => resource.key === "paper") || { label: "Paper" };
      const rank = rankMap.get(method.id);

      return `
        <tr>
          <td><span class="rank-chip">${rank || "-"}</span></td>
          <td>
            <div class="method-name">${escapeHtml(method.name)}</div>
            ${method.paperTitle ? `<div class="method-subline">${escapeHtml(method.paperTitle)}</div>` : ""}
          </td>
          <td>
            <div class="time-label">${escapeHtml(method.publication || method.timeRaw || "Unknown")}</div>
            <div class="muted">${method.yearNumber || ""}</div>
          </td>
          <td class="score">${escapeHtml(scoreText(metricValue(method, "PR")))}</td>
          <td class="score">${escapeHtml(scoreText(metricValue(method, "NPR")))}</td>
          <td class="score">${escapeHtml(scoreText(metricValue(method, "SR")))}</td>
          <td>${resourceButton(paperResource)}</td>
          <td>
            <div class="resource-links">
              ${method.resources.filter((resource) => resource.key !== "paper").map(resourceButton).join("")}
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function estimateLabelWidth(text) {
    return Math.max(76, text.length * 7.2 + 20);
  }

  function boxesOverlap(a, b, padding = 8) {
    return !(
      a.x + a.width + padding <= b.x ||
      b.x + b.width + padding <= a.x ||
      a.y + a.height + padding <= b.y ||
      b.y + b.height + padding <= a.y
    );
  }

  function buildTimelineAnnotations(points, xForYear, yForScore, bounds) {
    const labelHeight = 24;
    const gap = 14;
    const offsetPattern = [0, -28, 28, -56, 56, -84, 84, -112, 112];
    const annotations = [];

    const sortedPoints = [...points].sort((left, right) =>
      left.yearNumber - right.yearNumber || yForScore(metricValue(left, state.metric)) - yForScore(metricValue(right, state.metric))
    );

    sortedPoints.forEach((method) => {
      const x = xForYear(method.yearNumber);
      const y = yForScore(metricValue(method, state.metric));
      const label = method.name;
      const labelWidth = estimateLabelWidth(label);
      const prefersLeft = x > bounds.right - labelWidth - 20;
      const sides = prefersLeft ? ["left", "right"] : ["right", "left"];
      const candidates = [];

      sides.forEach((side) => {
        offsetPattern.forEach((offset, offsetIndex) => {
          const rawX = side === "right" ? x + gap : x - gap - labelWidth;
          const boxX = clamp(rawX, bounds.left, bounds.right - labelWidth);
          const boxY = clamp(y - labelHeight / 2 + offset, bounds.top, bounds.bottom - labelHeight);
          const anchorX = side === "right" ? boxX : boxX + labelWidth;
          const anchorY = clamp(y, boxY + 6, boxY + labelHeight - 6);
          const box = { x: boxX, y: boxY, width: labelWidth, height: labelHeight };
          const overlapCount = annotations.reduce((count, item) => count + (boxesOverlap(box, item.box) ? 1 : 0), 0);
          const edgePenalty = Math.abs(rawX - boxX);
          const score = overlapCount * 1000 + offsetIndex * 10 + edgePenalty;

          candidates.push({
            method,
            x,
            y,
            label,
            box,
            anchorX,
            anchorY,
            score
          });
        });
      });

      candidates.sort((left, right) => left.score - right.score);
      annotations.push(candidates[0]);
    });

    return annotations;
  }

  function renderTimeline(sortedMethods) {
    const points = sortedMethods
      .filter((method) => method.yearNumber != null && metricValue(method, state.metric) != null)
      .sort((left, right) => left.yearNumber - right.yearNumber || metricValue(right, state.metric) - metricValue(left, state.metric));

    if (!points.length) {
      timelineMeta.textContent = "No time-based data is available for the current selection.";
      timelineChart.innerHTML = "";
      return;
    }

    const years = [...new Set(points.map((item) => item.yearNumber))].sort((left, right) => left - right);
    const yearlyBest = years.map((year) => {
      const entries = points.filter((item) => item.yearNumber === year);
      const best = [...entries].sort((left, right) => metricValue(right, state.metric) - metricValue(left, state.metric))[0];
      return { year, value: metricValue(best, state.metric) };
    });

    const width = 1120;
    const height = 480;
    const margin = { top: 34, right: 84, bottom: 52, left: 84 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const minYear = years[0];
    const maxYear = years[years.length - 1];
    const maxScore = Math.max(...points.map((item) => metricValue(item, state.metric)), 0.1);
    const yMax = Math.min(1, Math.max(0.35, maxScore * 1.1));

    const xForYear = (year) => {
      if (minYear === maxYear) {
        return margin.left + plotWidth / 2;
      }
      return margin.left + ((year - minYear) / (maxYear - minYear)) * plotWidth;
    };

    const yForScore = (value) => margin.top + (1 - value / yMax) * plotHeight;
    const yTicks = [0, yMax / 4, yMax / 2, (yMax * 3) / 4, yMax];
    const bestPath = yearlyBest.map((item, index) => {
      const prefix = index === 0 ? "M" : "L";
      return `${prefix} ${xForYear(item.year)} ${yForScore(item.value)}`;
    }).join(" ");

    const annotations = buildTimelineAnnotations(points, xForYear, yForScore, {
      left: margin.left,
      right: width - margin.right,
      top: margin.top,
      bottom: height - margin.bottom
    });

    timelineMeta.textContent = `Showing ${points.length} evaluated entries from ${minYear} to ${maxYear}, using ${state.metric} as the vertical axis.`;

    timelineChart.setAttribute("viewBox", `0 0 ${width} ${height}`);
    timelineChart.innerHTML = `
      <defs>
        <linearGradient id="trend-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#d3904d"></stop>
          <stop offset="100%" stop-color="#2d7a59"></stop>
        </linearGradient>
      </defs>
      ${yTicks.map((tick) => `
        <g>
          <line x1="${margin.left}" y1="${yForScore(tick)}" x2="${width - margin.right}" y2="${yForScore(tick)}" class="chart-grid"></line>
          <text x="${margin.left - 12}" y="${yForScore(tick) + 4}" text-anchor="end" class="chart-axis">${tick.toFixed(2)}</text>
        </g>
      `).join("")}
      ${years.map((year) => `
        <g>
          <line x1="${xForYear(year)}" y1="${margin.top}" x2="${xForYear(year)}" y2="${height - margin.bottom}" class="chart-year-line"></line>
          <text x="${xForYear(year)}" y="${height - margin.bottom + 24}" text-anchor="middle" class="chart-axis">${year}</text>
        </g>
      `).join("")}
      <path d="${bestPath}" class="chart-trend"></path>
      ${annotations.map((annotation) => {
      const textX = annotation.box.x + annotation.box.width / 2;
      const textY = annotation.box.y + annotation.box.height / 2 + 4;
      return `
          <g class="chart-point-group">
            <line x1="${annotation.x}" y1="${annotation.y}" x2="${annotation.anchorX}" y2="${annotation.anchorY}" class="chart-connector"></line>
            <circle cx="${annotation.x}" cy="${annotation.y}" r="6.5" class="chart-point"></circle>
            <rect x="${annotation.box.x}" y="${annotation.box.y}" width="${annotation.box.width}" height="${annotation.box.height}" rx="12" ry="12" class="chart-label-box"></rect>
            <text x="${textX}" y="${textY}" text-anchor="middle" class="chart-label">${escapeHtml(annotation.label)}</text>
            <title>${escapeHtml(`${annotation.method.name} | ${annotation.method.publication || annotation.method.yearNumber} | ${state.metric}: ${scoreText(metricValue(annotation.method, state.metric))}`)}</title>
          </g>
        `;
    }).join("")}
    `;
  }

  function renderStatus() {
    dataStatus.textContent = "If your DRGBT tracking work has been publicly released, please feel free to contact us at zhaodongding_ah@163.com, and we will include it in the leaderboard.";
  }

  function render() {
    if (!state.data) {
      return;
    }

    const filtered = filterMethods(state.data.methods);
    const sorted = sortMethods(filtered);

    renderStatus();
    renderHero(sorted);
    renderOverview(sorted);
    renderTable(sorted);
    renderTimeline(sorted);
  }

  async function bootstrap() {
    try {
      state.data = await loadData();
      render();
    } catch (error) {
      dataStatus.textContent = `Unable to load benchmark data: ${error.message}`;
      heroPanel.innerHTML = `<p class="muted">Unable to load DRGBT1k_results.xlsx and no fallback snapshot is available.</p>`;
    }
  }

  bootstrap();
})();
