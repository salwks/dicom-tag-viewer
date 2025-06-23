export function copyToClipboard(value) {
  if (!navigator.clipboard) {
    alert("복사를 지원하지 않는 브라우저입니다.");
    return;
  }
  navigator.clipboard.writeText(value)
    .then(() => alert("UID가 클립보드에 복사되었습니다."))
    .catch(err => {
      console.error("복사 실패:", err);
      alert("복사에 실패했습니다.");
    });
}