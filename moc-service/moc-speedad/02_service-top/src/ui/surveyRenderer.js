// DOM要素のキャッシュ
const surveyNameInput = document.getElementById('surveyName');
const displayTitleInput = document.getElementById('displayTitle');
const descriptionTextarea = document.getElementById('description');
const periodStartInput = document.getElementById('periodStart');
const periodEndInput = document.getElementById('periodEnd');
const planSelect = document.getElementById('plan');
const deadlineInput = document.getElementById('deadline');
const memoTextarea = document.getElementById('memo');
const questionGroupsContainer = document.getElementById('questionGroupsContainer');

// テンプレートのキャッシュ
const groupTemplate = document.getElementById('questionGroupTemplate');
const questionTemplate = document.getElementById('questionTemplate');
const optionTemplate = document.getElementById('optionTemplate');

/**
 * アンケートの基本情報をフォームに設定します。
 * @param {object} surveyData - アンケートデータ
 */
export function populateBasicInfo(surveyData) {
    if (!surveyData) return;
    surveyNameInput.value = surveyData.name || '';
    displayTitleInput.value = surveyData.displayTitle || '';
    descriptionTextarea.value = surveyData.description || '';
    periodStartInput.value = surveyData.periodStart || '';
    periodEndInput.value = surveyData.periodEnd || '';
    planSelect.value = surveyData.plan || 'Standard';
    deadlineInput.value = surveyData.deadline || '';
    memoTextarea.value = surveyData.memo || '';
}

/**
 * 質問項目をレンダリングします。
 * @param {object} question - 質問データ
 * @param {number} index - 質問のインデックス
 * @returns {DocumentFragment} - 質問のDOM要素
 */
function renderQuestion(question, index) {
    const questionTypes = {
        free_answer: 'フリーアンサー',
        single_answer: 'シングルアンサー',
        multi_answer: 'マルチアンサー',
        number_answer: '数値回答',
        matrix_sa: 'マトリックス(SA)',
        matrix_ma: 'マトリックス(MA)',
        date_time: '日付/時間',
        handwriting: '手書きスペース'
    };

    const fragment = questionTemplate.content.cloneNode(true);
    const questionItem = fragment.querySelector('.question-item');
    const questionTitle = fragment.querySelector('.question-title');
    const questionTextInput = fragment.querySelector('.question-text-input');
    const optionsContainer = fragment.querySelector('.options-container');
    const requiredCheckbox = fragment.querySelector('.required-checkbox');
    const requiredLabel = fragment.querySelector('.required-label');

    questionItem.dataset.questionId = question.questionId;
    questionTitle.textContent = `Q${index + 1}: ${questionTypes[question.type]}`;
    questionTextInput.value = question.text;
    
    const checkboxId = `q${question.questionId}_required`;
    requiredCheckbox.id = checkboxId;
    requiredCheckbox.checked = question.required;
    requiredLabel.setAttribute('for', checkboxId);

    if (question.options && question.options.length > 0) {
        question.options.forEach(opt => {
            const optionFragment = optionTemplate.content.cloneNode(true);
            const optionTextInput = optionFragment.querySelector('.option-text-input');
            optionTextInput.value = opt.text;
            optionsContainer.appendChild(optionFragment);
        });
        const addOptionButton = document.createElement('button');
        addOptionButton.className = 'text-sm text-primary hover:underline mt-2';
        addOptionButton.textContent = '+ 選択肢を追加';
        optionsContainer.appendChild(addOptionButton);
    }

    return fragment;
}

/**
 * 指定された質問に新しい選択肢を追加します。
 * @param {HTMLElement} questionElement - 選択肢を追加する質問のDOM要素
 */
