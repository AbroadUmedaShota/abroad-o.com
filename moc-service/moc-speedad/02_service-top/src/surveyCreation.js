import { handleOpenModal } from './modalHandler.js';
import { openAccountInfoModal } from './accountInfoModal.js';
import { fetchSurveyData, collectSurveyDataFromDOM } from './services/surveyService.js';
import { 
    populateBasicInfo, 
    renderAllQuestionGroups, 
    displayErrorMessage, 
    addNewQuestionGroup, 
    addNewQuestion, 
    deleteQuestionGroup, 
    deleteQuestion, 
    duplicateQuestionGroup, 
    duplicateQuestion, 
    addOptionToQuestion, 
    renderOutlineMap 
} from './ui/surveyRenderer.js';

// ダミーユーザーデータ (本来はAPIから取得)
window.dummyUserData = {
    email: "user@example.com",
    companyName: "株式会社SpeedAd",
    departmentName: "開発部",
    positionName: "エンジニア",
    lastName: "田中",
    firstName: "太郎",
    phoneNumber: "09012345678",
    postalCode: "100-0001",
    address: "東京都千代田区千代田1-1",
    buildingFloor: "皇居ビルディング 1F",
    billingAddressType: "same",
    billingCompanyName: "",
    billingDepartmentName: "",
    billingLastName: "",
    billingFirstName: "",
    billingPhoneNumber: "",
    billingPostalCode: "",
    billingAddress: "",
    billingBuildingFloor: "",
};

/**
 * ページの初期化処理
 */
async function initializePage() {
    try {
        const surveyData = await fetchSurveyData();
        populateBasicInfo(surveyData);
        renderAllQuestionGroups(surveyData.questionGroups);
        renderOutlineMap(); // 初期ロード時にアウトラインマップを生成
    } catch (error) {
        console.error('Failed to initialize page:', error);
        displayErrorMessage();
    }
}

/**
 * イベントリスナーを登録する
 */
