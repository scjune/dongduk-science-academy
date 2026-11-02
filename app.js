(function () {
  var GRADES = ["1학년", "2학년"];
  var HASH_TO_GRADE = { "#1": "1학년", "#2": "2학년" };
  var SHEET_TIMEOUT_MS = 4000;

  var data = JSON.parse(JSON.stringify(window.INVITE_FALLBACK.grades));
  var loaded = false;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function parseCsv(text) {
    var rows = [], row = [], cell = "", quoted = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (ch !== "\r") cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  // 첫 줄을 열 이름으로 삼아 [{열 이름: 값}] 형태로 바꿉니다.
  function toRecords(rows) {
    var head = (rows[0] || []).map(function (s) { return s.trim(); });
    return rows.slice(1).map(function (row) {
      var record = {};
      head.forEach(function (name, i) { record[name] = (row[i] || "").trim(); });
      return record;
    });
  }

  function fetchTab(sheetId, tab, signal) {
    var url = "https://docs.google.com/spreadsheets/d/" + encodeURIComponent(sheetId) +
      "/gviz/tq?tqx=out:csv&headers=1&sheet=" + encodeURIComponent(tab);
    return fetch(url, { signal: signal, cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("sheet " + res.status);
      return res.text();
    }).then(function (text) {
      if (/^\s*</.test(text)) throw new Error("sheet is not public");
      return toRecords(parseCsv(text));
    });
  }

  function safeColor(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  }

  function loadSheet() {
    var sheetId = window.INVITE_SHEET_ID;
    if (!sheetId) return Promise.resolve();
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, SHEET_TIMEOUT_MS);
    var tabs = ["일정"].concat(GRADES).map(function (tab) {
      return fetchTab(sheetId, tab, controller.signal);
    });
    return Promise.all(tabs).then(function (results) {
      results[0].forEach(function (row) {
        var grade = data[row["학년"]];
        if (!grade) return;
        grade.date = row["날짜"] || grade.date;
        grade.time = row["시간"] || grade.time;
        grade.place = row["장소"] || grade.place;
        grade.bg = safeColor(row["배경색"], grade.bg);
        grade.accent = safeColor(row["포인트색"], grade.accent);
      });
      GRADES.forEach(function (name, i) {
        data[name].talks = results[i + 1].filter(function (row) {
          return row["발표자"] || row["연구 주제"];
        }).map(function (row) {
          return [row["부"], row["순서"], row["발표자"], row["연구 주제"]];
        });
      });
    }).catch(function (err) {
      console.warn("구글 시트를 불러오지 못해 기본 내용을 표시합니다.", err);
    }).then(function () { clearTimeout(timer); });
  }

  function setTheme(bg, accent) {
    var root = document.documentElement.style;
    root.setProperty("--bg", bg);
    root.setProperty("--accent", accent);
    document.querySelector('meta[name="theme-color"]').content = bg;
  }

  function renderHome() {
    var first = data["1학년"];
    setTheme(first.bg, first.accent);
    document.querySelectorAll(".grade-button").forEach(function (button) {
      var grade = data[button.dataset.grade];
      // 첫 화면의 날짜는 "11월 11일 (수)"처럼 연도를 빼고 보여 줍니다.
      button.querySelector("[data-date]").textContent = grade.date.replace(/^\d{4}년\s*/, "");
    });
  }

  function renderProgram(talks) {
    var box = document.getElementById("program");
    box.textContent = "";
    if (!loaded) {
      box.appendChild(el("p", "pending", "발표 순서를 불러오는 중입니다…"));
      return;
    }
    if (!talks.length) {
      box.appendChild(el("p", "pending", "발표 순서는 확정되는 대로 안내드리겠습니다."));
      return;
    }
    var list = null, currentPart = null;
    talks.forEach(function (talk) {
      if (!list || talk[0] !== currentPart) {
        currentPart = talk[0];
        if (currentPart) box.appendChild(el("p", "part", currentPart));
        list = box.appendChild(el("ol", "talks"));
      }
      var item = list.appendChild(el("li", "talk"));
      item.appendChild(el("span", "talk-no", talk[1]));
      var body = item.appendChild(el("div"));
      body.appendChild(el("p", "talk-name", talk[2]));
      body.appendChild(el("p", "talk-topic", talk[3]));
    });
  }

  function renderDetail(name) {
    var grade = data[name];
    setTheme(grade.bg, grade.accent);
    document.getElementById("grade-title").textContent = name;
    document.getElementById("info-date").textContent = grade.date;
    document.getElementById("info-time").textContent = grade.time;
    document.getElementById("info-place").textContent = grade.place;
    renderProgram(grade.talks);
  }

  function route() {
    var name = HASH_TO_GRADE[location.hash];
    document.getElementById("home").hidden = !!name;
    document.getElementById("detail").hidden = !name;
    if (name) renderDetail(name);
    else renderHome();
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", route);
  route();
  loadSheet().then(function () {
    loaded = true;
    var name = HASH_TO_GRADE[location.hash];
    if (name) renderDetail(name);
    else renderHome();
  });
})();
