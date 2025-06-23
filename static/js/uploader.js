let uploadedFile = null;

export function initUploader() {
  const fileInput = document.getElementById("dicomFile");
  const btnSelect = document.getElementById("btnSelect");
  const btnUpload = document.getElementById("btnUpload");
  const fileNameDisplay = document.getElementById("selectedFileName");
  const loader = document.getElementById("loader");

  btnSelect.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    uploadedFile = fileInput.files[0];
    fileNameDisplay.textContent = uploadedFile?.name || "";

    // 파일 선택 시 업로드 버튼 활성화
    if (uploadedFile) {
      btnUpload.disabled = false;
      btnUpload.classList.remove("opacity-50", "cursor-not-allowed");
    }
  });

  btnUpload.addEventListener("click", async () => {
    if (!uploadedFile) {
      alert("파일을 먼저 선택하세요.");
      return;
    }

    // UI 상태 변경
    loader.classList.remove("hidden");
    btnUpload.disabled = true;
    btnUpload.classList.add("opacity-50", "cursor-not-allowed");
    btnUpload.textContent = "업로드 중...";

    // 버튼들 비활성화
    const buttons = ["btnChart", "btnTable", "btnViewer"];
    buttons.forEach((id) => {
      const btn = document.getElementById(id);
      btn.disabled = true;
      btn.classList.add("opacity-50", "cursor-not-allowed");
    });

    const formData = new FormData();
    formData.append("file", uploadedFile);

    try {
      const response = await fetch("/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // 데이터 저장
      window.dicomData = data.dicom_data;
      window.previewFile = uploadedFile;

      // 성공 메시지 표시
      showSuccessMessage("업로드 완료!");

      // 자동으로 구조 보기 탭으로 전환
      setTimeout(() => {
        showChart();
      }, 500);
    } catch (err) {
      console.error("Upload error:", err);
      showErrorMessage(`업로드 실패: ${err.message}`);
    } finally {
      // UI 복원
      loader.classList.add("hidden");
      btnUpload.disabled = false;
      btnUpload.classList.remove("opacity-50", "cursor-not-allowed");
      btnUpload.textContent = "업로드";

      // 버튼들 활성화
      const buttons = ["btnChart", "btnTable", "btnViewer"];
      buttons.forEach((id) => {
        const btn = document.getElementById(id);
        btn.disabled = false;
        btn.classList.remove("opacity-50", "cursor-not-allowed");
      });
    }
  });
}

// 성공/에러 메시지 표시 함수들
function showSuccessMessage(message) {
  showToast(message, "success");
}

function showErrorMessage(message) {
  showToast(message, "error");
}

function showToast(message, type = "info") {
  // 기존 토스트 제거
  const existingToast = document.querySelector(".toast-message");
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement("div");
  toast.className = `toast-message fixed top-20 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full`;

  // 타입에 따른 스타일 적용
  const styles = {
    success: "bg-green-500 text-white",
    error: "bg-red-500 text-white",
    info: "bg-blue-500 text-white",
  };

  toast.classList.add(...styles[type].split(" "));
  toast.innerHTML = `
    <div class="flex items-center">
      <span class="mr-2">
        ${type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️"}
      </span>
      <span>${message}</span>
    </div>
  `;

  document.body.appendChild(toast);

  // 애니메이션으로 표시
  setTimeout(() => {
    toast.classList.remove("translate-x-full");
  }, 100);

  // 3초 후 자동 제거
  setTimeout(() => {
    toast.classList.add("translate-x-full");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

// showChart 함수를 import하기 위해 동적 import 사용
async function showChart() {
  try {
    const { showChart } = await import("./uiController.js");
    showChart();
  } catch (err) {
    console.error("Failed to load chart:", err);
  }
}