export function addOptionToQuestion(questionElement) {
    const optionsContainer = questionElement.querySelector('.options-container');
    if (!optionsContainer) return;

    const optionFragment = optionTemplate.content.cloneNode(true);
    const optionTextInput = optionFragment.querySelector('.option-text-input');
    optionTextInput.value = '新しい選択肢'; // デフォルト値
    optionsContainer.insertBefore(optionFragment, optionsContainer.lastElementChild); // 「+ 選択肢を追加」ボタンの前に挿入
}

/**
 * 質問グループをレンダリングします。
 * @param {object} group - 質問グループデータ
 * @returns {DocumentFragment} - 質問グループのDOM要素
 */
function renderQuestionGroup(group) {
    const fragment = groupTemplate.content.cloneNode(true);
    const questionGroup = fragment.querySelector('.question-group');
    const groupHeader = fragment.querySelector('.group-header');
    const groupTitleInput = fragment.querySelector('.group-title-input');
    const questionsList = fragment.querySelector('.questions-list');
    const accordionContentId = `groupContent_${group.groupId}`;

    questionGroup.dataset.groupId = group.groupId;
    groupHeader.dataset.accordionTarget = accordionContentId;
    groupTitleInput.value = group.title;
    questionsList.id = accordionContentId;

    group.questions.forEach((q, i) => {
        questionsList.appendChild(renderQuestion(q, i));
    });

    return fragment;
}

/**
 * すべての質問グループを描画します。
 * @param {Array<object>} groups - 質問グループの配列
 */
export function renderAllQuestionGroups(groups) {
    // 既存のコンテンツをクリア
    questionGroupsContainer.innerHTML = '';

    if (groups && groups.length > 0) {
        groups.forEach(group => {
            questionGroupsContainer.appendChild(renderQuestionGroup(group));
        });
    } else {
        displayNoQuestionsMessage();
    }
}

/**
 * 「質問がありません」というメッセージを表示します。
 */
export function displayNoQuestionsMessage() {
    questionGroupsContainer.innerHTML = '<p class="text-on-surface-variant">質問がありません。質問を追加してください。</p>';
}

/**
 * エラーメッセージを表示します。
 */
export function displayErrorMessage() {
    questionGroupsContainer.innerHTML = '<p class="text-error">アンケートの読み込み中にエラーが発生しました。</p>';
}

/**
 * 新しい空の質問グループをページに追加します。
 */
export function addNewQuestionGroup() {
    const newGroupId = `group_${Date.now()}`;
    const fragment = groupTemplate.content.cloneNode(true);
    
    const questionGroup = fragment.querySelector('.question-group');
    const groupHeader = fragment.querySelector('.group-header');
    const groupTitleInput = fragment.querySelector('.group-title-input');
    const questionsList = fragment.querySelector('.questions-list');
    const accordionContentId = `groupContent_${newGroupId}`;

    questionGroup.dataset.groupId = newGroupId;
    groupHeader.dataset.accordionTarget = accordionContentId;
    groupTitleInput.value = '新しい質問グループ';
    questionsList.id = accordionContentId;

    // 新規グループ作成時は、中身がないことを示すメッセージを表示
    questionsList.innerHTML = '<p class="text-on-surface-variant text-sm">まだ質問がありません。右下の「+」ボタンから質問を追加してください。</p>';

    questionGroupsContainer.appendChild(fragment);
}

/**
 * 質問グループをDOMから削除します。
 * @param {HTMLElement} groupElement - 削除する質問グループのDOM要素
 */
export function deleteQuestionGroup(groupElement) {
    if (confirm('この質問グループを削除してもよろしいですか？')) {
        groupElement.remove();
        // 必要に応じて、グループがなくなった場合のメッセージ表示などを追加
        if (questionGroupsContainer.children.length === 0) {
            displayNoQuestionsMessage();
        }
    }
}

/**
 * 質問をDOMから削除し、グループ内の質問番号を振り直します。
 * @param {HTMLElement} questionElement - 削除する質問のDOM要素
 */
