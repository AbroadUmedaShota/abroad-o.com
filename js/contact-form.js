(function () {
    'use strict';

    const form = document.getElementById('contactForm');
    if (!form) {
        return;
    }

    const apiBaseUrl = String(form.dataset.contactApi || '').replace(/\/$/, '');
    const formFeedback = document.getElementById('form-feedback');
    const emailField = document.getElementById('email');
    const phoneField = document.getElementById('phone');
    const inquiryDetailsField = document.getElementById('inquiry_details');
    const emailError = emailField.nextElementSibling;
    const phoneError = phoneField.nextElementSibling;
    const submitButton = form.querySelector('.btn-submit');
    const consentCheckbox = document.getElementById('consent');
    let formStartedAt = Date.now();
    let submissionId = createSubmissionId();
    let lastSubmissionFingerprint = null;
    let minimumSubmitAt = 0;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const phonePattern = /^[0-9+() -]{7,30}$/;
    let turnstileToken = '';
    let turnstileWidgetId = null;
    let submitting = false;
    let deliveryReviewRequired = false;

    function createUuid(cryptoApi) {
        const bytes = new Uint8Array(16);
        cryptoApi.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
        return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
    }

    function createSubmissionId() {
        return typeof window.crypto.randomUUID === 'function'
            ? window.crypto.randomUUID()
            : createUuid(window.crypto);
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('service') === 'speed-ad' && inquiryDetailsField.value.trim() === '') {
        inquiryDetailsField.value = 'SPEED ADについて相談したいです。';
    }

    function setFeedback(message, isError) {
        formFeedback.textContent = message;
        formFeedback.style.color = isError ? 'red' : '';
        formFeedback.setAttribute('role', isError ? 'alert' : 'status');
    }

    function setFieldError(field, errorElement, hasError) {
        field.classList.toggle('invalid', hasError);
        field.setAttribute('aria-invalid', String(hasError));
        errorElement.classList.toggle('error-visible', hasError);
    }

    function resetTurnstile() {
        turnstileToken = '';
        if (window.turnstile && turnstileWidgetId !== null) {
            window.turnstile.reset(turnstileWidgetId);
        }
    }

    function reinitializeSubmission() {
        submissionId = createSubmissionId();
        formStartedAt = Date.now();
        lastSubmissionFingerprint = null;
        minimumSubmitAt = formStartedAt + 3000;
        resetTurnstile();
    }

    function setDeliveryReviewRequired() {
        deliveryReviewRequired = true;
        turnstileToken = '';
        submitButton.disabled = true;
        setFeedback('お問い合わせの受付記録は保存されましたが、配信状況を確認中です。重複送信はせず、担当者からの連絡をお待ちください。', true);
    }

    function loadTurnstileScript() {
        return new Promise((resolve, reject) => {
            if (window.turnstile) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            script.async = true;
            script.defer = true;
            script.onload = resolve;
            script.onerror = () => reject(new Error('turnstile_script_failed'));
            document.head.appendChild(script);
        });
    }

    async function initializeTurnstile() {
        if (!apiBaseUrl) {
            throw new Error('contact_api_not_configured');
        }

        const [configResponse] = await Promise.all([
            fetch(`${apiBaseUrl}/config`, {
                method: 'GET',
                mode: 'cors',
                cache: 'no-store',
                credentials: 'omit'
            }),
            loadTurnstileScript()
        ]);

        if (!configResponse.ok) {
            throw new Error('contact_config_unavailable');
        }

        const config = await configResponse.json();
        if (!config.turnstileSiteKey) {
            throw new Error('turnstile_site_key_missing');
        }

        turnstileWidgetId = window.turnstile.render('#turnstile-container', {
            sitekey: config.turnstileSiteKey,
            action: config.turnstileAction || 'contact-submit',
            theme: 'light',
            callback: (token) => {
                turnstileToken = token;
                if (deliveryReviewRequired) {
                    submitButton.disabled = true;
                    return;
                }
                submitButton.disabled = false;
                setFeedback('', false);
            },
            'expired-callback': () => {
                turnstileToken = '';
                if (deliveryReviewRequired) {
                    submitButton.disabled = true;
                    return;
                }
                submitButton.disabled = true;
                setFeedback('確認の有効期限が切れました。もう一度確認してください。', true);
            },
            'error-callback': () => {
                turnstileToken = '';
                if (deliveryReviewRequired) {
                    submitButton.disabled = true;
                    return;
                }
                submitButton.disabled = true;
                setFeedback('bot対策の確認を読み込めませんでした。時間をおいて再度お試しいただくか、別の方法でご連絡ください。', true);
            }
        });
    }

    [emailField, phoneField].forEach((field) => {
        field.addEventListener('input', () => {
            if (field === emailField) {
                setFieldError(emailField, emailError, !emailPattern.test(emailField.value.trim()));
            } else {
                setFieldError(phoneField, phoneError, !phonePattern.test(phoneField.value.trim()));
            }
        });
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (submitting || deliveryReviewRequired) {
            return;
        }

        setFeedback('', false);
        setFieldError(emailField, emailError, false);
        setFieldError(phoneField, phoneError, false);

        if (!form.reportValidity()) {
            return;
        }
        if (!emailPattern.test(emailField.value.trim())) {
            setFieldError(emailField, emailError, true);
            emailField.focus();
            return;
        }
        if (!phonePattern.test(phoneField.value.trim())) {
            setFieldError(phoneField, phoneError, true);
            phoneField.focus();
            return;
        }
        if (!consentCheckbox.checked) {
            setFeedback('個人情報の取扱について同意をお願いします。', true);
            consentCheckbox.focus();
            return;
        }
        if (!turnstileToken) {
            setFeedback('bot対策の確認を完了してください。', true);
            return;
        }

        const fields = {
            enterprise: document.getElementById('enterprise').value,
            department: document.getElementById('department').value,
            name: document.getElementById('name').value,
            email: emailField.value,
            phone: phoneField.value,
            address: document.getElementById('address').value,
            inquiryDetails: inquiryDetailsField.value,
            consent: consentCheckbox.checked,
            website: document.getElementById('honeypot_email').value
        };
        const fingerprint = JSON.stringify(fields);
        if (lastSubmissionFingerprint !== null && lastSubmissionFingerprint !== fingerprint) {
            submissionId = createSubmissionId();
        }
        lastSubmissionFingerprint = fingerprint;

        if (Date.now() < minimumSubmitAt) {
            setFeedback('フォームを再初期化しました。bot対策の確認後、3秒ほど待ってから送信してください。', true);
            return;
        }

        submitting = true;
        submitButton.disabled = true;
        setFeedback('送信中です。', false);

        const payload = {
            submissionId,
            ...fields,
            formStartedAt,
            turnstileToken
        };

        try {
            const response = await fetch(`${apiBaseUrl}/submit`, {
                method: 'POST',
                mode: 'cors',
                cache: 'no-store',
                credentials: 'omit',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.ok) {
                if (result.code === 'form_expired') {
                    reinitializeSubmission();
                    submitting = false;
                    setFeedback('フォームの有効期限が切れました。入力内容を確認し、bot対策をもう一度完了してから3秒ほど待って送信してください。', true);
                    return;
                }
                if (result.code === 'request_id_conflict') {
                    reinitializeSubmission();
                    submitting = false;
                    setFeedback('送信内容の確認が必要です。入力内容を確認し、bot対策をもう一度完了してから手動で送信してください。', true);
                    return;
                }
                if (result.code === 'delivery_review_required') {
                    submitting = false;
                    setDeliveryReviewRequired();
                    return;
                }
                if (result.code === 'rate_limited') {
                    resetTurnstile();
                    submitting = false;
                    setFeedback('送信回数の上限に達しました。時間をおいてから、bot対策をもう一度完了して送信してください。', true);
                    return;
                }
                if (result.code === 'request_too_large') {
                    resetTurnstile();
                    submitting = false;
                    setFeedback('入力内容が長すぎます。内容を短くして、bot対策をもう一度完了してから送信してください。', true);
                    return;
                }
                throw new Error(result.code || 'contact_submit_failed');
            }

            window.location.href = 'thank.html';
        } catch (error) {
            submitting = false;
            submitButton.disabled = true;
            resetTurnstile();
            setFeedback('送信結果を確認できませんでした。入力内容は保持されています。同じ内容で手動で再送してください。', true);
        }
    });

    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        const targetSelector = anchor.getAttribute('href');
        if (!targetSelector || targetSelector.length <= 1) {
            return;
        }
        anchor.addEventListener('click', (event) => {
            const target = document.querySelector(targetSelector);
            if (!target) {
                return;
            }
            event.preventDefault();
            target.scrollIntoView({ behavior: 'smooth' });
        });
    });

    initializeTurnstile().catch(() => {
        submitButton.disabled = true;
        setFeedback('現在フォームを利用できません。時間をおいて再度お試しいただくか、下記メールアドレスまたは電話番号からご連絡ください。', true);
    });
}());
