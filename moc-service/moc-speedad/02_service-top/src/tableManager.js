import { showConfirmationModal } from './confirmationModal.js';
import { showToast, copyTextToClipboard } from './utils.js';
import { handleOpenModal } from './modalHandler.js';
import { populateSurveyDetails } from './surveyDetailsModal.js';
import { openDownloadModal } from './downloadOptionsModal.js';
import { openDuplicateSurveyModal } from './duplicateSurveyModal.js';

const surveyTableBody = document.getElementById('surveyTableBody');
let allSurveyData = []; // Stores all fetched survey data
let currentGroupId = null; // Stores the currently selected group ID
let currentFilteredData = []; // Data array: holds filtered and sorted data

let currentPage = 1;
let itemsPerPage = 10; // Default, will be updated from select element

const STATUS_SORT_ORDER = {
    '会期前': 1,
    '準備中': 2,
    '会期中': 3,
    'データ化中': 4,
    'アップ待ち': 5,
    'アップ完了': 6,
    'データ化なし': 7,
    '期限切れ': 8,
    '削除済み': 9,
    '終了': 10
};

let lastSortedHeader = null; // Tracks the last header clicked for sorting

/**
 * Fetches survey data from a JSON file.
 * @returns {Promise<Array>} A promise that resolves with an array of survey objects.
 */
export async function fetchSurveyData() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) loadingIndicator.classList.remove('hidden');

    try {
        const response = await fetch('data/surveys.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching survey data:', error);
        showToast("アンケートデータの取得に失敗しました。", "error");
        return [];
    } finally {
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
    }
}

/**
 * Renders table rows based on the provided survey data.
 * @param {Array} surveysToRender The array of survey objects to display.
 */
