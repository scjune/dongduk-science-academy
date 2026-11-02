// 비공개 '참석 확인' 시트의 Apps Script에 붙여 넣어 웹 앱으로 배포합니다.
// 초대장의 참석 여부 양식이 보낸 내용을 첫 번째 탭에 한 줄씩 추가합니다.

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
  if (attending && (!child || child.length > MAX_NAME_LENGTH)) return reply({ ok: false, error: "invalid child" });
  if (attending && !(count >= 1 && count <= MAX_COUNT && Math.floor(count) === count)) {
    return reply({ ok: false, error: "invalid count" });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    SpreadsheetApp.getActiveSpreadsheet().getSheets()[0].appendRow([
      new Date(),
      data.grade,
      data.attend,
      attending ? asPlainText(child) : "",
      attending ? count : ""
    ]);
  } finally {
    lock.releaseLock();
  }
  return reply({ ok: true });
}
