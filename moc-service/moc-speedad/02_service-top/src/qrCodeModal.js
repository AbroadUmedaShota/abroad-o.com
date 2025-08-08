import { showToast, downloadFile } from './utils.js';

/**
 * Initializes elements specific to the QR Code Modal.
 * This is called after the modal's HTML is loaded into the DOM.
 * @param {HTMLElement} modalElement The root element of the modal overlay.
 */
export function setupQrCodeModalListeners(modalElement) {
    if (!modalElement) {
        console.warn("qrCodeModal element not provided to setupQrCodeModalListeners.");
        return;
    }

    const downloadQrCodeBtn = modalElement.querySelector('#downloadQrCodeBtn');
    const qrCodeImage = modalElement.querySelector('#qrCodeImage');
    const surveyUrlInput = modalElement.querySelector('#surveyUrl');

    // Remove existing listeners to prevent duplication
    if (downloadQrCodeBtn) downloadQrCodeBtn.removeEventListener('click', handleDownloadQrCode);

    // Add new listeners
    if (downloadQrCodeBtn) downloadQrCodeBtn.addEventListener('click', handleDownloadQrCode);

    // Populate with dummy data for now
    // In a real application, this would be populated dynamically based on the selected survey
    surveyUrlInput.value = `https://survey.speedad.com/qr/dummy_survey_id`;
    qrCodeImage.src = `sample_qr.png`; // Assuming sample_qr.png is in the same directory as index.html
}

function handleDownloadQrCode() {
    const qrCodeImage = document.getElementById('qrCodeImage');
    if (qrCodeImage && qrCodeImage.src) {
        const imageUrl = qrCodeImage.src;
        const filename = `qr_code_${new Date().getTime()}.png`; // ユニークなファイル名を生成
        downloadFile(imageUrl, filename);
        showToast('QRコードのダウンロードを開始しました。', 'success');
    } else {
        showToast('QRコード画像が見つかりません。', 'error');
    }
}
