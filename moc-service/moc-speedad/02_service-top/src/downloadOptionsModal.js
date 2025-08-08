import { handleOpenModal } from './modalHandler.js';

let currentSurveyPeriod = { start: '', end: '' }; // Stores survey specific period for date picker limits

/**
 * Initializes elements specific to the Download Options Modal.
 * This is called after the modal's HTML is loaded into the DOM.
 */
function initializeDownloadOptionsModal() {
    const modal = document.getElementById('downloadOptionsModal');
    if (!modal) {
        console.warn("Download Options Modal not found for initialization.");
        return; // Modal not loaded yet
    }

    const periodCustomRadio = modal.querySelector('#period_custom');
    const customPeriodInputs = modal.querySelector('#customPeriodInputs');
    const downloadForm = modal.querySelector('form');

    if (downloadForm && periodCustomRadio && customPeriodInputs) {
        // Ensure listeners are not duplicated if called multiple times
        downloadForm.removeEventListener('change', handleDownloadFormChange); // Remove if already attached
        downloadForm.addEventListener('change', handleDownloadFormChange);
    }
}

function handleDownloadFormChange(event) {
    // Access elements from the document directly, assuming they are now loaded.
    const periodCustomRadio = document.getElementById('period_custom');
    const customPeriodInputs = document.getElementById('customPeriodInputs');

    if (event.target === periodCustomRadio) {
        if (periodCustomRadio.checked) {
            customPeriodInputs.classList.remove('hidden');
            document.getElementById('download_start_date').value = currentSurveyPeriod.start;
            document.getElementById('download_end_date').value = currentSurveyPeriod.end;
        } else {
            customPeriodInputs.classList.add('hidden');
        }
    }
}

/**
 * Opens the download options modal, pre-selects a download type, and sets date limits.
 * @param {string} initialSelection Initial radio button to select ('answer', 'image', 'business_card', 'both').
 * @param {string} periodStart Start date for the survey period (YYYY-MM-DD).
 * @param {string} periodEnd End date for the survey period (YYYY-MM-DD).
 */
export async function openDownloadModal(initialSelection, periodStart = '', periodEnd = '') {
    await handleOpenModal('downloadOptionsModal', 'modals/downloadOptionsModal.html');
    
    // Ensure modal elements are available after loading and opening.
    // It's crucial to call initializeDownloadOptionsModal *after* the modal content is in the DOM.
    initializeDownloadOptionsModal();

    // Reset form to default state
    const periodAllRadio = document.getElementById('period_all');
    const customPeriodInputsEl = document.getElementById('customPeriodInputs');
    if (periodAllRadio) periodAllRadio.checked = true;
    if (customPeriodInputsEl) customPeriodInputsEl.classList.add('hidden');

    // Set initial data type selection
    const initialRadio = document.getElementById(`download_${initialSelection}`);
    if (initialRadio) {
        initialRadio.checked = true;
    } else {
        const defaultAnswerRadio = document.getElementById('download_answer');
        if (defaultAnswerRadio) defaultAnswerRadio.checked = true;
    }

    // Store survey period for custom date selection and set min/max attributes
    currentSurveyPeriod = { start: periodStart, end: periodEnd };
    const downloadStartDateInput = document.getElementById('download_start_date');
    const downloadEndDateInput = document.getElementById('download_end_date');
    if (downloadStartDateInput) {
        downloadStartDateInput.min = periodStart;
        downloadStartDateInput.max = periodEnd;
    }
    if (downloadEndDateInput) {
        downloadEndDateInput.min = periodStart;
        downloadEndDateInput.max = periodEnd;
    }
}
