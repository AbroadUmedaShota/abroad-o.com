import { handleOpenModal, closeModal } from './modalHandler.js';

/**
 * Displays a confirmation modal and executes a callback on confirmation.
 * @param {string} message The message to display in the modal.
 * @param {function} onConfirm The callback function to execute if the user confirms.
 * @param {string} [title='確認'] The title of the modal.
 */
export function showConfirmationModal(message, onConfirm, title = '確認') {
    handleOpenModal('confirmationModal', 'modals/confirmationModal.html')
        .then(() => {
            const titleEl = document.getElementById('confirmationModalTitle');
            const messageEl = document.getElementById('confirmationModalMessage');
            const confirmBtn = document.getElementById('confirmationModalConfirmBtn');
            const cancelBtn = document.getElementById('confirmationModalCancelBtn');

            if (titleEl) titleEl.textContent = title;
            if (messageEl) messageEl.textContent = message;

            // Clone and replace the confirm button to remove old event listeners
            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

            const confirmAndClose = () => {
                onConfirm();
                closeModal('confirmationModal');
            };

            newConfirmBtn.addEventListener('click', confirmAndClose);

            // Also handle Enter key for confirmation
            const handleEnter = (event) => {
                if (event.key === 'Enter') {
                    confirmAndClose();
                    document.removeEventListener('keydown', handleEnter);
                }
            };
            document.addEventListener('keydown', handleEnter);

            // Ensure keydown listener is removed when modal is closed by other means
            const modal = document.getElementById('confirmationModal');
            const observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    if (mutation.attributeName === 'data-state' && modal.dataset.state === 'closed') {
                        document.removeEventListener('keydown', handleEnter);
                        observer.disconnect();
                    }
                });
            });
            observer.observe(modal, { attributes: true });

        })
        .catch(error => console.error('Error opening confirmation modal:', error));
}