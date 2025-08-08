// src/thankYouEmailSettings.js

export function initThankYouEmailSettings() {
    // DOM Elements
    const pageTitle = document.getElementById('pageTitle');
    const surveyNameDisplay = document.getElementById('surveyNameDisplay');
    const surveyIdDisplay = document.getElementById('surveyIdDisplay');
    const surveyPeriodDisplay = document.getElementById('surveyPeriodDisplay');
    const thankYouEmailEnabledToggle = document.getElementById('thankYouEmailEnabledToggle');
    const thankYouEmailEnabledStatus = document.getElementById('thankYouEmailEnabledStatus');
    const thankYouEmailSettingsFields = document.getElementById('thankYouEmailSettingsFields');
    const sendMethodRadios = document.querySelectorAll('input[name="sendMethod"]');
    const emailTemplateSelect = document.getElementById('emailTemplate');
    const emailSubjectInput = document.getElementById('emailSubject');
    const emailBodyTextarea = document.getElementById('emailBody');
    const recipientListDiv = document.getElementById('recipientList');
    const sendEmailButton = document.getElementById('sendThankYouEmailBtn');
    const saveButton = document.getElementById('saveThankYouEmailSettingsBtn');
    const cancelButton = document.getElementById('cancelThankYouEmailSettings');
    const templatePreview = document.getElementById('templatePreview');
    const insertVariableBtn = document.getElementById('insertVariableBtn');
    const variableList = document.getElementById('variableList');

    // State
    const urlParams = new URLSearchParams(window.location.search);
    const surveyId = urlParams.get('surveyId');
    let surveyState = { // APIから取得する想定のデータ
        isEventFinished: true,
        isBizcardDataReady: true,
        recipientCount: 150,
    };

    // --- 仮のデータ ---
    const emailTemplates = {
        'default': { subject: 'ご来場ありがとうございました', body: '本日はご来場いただき、誠にありがとうございました。\n\n株式会社〇〇\n{会社名} {氏名}様' },
        'special': { subject: '【特別オファー】ご来場者様限定', body: '先日は、弊社ブースにお立ち寄りいただき、誠にありがとうございました。\n\n{会社名} {氏名}様\n\n特別なご案内がございます。' },
    };
    const variables = ['会社名', '氏名', '部署名', '役職'];

    // --- 初期化処理 ---
    if (surveyId) {
        loadInitialData();
    } else {
        displayEmptyState();
    }
    populateTemplates();
    populateVariables();
    addEventListeners();
    updateUI();

    function loadInitialData() {
        // ... (loadInitialData の実装は変更なし)
    }

    function displayEmptyState() {
        // ... (displayEmptyState の実装は変更なし)
    }

    function populateTemplates() {
        for (const [key, template] of Object.entries(emailTemplates)) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = template.subject;
            emailTemplateSelect.appendChild(option);
        }
    }

    function populateVariables() {
        variables.forEach(variable => {
            const item = document.createElement('a');
            item.href = '#';
            item.className = 'block px-4 py-2 text-sm text-on-surface hover:bg-surface-variant';
            item.textContent = `{${variable}}`;
            item.addEventListener('click', (e) => {
                e.preventDefault();
                insertTextAtCursor(emailBodyTextarea, `{${variable}}`);
                variableList.classList.add('hidden');
            });
            variableList.appendChild(item);
        });
    }

    function addEventListeners() {
        thankYouEmailEnabledToggle.addEventListener('change', updateUI);
        sendMethodRadios.forEach(radio => radio.addEventListener('change', updateUI));
        emailTemplateSelect.addEventListener('change', updateTemplatePreview);
        insertVariableBtn.addEventListener('click', () => variableList.classList.toggle('hidden'));
        saveButton.addEventListener('click', saveSettings);
        sendEmailButton.addEventListener('click', sendEmail);
        cancelButton.addEventListener('click', () => window.location.href = 'index.html');
    }

    function updateUI() {
        const isEnabled = thankYouEmailEnabledToggle.checked;
        thankYouEmailEnabledStatus.textContent = isEnabled ? '有効' : '無効';
        thankYouEmailSettingsFields.style.display = isEnabled ? 'block' : 'none';

        if (isEnabled) {
            updateRecipientList();
            updateSendButtonState();
        }
        updateTemplatePreview();
    }

    function updateRecipientList() {
        if (!surveyState.isEventFinished || !surveyState.isBizcardDataReady) {
            recipientListDiv.innerHTML = '<p class="text-on-surface-variant">会期終了後、名刺データ化が完了すると対象者が表示されます。</p>';
        } else {
            recipientListDiv.innerHTML = `<p class="font-semibold">送信対象者: <span class="text-primary text-lg">${surveyState.recipientCount}</span> 件</p>`;
        }
    }

    function updateSendButtonState() {
        const selectedMethod = document.querySelector('input[name="sendMethod"]:checked').value;
        const conditionsMet = selectedMethod === 'manual' &&
                              surveyState.isEventFinished &&
                              surveyState.isBizcardDataReady &&
                              surveyState.recipientCount > 0;
        sendEmailButton.disabled = !conditionsMet;
    }

    function updateTemplatePreview() {
        const selectedKey = emailTemplateSelect.value;
        const template = emailTemplates[selectedKey];
        if (template) {
            templatePreview.innerHTML = `<h4 class="font-bold mb-2 text-on-surface-variant">テンプレートプレビュー</h4><p class="text-on-surface-variant whitespace-pre-wrap">${template.body}</p>`;
            emailSubjectInput.value = template.subject;
            emailBodyTextarea.value = template.body;
        }
    }

    function insertTextAtCursor(textarea, text) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newText = textarea.value.substring(0, start) + text + textarea.value.substring(end);
        textarea.value = newText;
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        textarea.focus();
    }

    async function saveSettings() {
        saveButton.disabled = true;
        const originalText = saveButton.textContent;
        saveButton.textContent = '保存中...';

        try {
            console.log('Saving settings...');
            await new Promise(r => setTimeout(r, 1500)); // Simulate API call
            showToast('設定を保存しました！', 'success');
        } catch (err) {
            showToast('設定の保存に失敗しました。', 'error');
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = originalText;
        }
    }

    async function sendEmail() {
        if (confirm(`本当に${surveyState.recipientCount}件のお礼メールを送信しますか？`)) {
            sendEmailButton.disabled = true;
            const originalText = sendEmailButton.textContent;
            sendEmailButton.textContent = '送信中...';

            try {
                console.log('Sending email...');
                await new Promise(r => setTimeout(r, 2500)); // Simulate API call
                showToast('お礼メールの送信を開始しました！', 'success');
                // Potentially update a status area on the page
            } catch (err) {
                showToast('メールの送信に失敗しました。', 'error');
            } finally {
                sendEmailButton.disabled = false;
                sendEmailButton.textContent = originalText;
            }
        }
    }
} // Missing closing brace added here