function renderTableRows(surveysToRender) {
    if (!surveyTableBody) return;

    surveyTableBody.innerHTML = ''; // Clear existing rows

    if (surveysToRender.length === 0) {
        const noResultsRow = document.createElement('tr');
        noResultsRow.innerHTML = `
            <td colspan="6" class="text-center py-8 text-on-surface-variant">
                <p class="text-lg font-medium">該当するアンケートが見つかりませんでした。</p>
                <p class="text-sm mt-2">検索条件を変更するか、新しいアンケートを作成してください。</p>
            </td>
        `;
        surveyTableBody.appendChild(noResultsRow);
        return;
    }

    const fragment = document.createDocumentFragment();

    surveysToRender.forEach(survey => {
        const row = document.createElement('tr');
        row.className = 'cursor-pointer hover:bg-surface-variant transition-colors';
        row.dataset.id = survey.id;
        row.dataset.name = survey.name;
        row.dataset.status = survey.status;
        row.dataset.periodStart = survey.periodStart;
        row.dataset.periodEnd = survey.periodEnd;
        row.dataset.deadline = survey.deadline;
        row.dataset.answerCount = survey.answerCount;
        row.dataset.dataCompletionDate = survey.dataCompletionDate || '';

        let statusColorClass = '';
        let displayStatus = survey.status;
        let statusTitle = '';

        switch (survey.status) {
            case '会期中':
                statusColorClass = 'bg-green-100 text-green-800';
                statusTitle = '現在回答を受け付けている状態';
                break;
            case '準備中':
            case '会期前':
                displayStatus = '会期前';
                statusColorClass = 'bg-yellow-100 text-yellow-800';
                statusTitle = 'まだ回答を受け付けていない状態';
                break;
            case 'データ化中':
            case 'アップ待ち':
                displayStatus = 'データ化中';
                statusColorClass = 'bg-blue-100 text-blue-800';
                statusTitle = '名刺データの入力・照合作業が進行中';
                break;
            case 'アップ完了':
                statusColorClass = 'bg-blue-100 text-blue-800';
                statusTitle = '名刺データがダウンロード可能になり、お礼メールも送信可能';
                break;
            case '期限切れ':
            case '削除済み':
            case 'データ化なし':
            case '終了':
                displayStatus = '終了';
                statusColorClass = 'bg-red-100 text-red-800';
                statusTitle = 'データへのアクセスが制限された重要な状態、または会期終了';
                break;
            default:
                statusColorClass = 'bg-gray-100 text-gray-800';
                statusTitle = '不明なステータス';
                break;
        }

        const realtimeAnswersDisplay = '';

        row.innerHTML = `
            <td data-label="アクション" class="px-4 py-3 whitespace-nowrap actions-cell flex gap-1">
                <button class="bg-secondary-container text-on-secondary-container hover:bg-secondary-container hover:text-on-secondary-container rounded-full p-2 w-9 h-9 transition-all shadow-sm shadow-lg border border-secondary flex items-center justify-center" title="アンケートを編集" aria-label="アンケートを編集"><span class="material-icons text-lg">edit</span></button>
                <button class="bg-secondary-container text-on-secondary-container hover:bg-secondary-container hover:text-on-secondary-container rounded-full p-2 w-9 h-9 transition-all shadow-sm shadow-lg border border-secondary flex items-center justify-center" title="QRコードを表示" aria-label="QRコードを表示"><span class="material-icons text-lg">qr_code_2</span></button>
                <button class="bg-secondary-container text-on-secondary-container hover:bg-secondary-container hover:text-on-secondary-container rounded-full p-2 w-9 h-9 transition-all shadow-sm shadow-lg border border-secondary flex items-center justify-center" title="アンケートを複製" aria-label="アンケートを複製"><span class="material-icons text-lg">content_copy</span></button>
                <button class="bg-secondary-container text-on-secondary-container hover:bg-secondary-container hover:text-on-secondary-container rounded-full p-2 w-9 h-9 transition-all shadow-sm shadow-lg border border-secondary flex items-center justify-center" title="データダウンロード" aria-label="データダウンロード"><span class="material-icons text-lg">download</span></button>
            </td>
            <td data-label="アンケートID" class="px-4 py-3 text-on-surface-variant text-sm font-medium" data-sort-value="${survey.id}">
                ${survey.id}
            </td>
            <td data-label="アンケート名" class="px-4 py-3 text-on-surface text-sm font-medium" data-sort-value="${survey.name}">
                ${survey.name}
            </td>
            <td data-label="ステータス" class="px-4 py-3" data-sort-value="${survey.status}">
                <span class="inline-flex items-center rounded-full text-xs px-2 py-1 ${statusColorClass}" title="${statusTitle}">${displayStatus}</span>
            </td>
            <td data-label="回答数" class="px-4 py-3 text-on-surface-variant text-sm" data-sort-value="${survey.answerCount}">
                ${survey.answerCount} ${realtimeAnswersDisplay}
            </td>
            <td data-label="展示会会期" class="px-4 py-3 text-on-surface-variant text-sm" data-sort-value="${survey.periodStart}">
                ${survey.periodStart} ~ ${survey.periodEnd}
            </td>
        `;

        fragment.appendChild(row);

        row.querySelector('button[title="アンケートを複製"]').addEventListener('click', (e) => {
            e.stopPropagation();
            const surveyToDuplicate = allSurveyData.find(s => s.id === survey.id);
            if (surveyToDuplicate) {
                openDuplicateSurveyModal(surveyToDuplicate);
            }
        });

        row.querySelector('button[title="データダウンロード"]').addEventListener('click', (e) => {
            e.stopPropagation();
            // surveyDetailsModal.js の openDownloadModal を呼び出す
            openDownloadModal('answer', survey.periodStart, survey.periodEnd);
        });

        row.querySelector('button[title="アンケートを編集"]').addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.href = `surveyCreation.html?surveyId=${survey.id}`;
        });

        row.querySelector('button[title="QRコードを表示"]').addEventListener('click', (e) => {
            e.stopPropagation();
            handleOpenModal('qrCodeModal', 'modals/qrCodeModal.html');
        });
        
        row.addEventListener('click', (e) => {
            if (e.target.closest('button')) {
                return;
            }
            handleOpenModal('surveyDetailsModal', 'modals/surveyDetailsModal.html')
                .then(() => {
                    populateSurveyDetails(survey);
                })
                .catch(error => console.error("Failed to open survey details modal:", error));
        });
    });

    surveyTableBody.appendChild(fragment);
}

