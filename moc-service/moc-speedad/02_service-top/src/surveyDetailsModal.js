import { showToast } from './utils.js';
import { openDownloadModal } from './downloadOptionsModal.js';
import { updateSurveyData } from './tableManager.js'; // tableManagerからインポート

let currentEditingSurvey = null; // 現在編集中のアンケートデータを保持する変数

/**
 * Initializes elements specific to the Survey Details Modal.
 * This is called after the modal's HTML is loaded into the DOM.
 * @param {HTMLElement} modalElement The root element of the modal overlay.
 */
export function setupSurveyDetailsModalListeners(modalElement) {
    if (!modalElement) {
        console.warn("surveyDetailsModal element not provided to setupSurveyDetailsModalListeners.");
        return;
    }

    const editSurveyBtn = modalElement.querySelector('#editSurveyBtn');
    const cancelEditBtn = modalElement.querySelector('#cancelEditBtn');
    const saveSurveyBtn = modalElement.querySelector('#saveSurveyBtn');
    const detailDownloadBtn = modalElement.querySelector('#detailDownloadBtn');
    const deleteSurveyBtn = modalElement.querySelector('#deleteSurveyBtn');
    const goToBizcardSettingsBtn = modalElement.querySelector('#goToBizcardSettingsBtn');
    const goToThankYouEmailSettingsBtn = modalElement.querySelector('#goToThankYouEmailSettingsBtn');

    // Remove existing listeners to prevent duplication
    if (detailDownloadBtn) detailDownloadBtn.removeEventListener('click', handleDetailDownload);
    if (deleteSurveyBtn) deleteSurveyBtn.removeEventListener('click', handleDeleteSurvey);
    if (goToBizcardSettingsBtn) goToBizcardSettingsBtn.removeEventListener('click', handleGoToBizcardSettings);
    if (goToThankYouEmailSettingsBtn) goToThankYouEmailSettingsBtn.removeEventListener('click', handleGoToThankYouEmailSettings);

    // Add new listeners
    if (editSurveyBtn) editSurveyBtn.addEventListener('click', () => {
        if (currentEditingSurvey && currentEditingSurvey.id) {
            window.location.href = `surveyCreation.html?surveyId=${currentEditingSurvey.id}`;
        } else {
            showToast('編集するアンケート情報がありません。', 'error');
        }
    });
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', handleCancelEdit);
    if (saveSurveyBtn) saveSurveyBtn.addEventListener('click', handleSaveSurvey);
    if (detailDownloadBtn) detailDownloadBtn.addEventListener('click', handleDetailDownload);
    if (deleteSurveyBtn) deleteSurveyBtn.addEventListener('click', handleDeleteSurvey);
    if (goToBizcardSettingsBtn) goToBizcardSettingsBtn.addEventListener('click', handleGoToBizcardSettings);
    if (goToThankYouEmailSettingsBtn) goToThankYouEmailSettingsBtn.addEventListener('click', handleGoToThankYouEmailSettings);

    
}

function handleGoToBizcardSettings() {
    if (currentEditingSurvey && currentEditingSurvey.id) {
        window.location.href = `bizcardSettings.html?surveyId=${currentEditingSurvey.id}`;
    } else {
        showToast('アンケート情報がありません。', 'error');
    }
}

function handleGoToThankYouEmailSettings() {
    if (currentEditingSurvey && currentEditingSurvey.id) {
        window.location.href = `thankYouEmailSettings.html?surveyId=${currentEditingSurvey.id}`;
    } else {
        showToast('アンケート情報がありません。', 'error');
    }
}

function handleDeleteSurvey() {
    if (currentEditingSurvey) {
        showToast(`アンケートID: ${currentEditingSurvey.id} を削除します。（実装はここから）`, 'info');
        // 削除処理後、モーダルを閉じるなどの処理が必要
    } else {
        showToast('削除するアンケート情報がありません。', 'error');
    }
}

function handleCancelEdit() {
    // モーダルを閉じる
    const modal = document.getElementById('surveyDetailsModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.dataset.state = 'closed';
    }
}