function setupEventListeners() {
    // アコーディオンの開閉処理
    document.body.addEventListener('click', (event) => {
        const header = event.target.closest('.accordion-header, .group-header');
        if (header) {
            const contentId = header.dataset.accordionTarget;
            const content = document.getElementById(contentId);
            const icon = header.querySelector('.expand-icon');
            if (content) {
                const isVisible = getComputedStyle(content).display !== 'none';
                content.style.display = isVisible ? 'none' : 'block';
                icon.textContent = isVisible ? 'expand_more' : 'expand_less';
            }
        }
    });

    // flatpickrの初期化
    flatpickr.localize(flatpickr.l10ns.ja);

    const endDatePicker = flatpickr("#periodEndWrapper", {
        wrap: true,
        dateFormat: "Y-m-d",
    });

    flatpickr("#periodStartWrapper", {
        wrap: true,
        dateFormat: "Y-m-d",
        onChange: function(selectedDates, dateStr) {
            endDatePicker.set('minDate', dateStr);
        }
    });

    flatpickr("#deadlineWrapper", {
        wrap: true,
        dateFormat: "Y-m-d",
    });

    // モーダルを開くボタンのイベントリスナー
    document.getElementById('openAccountInfoBtnHeader').addEventListener('click', () => openAccountInfoModal(window.dummyUserData));
    document.getElementById('openAccountInfoBtnSidebar').addEventListener('click', () => openAccountInfoModal(window.dummyUserData));
    document.getElementById('openContactModalBtn').addEventListener('click', () => handleOpenModal('contactModal', 'modals/contactModal.html'));
    document.getElementById('openBizcardSettingsBtn').addEventListener('click', () => handleOpenModal('bizcardSettingsModal', 'bizcardSettings.html'));
    document.getElementById('openThankYouEmailSettingsBtn').addEventListener('click', () => handleOpenModal('thankYouEmailSettingsModal', 'thankYouEmailSettings.html'));

    // 「質問グループを追加」ボタンのイベントリスナー (フローティングメニュー内)
    const addQuestionGroupBtn = document.getElementById('addQuestionGroupBtn');
    if (addQuestionGroupBtn) {
        addQuestionGroupBtn.addEventListener('click', () => {
            addNewQuestionGroup();
            questionTypeSelector.classList.add('hidden'); // メニューを閉じる
        });
    }

    // 質問タイプ選択ボタンの表示/非表示
    const openQuestionTypeSelectorBtn = document.getElementById('openQuestionTypeSelectorBtn');
    const questionTypeSelector = document.getElementById('questionTypeSelector');

    if (openQuestionTypeSelectorBtn && questionTypeSelector) {
        openQuestionTypeSelectorBtn.addEventListener('click', (e) => {
            // ドラッグイベントと競合しないように、クリックイベントの伝播を停止
            e.stopPropagation();
            const isHidden = questionTypeSelector.classList.contains('opacity-0');
            if (isHidden) {
                updateQuestionTypeSelectorPosition();
                questionTypeSelector.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
            } else {
                questionTypeSelector.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
            }
        });

        // 質問タイプ選択メニュー外をクリックで閉じる
        document.addEventListener('click', (event) => {
            if (!questionTypeSelector.contains(event.target) && !openQuestionTypeSelectorBtn.contains(event.target)) {
                questionTypeSelector.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
            }
        });
    }

    // 各質問タイプボタンのイベントリスナー
    document.getElementById('addFreeAnswerBtn').addEventListener('click', () => {
        addNewQuestion('free_answer');
        questionTypeSelector.classList.add('hidden');
    });
    document.getElementById('addSingleAnswerBtn').addEventListener('click', () => {
        addNewQuestion('single_answer');
        questionTypeSelector.classList.add('hidden');
    });
    document.getElementById('addMultiAnswerBtn').addEventListener('click', () => {
        addNewQuestion('multi_answer');
        questionTypeSelector.classList.add('hidden');
    });
    document.getElementById('addNumberAnswerBtn').addEventListener('click', () => {
        addNewQuestion('number_answer');
        questionTypeSelector.classList.add('hidden');
    });
    document.getElementById('addMatrixSABtn').addEventListener('click', () => {
        addNewQuestion('matrix_sa');
        questionTypeSelector.classList.add('hidden');
    });
    document.getElementById('addMatrixMABtn').addEventListener('click', () => {
        addNewQuestion('matrix_ma');
        questionTypeSelector.classList.add('hidden');
    });
    document.getElementById('addDateTimeBtn').addEventListener('click', () => {
        addNewQuestion('date_time');
        questionTypeSelector.classList.add('hidden');
    });
    document.getElementById('addHandwritingBtn').addEventListener('click', () => {
        addNewQuestion('handwriting');
        questionTypeSelector.classList.add('hidden');
    });

    // 削除ボタンのイベントリスナー (イベントデリゲーション)
    document.body.addEventListener('click', (event) => {
        const target = event.target;
        // 質問グループの削除ボタン
        const deleteGroupBtn = target.closest('.group-header .icon-button .material-icons');
        if (deleteGroupBtn && deleteGroupBtn.textContent === 'delete') {
            const groupElement = deleteGroupBtn.closest('.question-group');
            if (groupElement) {
                deleteQuestionGroup(groupElement);
            }
        }

        // 質問項目の削除ボタン
        const deleteQuestionBtn = target.closest('.question-item .icon-button .material-icons');
        if (deleteQuestionBtn && deleteQuestionBtn.textContent === 'delete') {
            const questionElement = deleteQuestionBtn.closest('.question-item');
            if (questionElement) {
                deleteQuestion(questionElement);
            }
        }

        // 質問グループの複製ボタン
        const duplicateGroupBtn = target.closest('.group-header .icon-button .material-icons');
        if (duplicateGroupBtn && duplicateGroupBtn.textContent === 'content_copy') {
            const groupElement = duplicateGroupBtn.closest('.question-group');
            if (groupElement) {
                duplicateQuestionGroup(groupElement);
            }
        }

        // 質問項目の複製ボタン
        const duplicateQuestionBtn = target.closest('.question-item .icon-button .material-icons');
        if (duplicateQuestionBtn && duplicateQuestionBtn.textContent === 'content_copy') {
            const questionElement = duplicateQuestionBtn.closest('.question-item');
            if (questionElement) {
                duplicateQuestion(questionElement);
            }
        }

        // 選択肢追加ボタン
        const addOptionBtn = target.closest('.options-container .text-sm.text-primary');
        if (addOptionBtn && addOptionBtn.textContent.includes('+ 選択肢を追加')) {
            const questionElement = addOptionBtn.closest('.question-item');
            if (questionElement) {
                addOptionToQuestion(questionElement);
            }
        }
    });

    // Sortable.jsの初期化
    const questionGroupsContainer = document.getElementById('questionGroupsContainer');

    // 質問グループの並べ替え
    new Sortable(questionGroupsContainer, {
        animation: 150,
        handle: '.group-header .handle', // ドラッグハンドル
        ghostClass: 'blue-background-class', // ドラッグ中のスタイル
        onEnd: function (evt) {
            // 並べ替え後の処理（必要であれば）
            console.log('Group moved:', evt.oldIndex, evt.newIndex);
        },
    });

    // 各質問グループ内の質問項目の並べ替え
    // MutationObserverを使って、動的に追加される質問グループにもSortableを適用
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.classList.contains('question-group')) {
                        const questionsList = node.querySelector('.questions-list');
                        if (questionsList) {
                            new Sortable(questionsList, {
                                animation: 150,
                                handle: '.question-item .handle', // ドラッグハンドル
                                ghostClass: 'blue-background-class', // ドラッグ中のスタイル
                                onEnd: function (evt) {
                                    // 並べ替え後の処理（必要であれば）
                                    console.log('Question moved:', evt.oldIndex, evt.newIndex);
                                    // 質問番号を振り直す
                                    const parentQuestionsList = evt.to;
                                    const remainingQuestions = parentQuestionsList.querySelectorAll('.question-item');
                                    remainingQuestions.forEach((q, i) => {
                                        const questionTitle = q.querySelector('.question-title');
                                        if (questionTitle) {
                                            const currentTitle = questionTitle.textContent;
                                            const typeMatch = currentTitle.match(/Q\d+:\s*(.*)/);
                                            const questionType = typeMatch ? typeMatch[1].trim() : '';
                                            questionTitle.textContent = `Q${i + 1}: ${questionType}`;
                                        }
                                    });
                                },
                            });
                        }
                    }
                });
            }
        });
    });

    observer.observe(questionGroupsContainer, { childList: true });

    // 既存の質問グループにもSortableを適用
    questionGroupsContainer.querySelectorAll('.questions-list').forEach(questionsList => {
        new Sortable(questionsList, {
            animation: 150,
            handle: '.question-item .handle', // ドラッグハンドル
            ghostClass: 'blue-background-class', // ドラッグ中のスタイル
            onEnd: function (evt) {
                // 並べ替え後の処理（必要であれば）
                console.log('Question moved:', evt.oldIndex, evt.newIndex);
                // 質問番号を振り直す
                const parentQuestionsList = evt.to;
                const remainingQuestions = parentQuestionsList.querySelectorAll('.question-item');
                remainingQuestions.forEach((q, i) => {
                    const questionTitle = q.querySelector('.question-title');
                    if (questionTitle) {
                        const currentTitle = questionTitle.textContent;
                        const typeMatch = currentTitle.match(/Q\d+:\s*(.*)/);
                        const questionType = typeMatch ? typeMatch[1].trim() : '';
                        questionTitle.textContent = `Q${i + 1}: ${questionType}`;
                    }
                });
            },
        });
    });

    // フローティングナビゲーションのドラッグ機能
    const floatingNav = document.getElementById('floatingNavContainer');
    const dragHandle = document.getElementById('openQuestionTypeSelectorBtn'); // ドラッグハンドルをメインボタンに設定
    let isDragging = false;
    let offsetX, offsetY;
    let startX, startY;
    const clickThreshold = 5; // クリックとドラッグを判定する閾値 (px)

    // フローティングナビゲーションのドラッグ機能
    // localStorageによる位置の保存・読み込みは行わない

    dragHandle.addEventListener('mousedown', (e) => {
        // メニューが開いている場合はドラッグしない
        if (!questionTypeSelector.classList.contains('opacity-0')) {
            return;
        }
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        offsetX = e.clientX - floatingNav.getBoundingClientRect().left;
        offsetY = e.clientY - floatingNav.getBoundingClientRect().top;
        floatingNav.style.cursor = 'grabbing';
        floatingNav.style.position = 'fixed'; // ドラッグ中はfixedに
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        floatingNav.style.left = `${e.clientX - offsetX}px`;
        floatingNav.style.top = `${e.clientY - offsetY}px`;
    });

    document.addEventListener('mouseup', (e) => {
        if (isDragging) {
            const moveX = Math.abs(e.clientX - startX);
            const moveY = Math.abs(e.clientY - startY);
            // 移動距離が閾値以下の場合はクリックとみなす
            if (moveX < clickThreshold && moveY < clickThreshold) {
                const isHidden = questionTypeSelector.classList.contains('opacity-0');
                if (isHidden) {
                    updateQuestionTypeSelectorPosition();
                    questionTypeSelector.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
                } else {
                    questionTypeSelector.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
                }
            }

            isDragging = false;
            floatingNav.style.cursor = 'grab';
            // 位置を保存するロジックを削除
        }
    });
}