/**
 * Generates a new unique survey ID.
 * @returns {string} A new survey ID.
 */
function generateNewSurveyId() {
    return 'SURVEY' + Math.random().toString(36).substring(2, 10);
}

/**
 * Duplicates a survey.
 * @param {string} surveyId The ID of the survey to duplicate.
 * @param {string} newName The new name for the duplicated survey.
 * @param {string} newPeriodStart The new start date for the duplicated survey.
 * @param {string} newPeriodEnd The new end date for the duplicated survey.
 */
export function duplicateSurvey(surveyId, newName, newPeriodStart, newPeriodEnd) {
    const surveyToDuplicate = allSurveyData.find(s => s.id === surveyId);
    if (!surveyToDuplicate) {
        showToast('複製対象のアンケートが見つかりません。', 'error');
        return;
    }

    const newSurvey = {
        ...surveyToDuplicate,
        id: generateNewSurveyId(),
        name: newName,
        periodStart: newPeriodStart,
        periodEnd: newPeriodEnd,
        status: '会期前',
        answerCount: 0,
        realtimeAnswers: 0,
        // 必要に応じて他のフィールドもリセット・変更
    };

    // Add the new survey to the main data array
    allSurveyData.unshift(newSurvey); // Add to the beginning of the array

    // Re-apply filters and pagination to show the new survey
    applyFiltersAndPagination();

    showToast(`「${newName}」を複製しました。`, 'success');
}

