// src/bizcardSettings.js

export function initBizcardSettings() {
    const pageTitle = document.getElementById('pageTitle');
    const surveyNameDisplay = document.getElementById('surveyNameDisplay');
    const surveyIdDisplay = document.getElementById('surveyIdDisplay');
    const surveyPeriodDisplay = document.getElementById('surveyPeriodDisplay');
    const bizcardEnabledToggle = document.getElementById('bizcardEnabledToggle');
    const bizcardEnabledStatus = document.getElementById('bizcardEnabledStatus');
    const bizcardSettingsFields = document.getElementById('bizcardSettingsFields');
    const bizcardRequestInput = document.getElementById('bizcardRequest');
    const dataConversionPlanSelection = document.getElementById('dataConversionPlanSelection');
    const dataConversionSpeedSelection = document.getElementById('dataConversionSpeedSelection');
    const expectedCasesInput = document.getElementById('expectedCases');
    const couponCodeInput = document.getElementById('couponCode');
    const applyCouponBtn = document.getElementById('applyCouponBtn');
    const couponMessage = document.getElementById('couponMessage');
    const estimatedAmountSpan = document.getElementById('estimatedAmount');
    const estimatedCompletionDateSpan = document.getElementById('estimatedCompletionDate');
    const saveButton = document.getElementById('saveBizcardSettingsBtn');
    const cancelButton = document.getElementById('cancelBizcardSettings');
    const toggleMemoSectionBtn = document.getElementById('toggleMemoSection');
    const memoSection = document.getElementById('memoSection');

    let appliedCoupon = null;

    const urlParams = new URLSearchParams(window.location.search);
    const surveyId = urlParams.get('surveyId');

    if (surveyId) {
        const mockSurveyData = {
            surveyName: `アンケート ${surveyId}`,
            periodStart: '2025-07-01',
            periodEnd: '2025-07-31',
        };
        const mockBizcardSettings = {
            bizcardEnabled: 'true',
            bizcardRequest: 100,
            dataConversionPlan: 'standard',
            dataConversionSpeed: 'normal',
            expectedCases: 100,
            couponCode: ''
        };

        pageTitle.textContent = `アンケート『${mockSurveyData.surveyName}』の名刺データ化設定`;
        surveyNameDisplay.textContent = mockSurveyData.surveyName;
        surveyIdDisplay.textContent = surveyId;
        surveyPeriodDisplay.textContent = `${mockSurveyData.periodStart} - ${mockSurveyData.periodEnd}`;

        bizcardEnabledToggle.checked = mockBizcardSettings.bizcardEnabled === 'true';
        bizcardRequestInput.value = mockBizcardSettings.bizcardRequest;
        dataConversionPlanSelection.querySelector(`input[value="${mockBizcardSettings.dataConversionPlan}"]`).checked = true;
        dataConversionSpeedSelection.querySelector(`input[value="${mockBizcardSettings.dataConversionSpeed}"]`).checked = true;
        expectedCasesInput.value = mockBizcardSettings.expectedCases;
        couponCodeInput.value = mockBizcardSettings.couponCode;

        updateUI();
    } else {
        pageTitle.textContent = 'アンケート『不明なアンケート』の名刺データ化設定';
        surveyNameDisplay.textContent = '不明なアンケート';
        surveyIdDisplay.textContent = 'N/A';
        surveyPeriodDisplay.textContent = 'N/A';
    }

    bizcardEnabledToggle.addEventListener('change', updateUI);
    bizcardRequestInput.addEventListener('input', updateUI);
    dataConversionPlanSelection.addEventListener('change', updateUI);
    dataConversionSpeedSelection.addEventListener('change', updateUI);
    applyCouponBtn.addEventListener('click', applyCoupon);

    toggleMemoSectionBtn.addEventListener('click', () => {
        memoSection.classList.toggle('hidden');
        const icon = toggleMemoSectionBtn.querySelector('.material-icons');
        icon.classList.toggle('rotate-180');
    });

    function updateUI() {
        updateBizcardSettingsVisibility();
        updateEstimatedAmount();
        validateInputs();
    }

    function updateBizcardSettingsVisibility() {
        const isEnabled = bizcardEnabledToggle.checked;
        bizcardSettingsFields.style.display = isEnabled ? '' : 'none';
        bizcardEnabledStatus.textContent = isEnabled ? '有効' : '無効';
    }

    function applyCoupon() {
        const code = couponCodeInput.value.trim();
        couponMessage.textContent = '';
        appliedCoupon = null;

        if (!code) {
            couponMessage.textContent = 'クーポンコードを入力してください。';
            couponMessage.className = 'text-sm -mt-4 text-error';
            return;
        }

        // ダミーのクーポン検証
        if (code === 'SAVE10') {
            appliedCoupon = { code: 'SAVE10', discount: 1000 };
            couponMessage.textContent = `クーポン「SAVE10」が適用されました (-¥1,000)。`;
            couponMessage.className = 'text-sm -mt-4 text-secondary';
        } else if (code === 'SPEEDUP') {
            appliedCoupon = { code: 'SPEEDUP', speedBoost: 1 };
            couponMessage.textContent = `クーポン「SPEEDUP」が適用されました (納期短縮)。`;
            couponMessage.className = 'text-sm -mt-4 text-secondary';
        } else {
            couponMessage.textContent = '無効なクーポンコードです。';
            couponMessage.className = 'text-sm -mt-4 text-error';
        }
        updateEstimatedAmount();
    }

    function updateEstimatedAmount() {
        let amount = 0;
        let completionDays = 3; 

        if (bizcardEnabledToggle.checked) {
            amount += parseInt(bizcardRequestInput.value || 0) * 10;

            const selectedPlan = dataConversionPlanSelection.querySelector('input[name="dataConversionPlan"]:checked').value;
            switch (selectedPlan) {
                case 'standard': amount += 500; break;
                case 'premium': amount += 1000; break;
            }

            const selectedSpeed = dataConversionSpeedSelection.querySelector('input[name="dataConversionSpeed"]:checked').value;
            switch (selectedSpeed) {
                case 'express': completionDays = 1; break;
                case 'superExpress': completionDays = 0.5; break;
                case 'onDemand': completionDays = 0.1; break;
            }
            amount += parseInt(expectedCasesInput.value || 0) * 5;
        }

        if (appliedCoupon) {
            if (appliedCoupon.discount) {
                amount = Math.max(0, amount - appliedCoupon.discount);
            }
            if (appliedCoupon.speedBoost) {
                completionDays = Math.max(0.1, completionDays - appliedCoupon.speedBoost);
            }
        }

        estimatedAmountSpan.textContent = `¥${amount.toLocaleString()}`;

        if (bizcardEnabledToggle.checked) {
            const today = new Date();
            const completionDate = new Date(today.setDate(today.getDate() + completionDays));
            estimatedCompletionDateSpan.textContent = completionDate.toLocaleDateString('ja-JP');
        } else {
            estimatedCompletionDateSpan.textContent = '未定';
        }
    }

    function validateInputs() {
        let isValid = true;
        if (bizcardEnabledToggle.checked) {
            const requestInput = bizcardRequestInput;
            const value = parseInt(requestInput.value || 0, 10);
            const errorEl = requestInput.parentElement.querySelector('.input-error-message');

            if (value <= 0) {
                errorEl.textContent = '依頼枚数は1以上の数値を入力してください。';
                requestInput.classList.add('border-error');
                isValid = false;
            } else {
                errorEl.textContent = '';
                requestInput.classList.remove('border-error');
            }
        } else {
            // 名刺データ化が無効の場合は、エラーをクリア
            const requestInput = bizcardRequestInput;
            const errorEl = requestInput.parentElement.querySelector('.input-error-message');
            errorEl.textContent = '';
            requestInput.classList.remove('border-error');
        }
        saveButton.disabled = !isValid;
        return isValid; // 保存時に利用するため戻り値を追加
    }

    saveButton.addEventListener('click', async () => {
        if (!validateInputs()) {
            showToast('入力内容にエラーがあります。ご確認ください。', 'error');
            return;
        }

        saveButton.disabled = true;
        const originalButtonText = saveButton.textContent;
        saveButton.textContent = '保存中...';

        try {
            const settings = {
                surveyId: surveyId,
                bizcardEnabled: bizcardEnabledToggle.checked,
                bizcardRequest: parseInt(bizcardRequestInput.value || 0),
                dataConversionPlan: dataConversionPlanSelection.querySelector('input[name="dataConversionPlan"]:checked').value,
                dataConversionSpeed: dataConversionSpeedSelection.querySelector('input[name="dataConversionSpeed"]:checked').value,
                expectedCases: parseInt(expectedCasesInput.value || 0),
                couponCode: appliedCoupon ? appliedCoupon.code : null
            };
            console.log('設定を保存:', settings);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // トースト通知の表示
            showToast('名刺データ化設定を保存し、依頼を確定しました！', 'success');

            // 画面遷移
            setTimeout(() => {
                window.location.href = `index.html`;
            }, 1000); // トースト表示の後に遷移

        } catch (error) {
            console.error('設定保存エラー:', error);
            showToast('設定の保存に失敗しました。再度お試しください。', 'error');
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = originalButtonText;
        }
    });

    cancelButton.addEventListener('click', () => {
        if (confirm('変更を破棄して戻りますか？')) {
            window.location.href = `index.html`;
        }
    });

    // 初期化
    updateUI();
}