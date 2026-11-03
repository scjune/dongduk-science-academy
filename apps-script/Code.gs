// 비공개 '참석 확인' 시트의 Apps Script에 붙여 넣어 웹 앱으로 배포합니다.
// 초대장의 참석 여부 양식이 보낸 내용을 학년별 탭에 한 줄씩 추가합니다.

// 웹 앱에서는 getActiveSpreadsheet()가 시트를 찾지 못하므로 ID로 엽니다.
var SHEET_ID = "1Ya3ICccYZyGlkXEp3FMfmyZ6sk811wbuDvfWVFqFQZA";
var GRADES = ["1학년", "2학년"];
var MAX_COUNT = 4;
var MAX_NAME_LENGTH = 20;

function reply(result) {
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// 수식으로 해석될 수 있는 입력은 글자로 저장합니다.
function asPlainText(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

// 탭 이름이 바뀌어도 응답을 잃지 않도록, 학년 탭이 없으면 새로 만듭니다.
function gradeSheet(grade) {
  var book = SpreadsheetApp.openById(SHEET_ID);
  var sheet = book.getSheetByName(grade);
  if (!sheet) {
    sheet = book.insertSheet(grade);
    sheet.appendRow(["제출 시각", "참석 여부", "자녀 이름", "참석 인원"]);
  }
  return sheet;
}

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ ok: false, error: "invalid body" });
  }

  // 사람에게 보이지 않는 칸이 채워져 있으면 자동 입력으로 보고 저장하지 않습니다.
  if (data.website) return reply({ ok: true });

  var attending = data.attend === "참석";
  var child = String(data.child || "").trim();
  var count = Number(data.count);
  if (GRADES.indexOf(data.grade) === -1) return reply({ ok: false, error: "invalid grade" });
  if (!attending && data.attend !== "불참") return reply({ ok: false, error: "invalid attend" });
  if (!child || child.length > MAX_NAME_LENGTH) return reply({ ok: false, error: "invalid child" });
  if (attending && !(count >= 1 && count <= MAX_COUNT && Math.floor(count) === count)) {
    return reply({ ok: false, error: "invalid count" });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    gradeSheet(data.grade).appendRow([
      Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss"),
      data.attend,
      asPlainText(child),
      attending ? count : ""
    ]);
  } catch (err) {
    console.error(err);
    return reply({ ok: false, error: "save failed" });
  } finally {
    lock.releaseLock();
  }
  return reply({ ok: true });
}