/** Updates the displayed rows and pagination controls. */
function updatePagination() {
    const totalItems = currentFilteredData.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (currentPage > totalPages && totalPages > 0) {
        currentPage = totalPages;
    } else if (totalPages === 0) {
        currentPage = 0;
    } else if (currentPage === 0 && totalPages > 0) {
        currentPage = 1;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = currentPage * itemsPerPage;
    const surveysForCurrentPage = currentFilteredData.slice(startIndex, endIndex);

    renderTableRows(surveysForCurrentPage);

    // Update Page Info Text
    const pageInfoSpan = document.getElementById('pageInfo');
    if (pageInfoSpan) {
        if (totalItems === 0) {
            pageInfoSpan.textContent = `全 0件`;
        } else {
            pageInfoSpan.textContent = `${Math.min(totalItems, startIndex + 1)} - ${Math.min(totalItems, endIndex)} / 全 ${totalItems}件`;
        }
    }

    // Update Pagination Buttons
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    if (prevPageBtn) prevPageBtn.disabled = (currentPage <= 1);
    if (nextPageBtn) nextPageBtn.disabled = (currentPage >= totalPages || totalPages === 0);

    // Render Pagination Numbers
    const paginationNumbersContainer = document.getElementById('pagination-numbers');
    if (!paginationNumbersContainer) return;

    paginationNumbersContainer.innerHTML = ''; // Clear old numbers
    const fragment = document.createDocumentFragment();

    const createPageButton = (pageNumber, isActive = false, isDisabled = false, text = null) => {
        const button = document.createElement(isDisabled ? 'span' : 'button');
        button.className = `flex items-center justify-center w-8 h-8 rounded-full transition-colors text-sm `;
        if (isActive) {
            button.className += 'bg-primary text-on-primary font-bold';
        } else if (isDisabled) {
            button.className += 'text-on-surface-variant';
        } else {
            button.className += 'bg-secondary-container text-on-secondary-container';
        }
        button.textContent = text || pageNumber;
        if (!isDisabled) {
            button.onclick = () => {
                currentPage = pageNumber;
                updatePagination();
            };
        }
        return button;
    };

    if (totalPages <= 7) { // Show all pages if 7 or less
        for (let i = 1; i <= totalPages; i++) {
            fragment.appendChild(createPageButton(i, i === currentPage));
        }
    } else {
        // Always show first page
        fragment.appendChild(createPageButton(1, 1 === currentPage));

        // Logic for ellipses
        if (currentPage > 4) {
            fragment.appendChild(createPageButton(0, false, true, '...'));
        }

        let startPage = Math.max(2, currentPage - 2);
        let endPage = Math.min(totalPages - 1, currentPage + 2);

        if (currentPage <= 4) {
            startPage = 2;
            endPage = 5;
        }
        if (currentPage >= totalPages - 3) {
            startPage = totalPages - 4;
            endPage = totalPages - 1;
        }

        for (let i = startPage; i <= endPage; i++) {
            fragment.appendChild(createPageButton(i, i === currentPage));
        }

        if (currentPage < totalPages - 3) {
            fragment.appendChild(createPageButton(0, false, true, '...'));
        }

        // Always show last page
        fragment.appendChild(createPageButton(totalPages, totalPages === currentPage));
    }

    paginationNumbersContainer.appendChild(fragment);
}

function isValidDate(date) {
    return date instanceof Date && !isNaN(date.getTime());
}

/** Applies filters to `allSurveyData` and updates `currentFilteredData`. */
export function applyFiltersAndPagination() {
    const searchKeywordInput = document.getElementById('searchKeyword');
    const filterStatusSelect = document.getElementById('filterStatus');
    const filterStartDateInput = document.getElementById('filterStartDate');
    const filterEndDateInput = document.getElementById('filterEndDate');

    const keyword = searchKeywordInput ? searchKeywordInput.value.toLowerCase() : '';
    const status = filterStatusSelect ? filterStatusSelect.value : 'all';
    const startDateInputVal = filterStartDateInput ? filterStartDateInput.value : '';
    const endDateInputVal = filterEndDateInput ? filterEndDateInput.value : '';

    const startDate = startDateInputVal ? new Date(startDateInputVal) : null;
    const endDate = endDateInputVal ? new Date(endDateInputVal) : null;

    currentFilteredData = allSurveyData.filter(survey => {
        const surveyName = survey.name ? survey.name.toLowerCase() : '';
        const surveyStatus = survey.status;
        const surveyPeriodStart = survey.periodStart ? new Date(survey.periodStart) : null;
        const surveyPeriodEnd = survey.periodEnd ? new Date(survey.periodEnd) : null;

        const matchesKeyword = keyword === '' || surveyName.includes(keyword);
        const matchesStatus = status === 'all' || surveyStatus === status;
        const matchesGroup = currentGroupId === null || survey.groupId === currentGroupId; // グループIDによるフィルタリング
        
        const matchesPeriod = 
            (!startDate || !isValidDate(startDate) || (surveyPeriodStart && surveyPeriodStart >= startDate)) &&
            (!endDate || !isValidDate(endDate) || (surveyPeriodEnd && surveyPeriodEnd <= endDate));
        
        return matchesKeyword && matchesStatus && matchesPeriod && matchesGroup;
    });

    currentPage = 1; // Reset to first page after filtering
    updatePagination(); // Re-render table with filtered data and update pagination
}

export function setGroupFilter(groupId) {
    currentGroupId = groupId;
    applyFiltersAndPagination();
}

export function initTableManager() {
    const searchKeywordInput = document.getElementById('searchKeyword');
    const filterStatusSelect = document.getElementById('filterStatus');
    const filterStartDateInput = document.getElementById('filterStartDate');
    const filterEndDateInput = document.getElementById('filterEndDate');
    const itemsPerPageSelect = document.getElementById('itemsPerPage');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const resetFiltersButton = document.getElementById('resetFiltersButton');

    // Table Sort Logic
    document.querySelectorAll('.sortable-header').forEach(header => {
        header.addEventListener('click', () => {
            const sortKey = header.dataset.sortKey;
            let sortOrder = header.dataset.sortOrder; // 'asc' or 'desc'

            // Toggle sort order
            sortOrder = (sortOrder === 'asc') ? 'desc' : 'asc';
            header.dataset.sortOrder = sortOrder;

            // Update sort icons (reset previous, set current)
            if (lastSortedHeader && lastSortedHeader !== header) {
                const prevIcon = lastSortedHeader.querySelector('.sort-icon');
                if (prevIcon) {
                    prevIcon.textContent = 'unfold_more';
                    prevIcon.classList.remove('opacity-100');
                    prevIcon.classList.add('opacity-40');
                }
            }
            const currentSortIcon = header.querySelector('.sort-icon');
            if (currentSortIcon) {
                currentSortIcon.textContent = (sortOrder === 'asc') ? 'arrow_upward' : 'arrow_downward';
                currentSortIcon.classList.remove('opacity-40');
                currentSortIcon.classList.add('opacity-100');
            }
            lastSortedHeader = header;

            // Sorting on currentFilteredData directly
            currentFilteredData.sort((a, b) => {
                let aValue = a[sortKey];
                let bValue = b[sortKey];

                // Type conversion for robust numerical/date sorting
                if (sortKey === 'answerCount' && aValue !== undefined && bValue !== undefined) {
                    aValue = parseInt(aValue, 10);
                    bValue = parseInt(bValue, 10);
                } else if ((sortKey === 'periodStart' || sortKey === 'deadline' || sortKey === 'dataCompletionDate') && aValue !== undefined && bValue !== undefined) {
                    aValue = new Date(aValue); // Date objects for proper comparison
                    bValue = new Date(bValue);
                } else if (sortKey === 'status') {
                    // Custom sort order for status
                    aValue = STATUS_SORT_ORDER[aValue] || 99;
                    bValue = STATUS_SORT_ORDER[bValue] || 99;
                } else if (typeof aValue === 'string' && typeof bValue === 'string') {
                    // Default string comparison (case-insensitive)
                    return aValue.localeCompare(bValue, 'ja', { sensitivity: 'base' });
                }

                // Comparison logic
                if (aValue < bValue) return (sortOrder === 'asc') ? -1 : 1;
                if (aValue > bValue) return (sortOrder === 'asc') ? 1 : -1;
                return 0;
            });

            updatePagination(); // Re-render table with sorted data and update pagination
        });
    });

    // Filter Event Listeners
    // if (searchKeywordInput) searchKeywordInput.addEventListener('input', applyFiltersAndPagination); // 検索ボタン追加に伴い削除
    const searchButton = document.getElementById('searchButton');
    if (searchButton) {
        searchButton.addEventListener('click', applyFiltersAndPagination);
    }
    if (filterStatusSelect) filterStatusSelect.addEventListener('change', applyFiltersAndPagination);
    if (filterStartDateInput) filterStartDateInput.addEventListener('change', applyFiltersAndPagination);
    if (filterEndDateInput) filterEndDateInput.addEventListener('change', applyFiltersAndPagination);

    if (resetFiltersButton) {
        resetFiltersButton.addEventListener('click', () => {
            if (searchKeywordInput) searchKeywordInput.value = '';
            if (filterStatusSelect) filterStatusSelect.value = 'all';
            if (filterStartDateInput) filterStartDateInput.value = '';
            if (filterEndDateInput) filterEndDateInput.value = '';
            applyFiltersAndPagination();
        });
    }

    // Pagination Event Listeners
    if (itemsPerPageSelect) {
        itemsPerPageSelect.addEventListener('change', (event) => {
            itemsPerPage = parseInt(event.target.value, 10);
            currentPage = 1;
            updatePagination();
        });
    }
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                updatePagination();
            }
        });
    }
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalItems = currentFilteredData.length;
            const totalPages = Math.ceil(totalItems / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                updatePagination();
            }
        });
    }

    // Initial data fetch and render
    fetchSurveyData().then(data => {
        allSurveyData = data;
        console.log("DEBUG: Fetched survey data:", allSurveyData);
        applyFiltersAndPagination();
        console.log("DEBUG: Current filtered data after initial load:", currentFilteredData);
    }).catch(error => {
        console.error("DEBUG: Error during initial data fetch or rendering:", error);
    });
}

export function updateSurveyData(updatedSurvey) {
    const index = allSurveyData.findIndex(survey => survey.id === updatedSurvey.id);
    if (index !== -1) {
        allSurveyData[index] = { ...allSurveyData[index], ...updatedSurvey };
        applyFiltersAndPagination(); // Re-apply filters and pagination to update table
    }
}