/**
 * フローティングメニュー（質問タイプセレクター）の位置を、
 * 呼び出し元のボタンの位置に基づいて動的に調整する。
 * メニューが画面外にはみ出さないように位置を計算する。
 */
function updateQuestionTypeSelectorPosition() {
    const button = document.getElementById('openQuestionTypeSelectorBtn');
    const menu = document.getElementById('questionTypeSelector');
    const container = document.getElementById('floatingNavContainer');

    if (!button || !menu || !container) return;

    const buttonRect = button.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect(); // メニューの実際のサイズを取得
    const space = 12; // ボタンとメニューの間の余白

    // デフォルトはボタンの直下
    let top = buttonRect.bottom + space;
    let left = buttonRect.left;

    // 下にはみ出す場合は、ボタンの上に表示
    if (top + menuRect.height > window.innerHeight - space) {
        top = buttonRect.top - menuRect.height - space;
    }

    // 左右のはみ出しを最終調整
    if (left < space) {
        left = space;
    }
    if (left + menuRect.width > window.innerWidth - space) {
        left = window.innerWidth - menuRect.width - space;
    }
    
    // 上にはみ出す場合の最終防衛ライン
    if (top < space) {
        top = space;
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    menu.style.position = 'fixed'; // 常にfixedで表示
}

/**
 * フォームの必須項目を検証し、保存ボタンの有効/無効を切り替える。
 */
function validateFormForSaveButton() {
    const saveButton = document.getElementById('createSurveyBtn');
    const requiredFields = [
        document.getElementById('surveyName'),
        document.getElementById('displayTitle'),
        document.getElementById('periodStart'),
        document.getElementById('periodEnd'),
    ];

    function checkValidation() {
        const allValid = requiredFields.every(field => field.value.trim() !== '');
        saveButton.disabled = !allValid;
    }

    requiredFields.forEach(field => {
        field.addEventListener('input', checkValidation);
    });

    // 日付ピッカーの変更も監視する
    const observer = new MutationObserver(checkValidation);
    requiredFields.forEach(field => {
        if (field.id.includes('period')) {
            observer.observe(field, { attributes: true, attributeFilter: ['value'] });
        }
    });

    checkValidation(); // 初期チェック
}

/**
 * スクロールに合わせてアウトラインマップのアクティブ状態を更新する。
 */
function setupScrollSpy() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    // --- スクロールスパイ機能 ---
    const outlineLinks = document.querySelectorAll('#outline-map-container a');
    const sections = Array.from(outlineLinks).map(link => {
        const id = link.getAttribute('href').substring(1);
        return document.getElementById(id);
    }).filter(section => section !== null);

    if (outlineLinks.length > 0 && sections.length > 0) {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                const id = entry.target.id;
                const correspondingLink = document.querySelector(`#outline-map-container a[href="#${id}"]`);
                if (entry.isIntersecting) {
                    outlineLinks.forEach(link => link.classList.remove('active'));
                    if (correspondingLink) {
                        correspondingLink.classList.add('active');
                    }
                }
            });
        }, { root: mainContent, threshold: 0.5 });

        sections.forEach(section => {
            observer.observe(section);
        });
    }

    // --- FABのテキスト表示切り替え機能 ---
    const fabButton = document.getElementById('openQuestionTypeSelectorBtn');
    const fabText = document.getElementById('fab-text');
    let lastScrollTop = mainContent.scrollTop;

    mainContent.addEventListener('scroll', () => {
        let scrollTop = mainContent.scrollTop;
        if (scrollTop > lastScrollTop) {
            // 下にスクロール
            fabText.classList.add('w-0', 'opacity-0');
            fabText.classList.remove('w-auto', 'opacity-100');
            fabButton.classList.remove('px-5');
            fabButton.classList.add('px-4');
        } else {
            // 上にスクロール
            fabText.classList.remove('w-0', 'opacity-0');
            fabText.classList.add('w-auto', 'opacity-100');
            fabButton.classList.remove('px-4');
            fabButton.classList.add('px-5');
        }
        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop; // For Mobile or negative scrolling
    }, false);
}

    // DOMの読み込みが完了したら処理を開始
document.addEventListener('DOMContentLoaded', () => {
    initializePage();
    setupEventListeners();
    setupScrollSpy();
});

// ウィンドウのリサイズ時にフローティングボタンの位置を更新
window.addEventListener('resize', () => questionTypeSelector.classList.add('opacity-0', 'scale-95', 'pointer-events-none'), true);