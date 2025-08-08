import { lockScroll, unlockScroll, showToast } from './utils.js';
import { initializeAccountInfoModalFunctionality, populateAccountInfoModal } from './accountInfoModal.js';
import { setupSurveyDetailsModalListeners, populateSurveyDetails } from './surveyDetailsModal.js';
import { initGroupManagementModal } from './groupManagementModal.js';
import { setupQrCodeModalListeners } from './qrCodeModal.js';

const loadedModals = new Set(); // Keep track of loaded modal IDs

/**
 * Loads a modal's HTML content from a file and appends it to the body.
 * Prevents loading the same modal multiple times.
 * @param {string} modalId The ID of the modal element.
 * @param {string} filePath The path to the modal's HTML file.
 * @returns {Promise<void>} A promise that resolves when the modal is loaded.
 */
async function loadModalFromFile(modalId, filePath) {
    if (loadedModals.has(modalId)) {
        return; // Modal already loaded
    }
    
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Failed to load modal from ${filePath}: HTTP status ${response.status} (${response.statusText})`);
        }
        const modalHtml = await response.text();
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = modalHtml;
        const modalElement = tempDiv.firstElementChild; // Get the root element of the modal

        if (modalElement && modalElement.id === modalId) {
            document.body.appendChild(modalElement);
            loadedModals.add(modalId);
            attachModalEventListeners(modalElement);

            if (modalId === 'accountInfoModal') {
                initializeAccountInfoModalFunctionality(modalElement); 
            }
            if (modalId === 'surveyDetailsModal'){
                setupSurveyDetailsModalListeners(modalElement);
            }
            if (modalId === 'newGroupModal') {
                initGroupManagementModal(modalElement);
            }
            if (modalId === 'qrCodeModal') {
                setupQrCodeModalListeners(modalElement);
            }

        } else {
            console.error(`Error: Modal ID mismatch or invalid HTML structure for ${modalId} from ${filePath}.`);
            showToast(`モーダル (${modalId}) のHTML構造が不正です。`, "error");
        }
    } catch (error) {
        console.error(`Error loading modal ${modalId} from ${filePath}:`, error);
        showToast(`モーダル (${modalId}) の読み込みに失敗しました。ファイルパスを確認してください。`, "error");
        throw error;
    }
}

/**
 * Attaches common event listeners to a modal overlay for closing.
 * @param {HTMLElement} modalElement The root element of the modal overlay.
 */
function attachModalEventListeners(modalElement) {
    modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
            closeModal(modalElement.id);
        }
    });
}

/**
 * Initializes floating label behavior for input fields within a newly loaded modal.
 * This function is now empty as the logic is handled by CSS.
 */
export function initializeFloatingLabelsForModal(containerElement) {
    // This function is now empty as the logic is handled by CSS.
}


/**
 * Handles opening a modal, loading it first if necessary.
 * @param {string} modalId The ID of the modal element to open.
 * @param {string} filePath The path to the modal's HTML file.
 */
export async function handleOpenModal(modalId, filePath) {
    const modal = document.getElementById(modalId);
    if (!modal) {
        try {
            await loadModalFromFile(modalId, filePath);
            openModal(modalId);
        } catch (error) {
            // Error already handled by loadModalFromFile and shown to user.
            // No further action needed here, just prevent opening.
        }
    } else {
        openModal(modalId);
    }
};

/**
 * Opens a modal window.
 * @param {string} modalId The ID of the modal element to open.
 */
export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            modal.dataset.state = 'open';
            modal.querySelector('.modal-content-transition').dataset.state = 'open';
        });
        lockScroll();

        // Specific handler for newSurveyModal to set default dates
        if (modalId === 'newSurveyModal') {
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);

            const surveyStartDateInput = document.getElementById('surveyStartDate');
            const surveyEndDateInput = document.getElementById('surveyEndDate');

            const getFormattedDate = (date) => {
                const year = date.getFullYear();
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const day = date.getDate().toString().padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            if (surveyStartDateInput) {
                surveyStartDateInput.value = getFormattedDate(tomorrow);
            }
            if (surveyEndDateInput) {
                const oneWeekLater = new Date(tomorrow);
                oneWeekLater.setDate(tomorrow.getDate() + 7);
                surveyEndDateInput.value = getFormattedDate(oneWeekLater);
            }
        }
    }
}

/**
 * Closes a modal window.
 * @param {string} modalId The ID of the modal element to close.
 */
export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.dataset.state = 'closed';
        const modalContent = modal.querySelector('.modal-content-transition');
        modalContent.dataset.state = 'closed';

        unlockScroll(); // ここに移動

        modalContent.addEventListener('transitionend', () => {
            modal.classList.add('hidden');
        }, { once: true });
    }
}