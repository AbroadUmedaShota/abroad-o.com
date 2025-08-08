/**
 * アンケートデータをサーバーやファイルから取得します。
 * @returns {Promise<object>} アンケートデータのJSONオブジェクト
 * @throws {Error} データの取得に失敗した場合
 */
export async function fetchSurveyData() {
    try {
        // 現在はローカルのJSONを指していますが、将来的にはAPIエンドポイントに変更可能
        const response = await fetch('../data/sample_survey.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch survey data:', error);
        // エラーを呼び出し元に再スローして、UI側でエラーハンドリングできるようにする
        throw error;
    }
}

/**
 * フォームからアンケートデータを収集します。
 * @returns {object} 収集されたアンケートデータ
 */
export function collectSurveyDataFromDOM() {
    const surveyData = {};

    // 基本情報の収集
    surveyData.name = document.getElementById('surveyName').value;
    surveyData.displayTitle = document.getElementById('displayTitle').value;
    surveyData.description = document.getElementById('description').value;
    surveyData.periodStart = document.getElementById('periodStart').value;
    surveyData.periodEnd = document.getElementById('periodEnd').value;
    surveyData.plan = document.getElementById('plan').value;
    surveyData.deadline = document.getElementById('deadline').value;
    surveyData.memo = document.getElementById('memo').value;

    // 質問グループの収集
    surveyData.questionGroups = [];
    document.querySelectorAll('.question-group').forEach(groupElement => {
        const group = {
            groupId: groupElement.dataset.groupId,
            title: groupElement.querySelector('.group-title-input').value,
            questions: []
        };

        groupElement.querySelectorAll('.question-item').forEach(questionElement => {
            const question = {
                questionId: questionElement.dataset.questionId,
                type: '', // 後で判別
                text: questionElement.querySelector('.question-text-input').value,
                required: questionElement.querySelector('.required-checkbox').checked
            };

            // 質問タイプの判別 (question-titleから抽出)
            const questionTitleText = questionElement.querySelector('.question-title').textContent;
            if (questionTitleText.includes('フリーアンサー')) question.type = 'free_answer';
            else if (questionTitleText.includes('シングルアンサー')) question.type = 'single_answer';
            else if (questionTitleText.includes('マルチアンサー')) question.type = 'multi_answer';
            else if (questionTitleText.includes('数値回答')) question.type = 'number_answer';
            else if (questionTitleText.includes('マトリックス(SA)')) question.type = 'matrix_sa';
            else if (questionTitleText.includes('マトリックス(MA)')) question.type = 'matrix_ma';
            else if (questionTitleText.includes('日付/時間')) question.type = 'date_time';
            else if (questionTitleText.includes('手書きスペース')) question.type = 'handwriting';

            // 選択肢の収集 (シングルアンサー、マルチアンサーの場合)
            if (question.type === 'single_answer' || question.type === 'multi_answer') {
                question.options = [];
                questionElement.querySelectorAll('.options-container .option-text-input').forEach((optionInput, index) => {
                    question.options.push({
                        optionId: `opt_${question.questionId}_${index + 1}`,
                        text: optionInput.value
                    });
                });
            }

            group.questions.push(question);
        });
        surveyData.questionGroups.push(group);
    });

    return surveyData;
}