function handleSaveSurvey() {
    if (!currentEditingSurvey) {
        showToast('保存するアンケート情報がありません。', 'error');
        return;
    }

    const form = document.getElementById('surveyDetailsForm');
    const formData = new FormData(form);
    const updatedData = {};

    for (let [key, value] of formData.entries()) {
        updatedData[key] = value;
    }

    // Boolean and Number conversions
    updatedData.bizcardEnabled = updatedData.bizcardEnabled === 'true';
    // estimatedBillingAmount, answerCount, bizcardRequest, bizcardCompletionCount は編集不可なので、既存の値を維持
    updatedData.estimatedBillingAmount = currentEditingSurvey.estimatedBillingAmount;
    updatedData.answerCount = currentEditingSurvey.answerCount;
    updatedData.bizcardRequest = currentEditingSurvey.bizcardRequest;
    updatedData.bizcardCompletionCount = currentEditingSurvey.bizcardCompletionCount;

    // Merge with existing data to ensure all fields are present
    const newSurveyData = { ...currentEditingSurvey, ...updatedData };

    // Update data in tableManager
    updateSurveyData(newSurveyData);

    showToast('アンケート情報を保存しました！', 'success');
    
}

function handleDetailDownload() {
    if (currentEditingSurvey) {
        openDownloadModal('answer', currentEditingSurvey.periodStart, currentEditingSurvey.periodEnd);
    } else {
        showToast('ダウンロードするアンケート情報がありません。', 'error');
    }
}



/**
 * Populates the survey details modal with data for a given survey object.
 * This is separated from openModal because the modal might be loaded asynchronously.
 * @param {object} survey The survey data object.
 */