export function deleteQuestion(questionElement) {
    if (confirm('この質問を削除してもよろしいですか？')) {
        const parentQuestionsList = questionElement.closest('.questions-list');
        questionElement.remove();

        // 質問番号を振り直す
        if (parentQuestionsList) {
            const remainingQuestions = parentQuestionsList.querySelectorAll('.question-item');
            remainingQuestions.forEach((q, i) => {
                const questionTitle = q.querySelector('.question-title');
                if (questionTitle) {
                    // 現在のタイトルから質問タイプを抽出
                    const currentTitle = questionTitle.textContent;
                    const typeMatch = currentTitle.match(/Q\d+:\s*(.*)/);
                    const questionType = typeMatch ? typeMatch[1].trim() : '';
                    questionTitle.textContent = `Q${i + 1}: ${questionType}`;
                }
            });
            // グループ内に質問がなくなった場合
            if (remainingQuestions.length === 0) {
                const noQuestionMessage = document.createElement('p');
                noQuestionMessage.className = 'text-on-surface-variant text-sm';
                noQuestionMessage.textContent = 'まだ質問がありません。右下の「+」ボタンから質問を追加してください。';
                parentQuestionsList.appendChild(noQuestionMessage);
            }
        }
    }
}

/**
 * 質問グループを複製します。
 * @param {HTMLElement} originalGroupElement - 複製する元の質問グループのDOM要素
 */
export function duplicateQuestionGroup(originalGroupElement) {
    const clonedGroup = originalGroupElement.cloneNode(true);
    const newGroupId = `group_${Date.now()}`;
    
    // 新しいIDを割り当て
    clonedGroup.dataset.groupId = newGroupId;
    const groupHeader = clonedGroup.querySelector('.group-header');
    const questionsList = clonedGroup.querySelector('.questions-list');
    const accordionContentId = `groupContent_${newGroupId}`;

    groupHeader.dataset.accordionTarget = accordionContentId;
    questionsList.id = accordionContentId;

    // クローン内の質問のIDも更新
    const clonedQuestions = clonedGroup.querySelectorAll('.question-item');
    clonedQuestions.forEach((q, i) => {
        const newQuestionId = `q_${Date.now()}_${i}`;
        q.dataset.questionId = newQuestionId;
        // 必須チェックボックスのIDとfor属性も更新
        const requiredCheckbox = q.querySelector('.required-checkbox');
        const requiredLabel = q.querySelector('.required-label');
        if (requiredCheckbox && requiredLabel) {
            const newCheckboxId = `q${newQuestionId}_required`;
            requiredCheckbox.id = newCheckboxId;
            requiredLabel.setAttribute('for', newCheckboxId);
        }
        // 選択肢のIDも更新 (もしあれば)
        const optionInputs = q.querySelectorAll('.option-text-input');
        optionInputs.forEach((opt, j) => {
            opt.id = `opt_${newQuestionId}_${j}`;
        });
    });

    originalGroupElement.after(clonedGroup);
}

/**
 * 質問を複製します。
 * @param {HTMLElement} originalQuestionElement - 複製する元の質問のDOM要素
 */
export function duplicateQuestion(originalQuestionElement) {
    const clonedQuestion = originalQuestionElement.cloneNode(true);
    const newQuestionId = `q_${Date.now()}`;

    // 新しいIDを割り当て
    clonedQuestion.dataset.questionId = newQuestionId;

    // 必須チェックボックスのIDとfor属性も更新
    const requiredCheckbox = clonedQuestion.querySelector('.required-checkbox');
    const requiredLabel = clonedQuestion.querySelector('.required-label');
    if (requiredCheckbox && requiredLabel) {
        const newCheckboxId = `q${newQuestionId}_required`;
        requiredCheckbox.id = newCheckboxId;
        requiredLabel.setAttribute('for', newCheckboxId);
    }

    // 選択肢のIDも更新 (もしあれば)
    const optionInputs = clonedQuestion.querySelectorAll('.option-text-input');
    optionInputs.forEach((opt, j) => {
        opt.id = `opt_${newQuestionId}_${j}`;
    });

    originalQuestionElement.after(clonedQuestion);

    // 複製後に質問番号を振り直す
    const parentQuestionsList = originalQuestionElement.closest('.questions-list');
    if (parentQuestionsList) {
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
    }
}

