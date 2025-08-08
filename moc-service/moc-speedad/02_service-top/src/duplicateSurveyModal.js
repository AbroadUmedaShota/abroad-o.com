import { handleOpenModal, closeModal } from './modalHandler.js';
import { duplicateSurvey } from './tableManager.js';

/**
 * Opens the duplicate survey modal and populates it with initial data.
 * @param {object} survey The survey object to be duplicated.
 */
export async function openDuplicateSurveyModal(survey) {
    await handleOpenModal('duplicateSurveyModal', 'modals/duplicateSurveyModal.html');

    const newSurveyNameInput = document.getElementById('newSurveyName');
    const newPeriodStartInput = document.getElementById('newPeriodStart');
    const newPeriodEndInput = document.getElementById('newPeriodEnd');
    const confirmBtn = document.getElementById('duplicateSurveyConfirmBtn');

    // Set initial values
    if (newSurveyNameInput) newSurveyNameInput.value = `${survey.name}のコピー`;

    // Set default start date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = tomorrow.toISOString().split('T')[0];
    if (newPeriodStartInput) newPeriodStartInput.value = tomorrowString;

    // Set default end date to tomorrow as well
    if (newPeriodEndInput) newPeriodEndInput.value = tomorrowString;

    // Remove any existing event listeners to prevent duplicates
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener('click', () => {
        const newName = newSurveyNameInput ? newSurveyNameInput.value : '';
        const newStart = newPeriodStartInput ? newPeriodStartInput.value : '';
        const newEnd = newPeriodEndInput ? newPeriodEndInput.value : '';

        // Basic validation
        if (!newName || !newStart || !newEnd) {
            alert('全てのフィールドを入力してください。'); // Replace with a more user-friendly toast later
            return;
        }

        duplicateSurvey(survey.id, newName, newStart, newEnd);
        closeModal('duplicateSurveyModal');
    });
}