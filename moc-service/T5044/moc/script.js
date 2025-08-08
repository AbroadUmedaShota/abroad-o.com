document.addEventListener('DOMContentLoaded', () => {

    // --- 定数 ---
    const TOOL_PEN = 'pen';
    const TOOL_ERASER = 'eraser';
    const DEFAULT_COLOR = '#000000';
    const ERASER_RADIUS_MULTIPLIER = 2.5;
    const STORAGE_KEY = 'thk_followup_form_data'; // localStorageのキー
    const MAX_IMAGE_SIZE = 1 * 1024 * 1024; // 1MB (最大画像サイズ)
    const IMAGE_QUALITY = 0.7; // 圧縮品質 (0.0 ~ 1.0)

    // --- モーダル関連 (要素取得) ---
    const errorModal = document.getElementById('error-modal');
    const confirmModal = document.getElementById('confirm-modal');
    const progressModal = document.getElementById('progress-modal');
    const completeModal = document.getElementById('complete-modal');

    const closeErrorModalButton = document.getElementById('close-error-modal');
    const closeConfirmModalButton = document.getElementById('close-confirm-modal');
    const closeCompleteModalButton = document.getElementById('close-complete-modal');

    const errorModalMessage = document.getElementById('error-modal-message');
    const confirmModalMessage = document.getElementById('confirm-modal-message');
    const progressModalMessage = document.getElementById('progress-modal-message');
    const completeModalMessage = document.getElementById('complete-modal-message');

    const missingItemsList = document.getElementById('error-missing-items-list');
    const progressBar = document.getElementById('progress-bar');
    const progressPercentage = document.getElementById('progress-percentage');

    const confirmYesButton = document.getElementById('confirm-yes');
    const confirmNoButton = document.getElementById('confirm-no');
    const restartFormButton = document.getElementById('restart-form');

    // --- モーダル表示/非表示関数 ---
     function showErrorModal(message, missingItems = []) {
        errorModalMessage.textContent = message;
        missingItemsList.innerHTML = '';
        if (missingItems.length > 0) {
            missingItems.forEach(item => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `<a href="#${item.headerId}">${item.message}</a>`;
                missingItemsList.appendChild(listItem);
            });
        }
        errorModal.style.display = 'block';
    }
    function showConfirmModal(message) {
        confirmModalMessage.textContent = message;
        confirmModal.style.display = 'block';
    }
    function showProgressModal(message = "送信中...") {
        progressModalMessage.textContent = message;
        progressModal.style.display = 'block';
    }
    function showCompleteModal(message) {
        completeModalMessage.textContent = message;
        completeModal.style.display = 'block';
    }
    function hideModal(modal) {
        modal.style.display = 'none';
    }

    // --- モーダル イベントリスナー ---
    closeErrorModalButton.addEventListener('click', () => hideModal(errorModal));
    closeConfirmModalButton.addEventListener('click', () => hideModal(confirmModal));
    closeCompleteModalButton.addEventListener('click', () => hideModal(completeModal));
    window.addEventListener('click', (event) => {
        if (event.target === errorModal) hideModal(errorModal);
        if (event.target === confirmModal) hideModal(confirmModal);
        if (event.target === completeModal) hideModal(completeModal);
    });

    // --- アコーディオン ---
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            const content = item.querySelector('.accordion-content');
            content.classList.toggle('collapsed');
        });
    });

    // --- Q.10 お絵かきツール ---
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const toolbar = document.querySelector('.toolbar');
    const penTool = document.getElementById('pen-tool');
    const eraserTool = document.getElementById('eraser-tool');
    const lineWidthSelect = document.getElementById('line-width');
    const colorPicker = document.getElementById('color-picker');
    const undoButton = document.getElementById('undo-button');
    const redoButton = document.getElementById('redo-button');
    const clearButton = document.getElementById('clear-button');
    const drawingDataInput = document.getElementById('drawing-data');

    let isDrawing = false;
    let currentTool = TOOL_PEN;
    let lineWidth = 3;
    let eraserRadius = lineWidth * ERASER_RADIUS_MULTIPLIER;
    let color = DEFAULT_COLOR;
    let undoStack = [];
    let redoStack = [];
    let lastX, lastY;
    let initialImageData;
    let isErasing = false;

    function resizeCanvas() {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        canvas.width = canvas.parentElement.offsetWidth;
        canvas.height = canvas.parentElement.offsetHeight;
        ctx.putImageData(imageData, 0, 0);
        setDrawingStyle();
    }
    function setDrawingStyle() {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = color;
    }
    function setEraserStyle() {
        eraserRadius = lineWidth * ERASER_RADIUS_MULTIPLIER;
    }
    function saveImageData() {
        undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    }
    function restoreImageData(imageData) {
        ctx.putImageData(imageData, 0, 0);
    }
    function onToolbarClick(event) {
        if (event.target.id === 'pen-tool') {
            selectTool(TOOL_PEN);
        } else if (event.target.id === 'eraser-tool') {
            selectTool(TOOL_ERASER);
        } else if (event.target.id === 'undo-button') {
            undo();
        } else if (event.target.id === 'redo-button') {
            redo();
        } else if (event.target.id === 'clear-button') {
            clearCanvas();
        }
    }
    function selectTool(tool) {
        currentTool = tool;
        penTool.classList.toggle('active', tool === TOOL_PEN);
        eraserTool.classList.toggle('active', tool === TOOL_ERASER);
        isErasing = (tool === TOOL_ERASER);
        if (isErasing) {
            setEraserStyle();
        }
    }
    function onLineWidthChange() {
        lineWidth = parseInt(lineWidthSelect.value);
        setDrawingStyle();
        setEraserStyle();
    }
    function onColorChange() {
        color = colorPicker.value;
        setDrawingStyle();
    }
    function startDrawing(event) {
        isDrawing = true;
        saveImageData();
        redoStack = [];
        const [x, y] = getCoordinates(event);
        lastX = x;
        lastY = y;
         if (isErasing) {
          drawEraser(x, y);
        } else {
          draw(event);
        }
    }
    function drawLine(x, y) {
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = currentTool === TOOL_ERASER ? 'white' : color;
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
    }
     function drawEraser(x, y) {
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(x, y, eraserRadius, 0, 2 * Math.PI);
        ctx.fill();
    }
    function draw(event) {
        if (!isDrawing) return;
        if (event.touches) {
            event.preventDefault();
        }
        const [x, y] = getCoordinates(event);
        ctx.globalCompositeOperation = isErasing ? 'destination-out' : 'source-over';
        if (isErasing) {
            drawEraser(x, y);
        } else {
            drawLine(x, y);
        }
        lastX = x;
        lastY = y;
    }
    function drawingLoop(event) {
        if (!isDrawing) return;
        requestAnimationFrame(() => draw(event));
    }
    function stopDrawing() {
        isDrawing = false;
    }
    function getCoordinates(event) {
        const rect = canvas.getBoundingClientRect();
        return event.touches ? [
            event.touches[0].clientX - rect.left,
            event.touches[0].clientY - rect.top
        ] : [
            event.clientX - rect.left,
            event.clientY - rect.top
        ];
    }
    function undo() {
        if (undoStack.length > 0) {
            redoStack.push(undoStack.pop());
            restoreImageData(undoStack[undoStack.length - 1] || initialImageData);
        }
    }
    function redo() {
        if (redoStack.length > 0) {
            undoStack.push(redoStack.pop());
            restoreImageData(undoStack[undoStack.length - 1]);
        }
    }
    function clearCanvas() {
        saveImageData();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    function initDrawing() {
        resizeCanvas();
        setDrawingStyle();
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        initialImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        toolbar.addEventListener('click', onToolbarClick);
        lineWidthSelect.addEventListener('change', onLineWidthChange);
        colorPicker.addEventListener('change', onColorChange);
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', drawingLoop);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);
        canvas.addEventListener('touchstart', startDrawing);
        canvas.addEventListener('touchmove', drawingLoop);
        canvas.addEventListener('touchend', stopDrawing);
        window.addEventListener('resize', resizeCanvas);
    }

    // --- Q.03, Q.08, Q.09 関連 ---
    const industryRadios = document.querySelectorAll('input[name="industry"]');
    const industryOtherInput = document.getElementById('industry-other');
    industryRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            industryOtherInput.disabled = (radio.value !== 'その他');
        });
    });
    industryOtherInput.disabled = true;

    const devRequestCheckbox = document.getElementById('dev-request-checkbox');
    const meetingDetailsTextarea = document.getElementById('meeting-details');
    const devReqRequiredSpan = document.querySelector('.dev-req-required');
    function updateRequiredForMeetingDetails() {
        const isDevRequestChecked = devRequestCheckbox.checked;
        meetingDetailsTextarea.required = isDevRequestChecked;
        if (isDevRequestChecked) {
            devReqRequiredSpan.style.display = 'inline';
        } else {
            devReqRequiredSpan.style.display = 'none';
        }
    }
    devRequestCheckbox.addEventListener('change', updateRequiredForMeetingDetails);
    updateRequiredForMeetingDetails();

    // --- バリデーション ---
    function validateForm() {
      let isValid = true;
      const errors = [];
      const requiredElements = document.querySelectorAll('.accordion-item');

      requiredElements.forEach(item => {
          const header = item.querySelector('.accordion-header');
          const headerId = header.id;
          const requiredInputs = item.querySelectorAll('input[required], textarea[required]');
          const questionNumber = header.querySelector('.question-number').innerText;
          const questionTitle = header.innerText.replace(/必須|Q\.\d+/g, '').trim();

          requiredInputs.forEach(input => {
              if (input.type === 'radio') {
                  const radioGroupName = input.name;
                  const checkedRadio = item.querySelector(`input[name="${radioGroupName}"]:checked`);
                  if (!checkedRadio) {
                      isValid = false;
                      errors.push({ element: header, message: `${questionNumber} ${questionTitle}` });
                      // エラー発生時にアコーディオンを開く
                      header.parentElement.querySelector('.accordion-content').classList.remove('collapsed');
                  }
              } else if (!input.value.trim()) {
                  isValid = false;
                  errors.push({ element: header, message: `${questionNumber} ${questionTitle}` });
                  // エラー発生時にアコーディオンを開く
                  header.parentElement.querySelector('.accordion-content').classList.remove('collapsed');
              }
          });

          if (header.querySelector('.required')) {
              const checkboxGroups = item.querySelectorAll('input[type="checkbox"]');
              if (checkboxGroups.length > 0) {
                  const names = new Set();
                  checkboxGroups.forEach(cb => names.add(cb.name));
                  names.forEach(name => {
                    if(name !== "urgency"){
                      if (!validateCheckboxes(name, item)) {
                          isValid = false;
                          errors.push({ element: header, message: `${questionNumber} ${questionTitle}` });
                           // エラー発生時にアコーディオンを開く
                          header.parentElement.querySelector('.accordion-content').classList.remove('collapsed');
                      }
                    }
                  });
              }
          }
      });

      if (!validateQ11()) {
          isValid = false;
          const q11Header = document.getElementById('q11-header');
          errors.push({ element: q11Header, message: 'Q.11 緊急度 (ライン名・装置名または必要時期のいずれかの入力が必要です)' });
          // エラー発生時にアコーディオンを開く
          q11Header.parentElement.querySelector('.accordion-content').classList.remove('collapsed');
      }

      if (errors.length > 0) {
        const missingItems = errors.map(error => ({
          headerId: error.element.id,
          message: error.message,
        }));
        showErrorModal('以下の必須項目が未入力です。', missingItems);
        errors.forEach((error) => {
          error.element.classList.add('required-missing');
            const input = error.element.parentElement.querySelector('input, textarea');
            if(input){
                input.classList.add('required-missing-label');
            }
        });
        isValid = false;
      } else {
          document.querySelectorAll('.accordion-header.required-missing').forEach(header => {
              header.classList.remove('required-missing');
          });
          document.querySelectorAll('.required-missing-label').forEach(el => {
            el.classList.remove('required-missing-label');
          })
      }
      return isValid;
    }
    function validateCheckboxes(name, item) {
        const checkedInGroup = item.querySelector(`input[name="${name}"]:checked`);
        return !!checkedInGroup;
    }
    function validateQ11() {
        const urgencyCheckboxes = document.querySelectorAll('input[name="urgency"]:checked');
        const projectNameInput = document.getElementById('project-name');
        const timingRadio = document.querySelector('input[name="timing"]:checked');
        return !(urgencyCheckboxes.length === 0 && !(projectNameInput.value.trim() || timingRadio));
    }

    // --- 送信処理 (シミュレーション) ---
    function simulateUpload(formData) {
        let progress = 0;
        // 圧縮後のサイズを使う
        const totalBytes = (formData.businessCardFront ? formData.businessCardFront.size : 0) + (formData.businessCardBack ? formData.businessCardBack.size : 0);
        let uploadedBytes = 0;
        const interval = 100;

        showProgressModal();

        const uploadInterval = setInterval(() => {
            if(totalBytes > 0) {
              progress += 5;
              uploadedBytes = Math.min(totalBytes, uploadedBytes + (totalBytes * 0.05));
               progressBar.style.width = `${progress}%`;
               progressPercentage.textContent = `${progress}%`;

               const uploadedKB = Math.floor(uploadedBytes / 1024);
               const totalKB = Math.floor(totalBytes / 1024);
               progressModalMessage.textContent = `${uploadedKB} KB / ${totalKB} KB`;
            }
            if (progress >= 100 || totalBytes === 0) {
                clearInterval(uploadInterval);
                hideModal(progressModal);
                showCompleteModal('アンケートを送信しました。');
            }
        }, interval);
    }

    // --- データ収集 ---
    function collectFormData() {
        const businessCardFrontInput = document.getElementById('business-card-front');
        const businessCardFrontFile = businessCardFrontInput.files[0];
        const businessCardBackInput = document.getElementById('business-card-back');
        const businessCardBackFile = businessCardBackInput.files[0];

        // canvas の内容を Data URL 形式で取得
        const drawingData = canvas.toDataURL();

        const formData = {
            employeeId: document.getElementById('employee-id').value,
            industry: document.querySelector('input[name="industry"]:checked')?.value,
            industryOther: document.getElementById('industry-other').value,
            meetingTypes: Array.from(document.querySelectorAll('input[name="meeting_type"]:checked')).map(checkbox => checkbox.value),
            projectName: document.getElementById('project-name').value,
            timing: document.querySelector('input[name="timing"]:checked')?.value,
            projectInfo: document.querySelector('input[name="project_info"]:checked')?.value,
            devRequest: document.getElementById('dev-request-checkbox').checked,
            meetingDetails: meetingDetailsTextarea.value,
            drawingData: drawingData, // Data URL
            urgency: Array.from(document.querySelectorAll('input[name="urgency"]:checked')).map(checkbox => checkbox.value),
            catalogGeneral: Array.from(document.querySelectorAll('input[name="catalog_general"]:checked')).map(checkbox => checkbox.value),
            catalogSeismic: Array.from(document.querySelectorAll('input[name="catalog_seismic"]:checked')).map(checkbox => checkbox.value),
            catalogExistingEa: Array.from(document.querySelectorAll('input[name="catalog_existing_ea"]:checked')).map(checkbox => checkbox.value),
            catalogRobot: Array.from(document.querySelectorAll('input[name="catalog_robot"]:checked')).map(checkbox => checkbox.value),
            catalogFree: document.getElementById('catalog-free').value,
            businessCardFront: businessCardFrontFile, // Fileオブジェクトのまま
            businessCardBack: businessCardBackFile,   // Fileオブジェクトのまま
        };
        return formData;
    }

   // --- データ保存 (localStorage) ---
    function saveDataToLocalStorage(formData) {
        try {
            const dataToStore = { ...formData }; // formDataをコピー

            // localStorageには、圧縮後のDataURLを保存
            if (dataToStore.businessCardFront) {
                dataToStore.businessCardFront = dataToStore.businessCardFront.compressedDataUrl || null;
            }
            if(dataToStore.businessCardBack){
                dataToStore.businessCardBack = dataToStore.businessCardBack.compressedDataUrl || null;
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
        } catch (e) {
            console.error("Failed to save data to localStorage:", e);
        }
    }

    function loadDataFromLocalStorage() {
      try {
        const storedData = localStorage.getItem(STORAGE_KEY);
        if (storedData) {
            const formData = JSON.parse(storedData);
            // 各入力欄に値を復元
            document.getElementById('employee-id').value = formData.employeeId || "";
            if (formData.industry) {
                const industryRadio = document.querySelector(`input[name="industry"][value="${formData.industry}"]`);
                if (industryRadio) industryRadio.checked = true;
            }
            document.getElementById('industry-other').value = formData.industryOther || "";
            document.getElementById('industry-other').disabled = formData.industry !== 'その他'; //disabled 状態も復元

            document.querySelectorAll('input[name="meeting_type"]').forEach(checkbox => {
                checkbox.checked = formData.meetingTypes.includes(checkbox.value);
            });
            document.getElementById('project-name').value = formData.projectName || "";
            if (formData.timing) {
                const timingRadio = document.querySelector(`input[name="timing"][value="${formData.timing}"]`);
                if (timingRadio) timingRadio.checked = true;
            }
            if (formData.projectInfo) {
                const projectInfoRadio = document.querySelector(`input[name="project_info"][value="${formData.projectInfo}"]`);
                if (projectInfoRadio) projectInfoRadio.checked = true;
            }
            document.getElementById('dev-request-checkbox').checked = formData.devRequest;
            meetingDetailsTextarea.value = formData.meetingDetails || "";
            document.querySelectorAll('input[name="urgency"]').forEach(checkbox => {
                checkbox.checked = formData.urgency.includes(checkbox.value);
            });
            document.querySelectorAll('input[name="catalog_general"]').forEach(checkbox => {
                checkbox.checked = formData.catalogGeneral.includes(checkbox.value);
            });
            document.querySelectorAll('input[name="catalog_seismic"]').forEach(checkbox => {
                checkbox.checked = formData.catalogSeismic.includes(checkbox.value);
            });
            document.querySelectorAll('input[name="catalog_existing_ea"]').forEach(checkbox => {
                checkbox.checked = formData.catalogExistingEa.includes(checkbox.value);
            });
            document.querySelectorAll('input[name="catalog_robot"]').forEach(checkbox => {
                checkbox.checked = formData.catalogRobot.includes(checkbox.value);
            });

            document.getElementById('catalog-free').value = formData.catalogFree || "";

            // Q.08,Q.09 の制御を更新
            updateRequiredForMeetingDetails();

            // Canvas の復元
            if (formData.drawingData) {
                const img = new Image();
                img.onload = () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height); // 一旦クリア
                    ctx.drawImage(img, 0, 0);
                };
                img.src = formData.drawingData;
            }

            // 名刺画像の復元 (localStorage からは Data URL)
            if (formData.businessCardFront) {
                previewFront.src = formData.businessCardFront;
                previewFront.style.display = 'block';
            }
            if (formData.businessCardBack) {
                previewBack.src = formData.businessCardBack;
                previewBack.style.display = 'block';
            }
        }
    } catch (e) {
        console.error("Failed to load data from localStorage:", e);
    }
}

    // --- データ削除(localStorage) ---
    function clearLocalStorageData() {
         try {
             localStorage.removeItem(STORAGE_KEY);
         } catch (e) {
             console.error("Failed to clear localStorage:", e);
         }
     }

    // --- 送信ボタン クリックイベント ---
    const submitButton = document.getElementById('submit-form');
    submitButton.addEventListener('click', () => {
        if (validateForm()) {
            const formData = collectFormData(); // ここではまだ File オブジェクト
            const hasBusinessCardData = formData.businessCardFront || formData.businessCardBack;
            if(!hasBusinessCardData){
                showConfirmModal('名刺データが添付されていません。このまま送信しますか？');
            } else {
                showConfirmModal('この内容で送信しますか？');
            }
        }
    });

    // --- 確認モーダル ボタンイベント ---
    confirmYesButton.addEventListener('click', () => {
        hideModal(confirmModal);
        const formData = collectFormData(); // Fileオブジェクトのまま
        // 画像圧縮処理 (Promiseを使う)
        Promise.all([
            compressImage(formData.businessCardFront),
            compressImage(formData.businessCardBack)
        ]).then(([compressedFront, compressedBack]) => {
            // 圧縮後のデータでformDataを更新
            formData.businessCardFront = compressedFront;
            formData.businessCardBack = compressedBack;

            simulateUpload(formData); // 送信(ここではシミュレーション)
            clearLocalStorageData();   // 送信後、ローカルストレージのデータをクリア
            clearIndexedDBData(); //オフライン用のデータも削除
        });
    });
    confirmNoButton.addEventListener('click', () => {
        hideModal(confirmModal);
    });

    // --- 再回答ボタン クリックイベント ---
    restartFormButton.addEventListener('click', () => {
        // 各要素を個別に初期化
        document.getElementById('employee-id').value = "";
        const radioInputs = document.querySelectorAll('input[type="radio"]');
        radioInputs.forEach(input => input.checked = false);
        document.getElementById('industry-other').value = "";
        const checkboxInputs = document.querySelectorAll('input[type="checkbox"]');
        checkboxInputs.forEach(input => input.checked = false);
        document.getElementById('project-name').value = "";
        meetingDetailsTextarea.value = "";
        document.getElementById('catalog-free').value = "";
        clearCanvas();
        industryOtherInput.disabled = true;
        document.getElementById('preview-front').src = "#";
        document.getElementById('preview-front').style.display = "none";
        document.getElementById('preview-back').src = "#";
        document.getElementById('preview-back').style.display = "none";
        document.getElementById('business-card-front').value = "";
        document.getElementById('business-card-back').value = "";
        hideModal(completeModal);
        clearLocalStorageData(); // localStorageのデータもクリア
        clearIndexedDBData(); //オフライン用のデータも削除
        window.scrollTo(0, 0);
    });

    // --- 名刺画像添付 ---
    const businessCardFrontInput = document.getElementById('business-card-front');
    const businessCardBackInput = document.getElementById('business-card-back');
    const previewFront = document.getElementById('preview-front');
    const previewBack = document.getElementById('preview-back');

    businessCardFrontInput.addEventListener('change', () => {
      const file = businessCardFrontInput.files[0];
      handleImageChange(file, previewFront); // 共通の関数を使用

    });

    businessCardBackInput.addEventListener('change', () => {
        const file = businessCardBackInput.files[0];
        handleImageChange(file, previewBack); // 共通の関数を使用
    });

    // 名刺画像添付時の共通処理
    function handleImageChange(file, previewElement) {
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewElement.src = e.target.result;
                previewElement.style.display = 'block';
            }
            reader.readAsDataURL(file);
        } else {
            previewElement.src = '#';
            previewElement.style.display = 'none';
        }
    }

    // --- 名刺関連 (仮実装) --- (変更なし)
    document.getElementById('manual-input').addEventListener('click', () => {
        showErrorModal('手入力フォームは、別途実装が必要です');
    });

    // --- input, change イベントでデータ保存 ---
    // canvas 以外の input 要素
    document.querySelectorAll('.answer-input, input[type="radio"], input[type="checkbox"], textarea').forEach(input => {
        input.addEventListener('input', () => {
          // input, change イベント時は、圧縮せずに保存
          const formData = collectFormData(); // Fileオブジェクト, DataURLのまま
          saveDataToLocalStorage(formData); // localStorageには圧縮後のDataURLが入る

          // IndexedDB にも保存（オフライン対応）
          saveDataToIndexedDB(formData).catch(error => { // Fileオブジェクト, DataURLのまま
              console.error("Failed to save data to IndexedDB:", error);
              // 必要に応じてユーザーにエラーを通知（例：ストレージ容量不足）
          });
        });
    });

    // --- canvas 専用の保存処理 (imageDataではなくDataURLを使うので、inputイベントでOK) ---
    canvas.addEventListener('mouseup', () => { // mouseup, touchend で保存
        const formData = collectFormData();
        saveDataToLocalStorage(formData);
        saveDataToIndexedDB(formData).catch(error => {
            console.error("Failed to save canvas data to IndexedDB:", error);
        });
    });
     canvas.addEventListener('touchend', () => { // mouseup, touchend で保存
        const formData = collectFormData();
        saveDataToLocalStorage(formData);
        saveDataToIndexedDB(formData).catch(error => {
            console.error("Failed to save canvas data to IndexedDB:", error);
        });
    });

     // --- オフライン/オンライン検知 ---
     function updateOnlineStatus() {
         if (navigator.onLine) {
             console.log("オンライン");
             // submitButton.disabled = false; // 送信ボタンを有効化（必要に応じて）
         } else {
              console.log("オフライン");
              // 必要に応じて、ユーザーにオフラインであることを通知
              showErrorModal('現在オフラインです。入力内容は保存されますが、送信はオンラインになるまで行われません。');
              //submitButton.disabled = true; // 送信ボタンを無効化（必要に応じて）
         }
     }
     window.addEventListener('online',  updateOnlineStatus);
     window.addEventListener('offline', updateOnlineStatus);

    // --- 初期化 ---
    initDrawing();
    updateOnlineStatus();       // オフライン/オンラインの初期状態をチェック
    loadDataFromLocalStorage(); // localStorageからデータを復元

    // --- IndexedDB (オフライン時のデータ保存) --- ここから
    const DB_NAME = 'thk_followup_db';
    const DB_VERSION = 1;
    const STORE_NAME = 'form_data';

    let db;

    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error("IndexedDB error:", event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                resolve(db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    // 必要に応じてインデックスを作成
                }
            };
        });
    }

    // IndexedDBへのデータ保存
    async function saveDataToIndexedDB(formData) {
        if (!db) {
            try {
                await openDatabase();
            } catch (error) {
                console.error("Failed to open IndexedDB:", error);
                return; // db が開けなかった場合は処理を中断
            }
        }
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);

        // 既存のデータを全て削除してから、新しいデータを追加
        const clearRequest = objectStore.clear();
        clearRequest.onsuccess = () => {
          // formDataをコピーしてから、businessCardFront/Backに圧縮後のオブジェクト、またはnullをセット
          const formDataToSave = { ...formData };
          if (formDataToSave.businessCardFront) {
            formDataToSave.businessCardFront = formDataToSave.businessCardFront.compressedFile || formDataToSave.businessCardFront;
          }
          if (formDataToSave.businessCardBack) {
            formDataToSave.businessCardBack = formDataToSave.businessCardBack.compressedFile || formDataToSave.businessCardBack;
          }
          const addRequest = objectStore.add(formDataToSave);

            addRequest.onsuccess = () => {
                console.log("Data saved to IndexedDB");
            };
            addRequest.onerror = (event) => {
                console.error("Failed to save data to IndexedDB:", event.target.error);
                // 必要に応じてユーザーにエラーを通知
            };
        }
        clearRequest.onerror = (event) => {
            console.error("Failed to clear existing data in IndexedDB", event.target.error);
        }
    }

    //IndexedDBからのデータ削除
    async function clearIndexedDBData() {
        if (!db) {
            try {
                await openDatabase();
            } catch (error) {
                console.error("Failed to open IndexedDB:", error);
                return;
            }
        }

        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);

        const request = objectStore.clear();

        request.onsuccess = () => {
            console.log('Data cleared from IndexedDB');
        };

        request.onerror = (event) => {
            console.error('Failed to clear data from IndexedDB:', event.target.error);
        };
    }
    // --- 初期化時、IndexedDBを開く ---
    openDatabase();

    // --- 画像圧縮関数 ---
    function compressImage(file) {
        return new Promise((resolve) => {
            if (!file || file.size <= MAX_IMAGE_SIZE) {
                resolve(file); // 圧縮不要
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // リサイズ処理 (必要に応じて)
                    let width = img.width;
                    let height = img.height;
                    const MAX_WIDTH = 800; // 最大幅 (必要に応じて変更)
                    const MAX_HEIGHT = 600; // 最大高さ (必要に応じて変更)

                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        // 圧縮後のBlobオブジェクトとDataURLをオブジェクトに格納
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        // 圧縮後の Data URL も生成
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          compressedFile.compressedDataUrl = reader.result;
                          resolve(compressedFile); // 圧縮後のFileオブジェクトを返す
                        }
                        reader.readAsDataURL(blob);

                    }, 'image/jpeg', IMAGE_QUALITY); // JPEG形式で圧縮
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
}); // DOMContentLoaded の閉じ括弧