/**
 * 新しい質問を既存の質問グループに追加します。
 * @param {string} questionType - 追加する質問のタイプ (例: 'free_answer', 'single_answer')
 * @param {string} targetGroupId - 質問を追加するグループのID。指定がない場合は最後のグループに追加。
 */
export function addNewQuestion(questionType, targetGroupId = null) {
    let targetGroupElement;
    if (targetGroupId) {
        targetGroupElement = questionGroupsContainer.querySelector(`[data-group-id="${targetGroupId}"] .questions-list`);
    } else {
        // 最後の質問グループを取得
        const allQuestionGroups = questionGroupsContainer.querySelectorAll('.question-group');
        if (allQuestionGroups.length === 0) {
            // 質問グループが一つもない場合は、まず新しいグループを追加
            addNewQuestionGroup();
            targetGroupElement = questionGroupsContainer.querySelector('.question-group .questions-list');
        } else {
            targetGroupElement = allQuestionGroups[allQuestionGroups.length - 1].querySelector('.questions-list');
        }
    }

    if (!targetGroupElement) {
        console.error('Target question group not found.');
        return;
    }

    // 「まだ質問がありません」メッセージを削除
    const noQuestionMessage = targetGroupElement.querySelector('.text-on-surface-variant.text-sm');
    if (noQuestionMessage) {
        noQuestionMessage.remove();
    }

    const newQuestionId = `q_${Date.now()}`;
    let newQuestionData = {
        questionId: newQuestionId,
        type: questionType,
        text: '',
        required: false
    };

    if (questionType === 'single_answer' || questionType === 'multi_answer') {
        newQuestionData.options = [
            { optionId: `opt_${Date.now()}_1`, text: '選択肢1' },
            { optionId: `opt_${Date.now()}_2`, text: '選択肢2' }
        ];
    }

    // 現在の質問数を取得して、新しい質問のインデックスを決定
    const currentQuestionsInGroup = targetGroupElement.querySelectorAll('.question-item').length;

    const newQuestionFragment = renderQuestion(newQuestionData, currentQuestionsInGroup);
    targetGroupElement.appendChild(newQuestionFragment);

    // 新しく追加された質問要素を取得し、スクロールする
    const newlyAddedQuestion = targetGroupElement.lastElementChild;
    if (newlyAddedQuestion) {
        newlyAddedQuestion.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
}

/**
 * アウトラインマップを生成し、表示します。
 */
export function renderOutlineMap() {
    const outlineMapContainer = document.getElementById('outline-map-container');
    if (!outlineMapContainer) return;

    let outlineHtml = '<h3 class="text-lg font-semibold mb-4">目次</h3><ul class="space-y-2">';
    const mainContent = document.querySelector('main');
    if (!mainContent) return;

    // h1, h2, h3 タグを対象とする
    mainContent.querySelectorAll('h1, h2, h3').forEach((heading, index) => {
        // IDがない場合は自動生成
        if (!heading.id) {
            heading.id = `section-${index}`;
        }
        const level = parseInt(heading.tagName.substring(1)); // h1 -> 1, h2 -> 2
        const paddingLeft = (level - 1) * 16; // インデント

        outlineHtml += `
            <li>
                <a href="#${heading.id}" class="block text-on-surface-variant hover:text-primary text-sm" style="padding-left: ${paddingLeft}px;">
                    ${heading.textContent}
                </a>
            </li>
        `;
    });
    outlineHtml += '</ul>';
    outlineMapContainer.innerHTML = outlineHtml;

    // スクロールイベントで現在位置をハイライトする機能 (オプション)
    // Intersection Observer APIなどを使うとより高度な実装が可能
}