export function populateSurveyDetails(survey) {
    currentEditingSurvey = survey; // Store the survey object for editing

    const modal = document.getElementById('surveyDetailsModal');
    if (!modal) return;

    // --- Get All View and Edit Elements ---
    const surveyDetailName = document.getElementById('surveyDetailName');
    const surveyDetailStatusBadge = document.getElementById('surveyDetailStatusBadge');
    
    // View mode elements
    const detail_surveyId_view = document.getElementById('detail_surveyId');
    const detail_plan_view = document.getElementById('detail_plan_view');
    const detail_surveyNameInternal_view = document.getElementById('detail_surveyNameInternal_view');
    const detail_displayTitle_view = document.getElementById('detail_displayTitle_view');
    const detail_surveyMemo_view = document.getElementById('detail_surveyMemo_view');
    const detail_surveyPeriod_view = document.getElementById('detail_surveyPeriod_view');
    const detail_answerCount_view = document.getElementById('detail_answerCount');
    const detail_dataCompletionDate_view = document.getElementById('detail_dataCompletionDate_view');
    const detail_deadline_view = document.getElementById('detail_deadline_view');
    const detail_estimatedBillingAmount_view = document.getElementById('detail_estimatedBillingAmount_view');
    const detail_bizcardEnabled_view = document.getElementById('detail_bizcardEnabled_view');
    const detail_bizcardCompletionCount_view = document.getElementById('detail_bizcardCompletionCount');
    const detail_thankYouEmailSettings_view = document.getElementById('detail_thankYouEmailSettings_view');

    // Edit mode elements (これらはHTMLから削除されたため、参照は不要になる)
    // const detail_plan_edit = document.getElementById('detail_plan');
    // const detail_surveyNameInternal_edit = document.getElementById('detail_surveyNameInternal');
    // const detail_displayTitle_edit = document.getElementById('detail_displayTitle');
    // const detail_surveyMemo_edit = document.getElementById('detail_surveyMemo');
    // const detail_periodStart_edit = document.getElementById('detail_periodStart');
    // const detail_periodEnd_edit = document.getElementById('detail_periodEnd');
    // const detail_bizcardEnabled_edit = document.getElementById('detail_bizcardEnabled');
    // const detail_thankYouEmailSettings_edit = document.getElementById('detail_thankYouEmailSettings');

    // Non-editable fields
    const detail_surveyUrl = document.getElementById('detail_surveyUrl');
    const detail_qrCodeImage = document.getElementById('detail_qrCodeImage');

    // --- Populate View and Edit Fields ---
    // Status Badge
    let statusColorClass = '';
    let displayStatus = survey.status;
    switch (survey.status) {
        case '会期中': statusColorClass = 'bg-green-100 text-green-800'; break;
        case '準備中': case '会期前': displayStatus = '会期前'; statusColorClass = 'bg-yellow-100 text-yellow-800'; break;
        case 'データ化中': case 'アップ待ち': displayStatus = 'データ化中'; statusColorClass = 'bg-blue-100 text-blue-800'; break;
        case 'アップ完了': statusColorClass = 'bg-blue-100 text-blue-800'; break;
        case '期限切れ': case '削除済み': case 'データ化なし': case '終了': displayStatus = '終了'; statusColorClass = 'bg-red-100 text-red-800'; break;
        default: statusColorClass = 'bg-gray-100 text-gray-800'; break;
    }
    surveyDetailName.textContent = survey.name;
    surveyDetailStatusBadge.className = `inline-flex items-center rounded-full text-xs px-2 py-1 ${statusColorClass}`;
    surveyDetailStatusBadge.textContent = displayStatus;

    // Populate view fields
    detail_surveyId_view.textContent = survey.id;
    detail_plan_view.textContent = survey.plan || 'N/A';
    detail_surveyNameInternal_view.textContent = survey.name;
    detail_displayTitle_view.textContent = survey.displayTitle || 'なし';
    detail_surveyMemo_view.textContent = survey.memo || survey.description || 'なし';
    detail_surveyPeriod_view.textContent = `${survey.periodStart} ~ ${survey.periodEnd}`;
    const realtimeAnswersDisplay = survey.realtimeAnswers > 0 ? ` (+${survey.realtimeAnswers})` : '';
    detail_answerCount_view.textContent = `${survey.answerCount}${realtimeAnswersDisplay}`;
    detail_dataCompletionDate_view.textContent = survey.dataCompletionDate || '未定';
    detail_deadline_view.textContent = survey.deadline || 'N/A';
    detail_estimatedBillingAmount_view.textContent = survey.estimatedBillingAmount ? `¥${survey.estimatedBillingAmount.toLocaleString()}` : 'N/A';
    detail_bizcardEnabled_view.textContent = survey.bizcardEnabled ? '利用する' : '利用しない';
    detail_bizcardCompletionCount_view.textContent = survey.bizcardEnabled ? `${survey.bizcardCompletionCount || 0}件` : 'N/A';
    detail_thankYouEmailSettings_view.textContent = survey.thankYouEmailSettings || '設定なし';

    // Populate edit fields (これらはHTMLから削除されたため、コメントアウト)
    // detail_plan_edit.value = survey.plan || '';
    // detail_surveyNameInternal_edit.value = survey.name;
    // detail_displayTitle_edit.value = survey.displayTitle || '';
    // detail_surveyMemo_edit.value = survey.memo || survey.description || '';
    // detail_periodStart_edit.value = survey.periodStart;
    // detail_periodEnd_edit.value = survey.periodEnd;
    // detail_bizcardEnabled_edit.value = String(survey.bizcardEnabled); // Convert boolean to string for select
    // detail_thankYouEmailSettings_edit.value = survey.thankYouEmailSettings || '';

    // Non-editable fields
    const qrUrl = `https://survey.speedad.com/qr/${survey.id}`;
    detail_surveyUrl.value = qrUrl;
    detail_qrCodeImage.src = `sample_qr.png`; // survey.id を使って動的に生成

    // --- Reset to View Mode --- 
    

    // 編集ボタンの表示/非表示をステータスに基づいて制御
    const editSurveyBtn = modal.querySelector('#editSurveyBtn');
    if (editSurveyBtn) {
        if (survey.status === '会期前') {
            editSurveyBtn.classList.remove('hidden');
        } else {
            editSurveyBtn.classList.add('hidden');
        }
    }
};
