import { handleOpenModal } from './modalHandler.js';
import { showToast } from './utils.js';

// ダミーユーザーデータ (本来はAPIから取得)
// windowオブジェクトにアタッチすることで、HTMLのonclickから参照可能にする
window.dummyUserData = {
    email: "user@example.com",
    companyName: "株式会社SpeedAd", // テスト用に値を入れておく
    departmentName: "開発部", // テスト用に値を入れておく
    positionName: "エンジニア", // テスト用に値を入れておく
    lastName: "田中",
    firstName: "太郎",
    phoneNumber: "09012345678",
    postalCode: "100-0001",
    address: "東京都千代田区千代田1-1",
    buildingFloor: "皇居ビルディング 1F",
    billingAddressType: "same", // or "different"
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
 * Account Info Modalを開き、データを設定する。
 * @param {object} userData 表示するユーザーデータ
 */
export async function openAccountInfoModal(userData) {
    await handleOpenModal('accountInfoModal', 'modals/accountInfoModal.html');
    // モーダルがDOMにロードされた後、専用の初期化処理とデータ投入を行う
    initializeAccountInfoModalFunctionality(document.getElementById('accountInfoModal')); // モーダル要素を渡す
    populateAccountInfoModal(userData); // データ投入
};

/**
 * Account Info Modal内の動的な機能（セクションの開閉、請求先住所の表示切り替え）を初期化する。
 * モーダルがDOMにロードされるたびに呼び出す。
 * @param {HTMLElement} modalElement モーダルのルート要素
 */
export function initializeAccountInfoModalFunctionality(modalElement) {
    // セクション開閉機能
    modalElement.querySelectorAll('.section-header').forEach(header => { // modalElement から探索
        // 重複登録防止のため、一度リスナーを削除してから追加
        header.removeEventListener('click', toggleSectionContent);
        header.addEventListener('click', toggleSectionContent);
    });

    // 請求先住所の表示切り替え
    const billingAddressTypeRadios = modalElement.querySelectorAll('input[name="billingAddressType"]'); // modalElement から探索
    const billingDetailsSection = modalElement.querySelector('#billingDetailsSection'); // modalElement から探索
    
    if (billingAddressTypeRadios.length > 0 && billingDetailsSection) {
        // 重複登録防止のため、一度リスナーを削除してから追加
        billingAddressTypeRadios.forEach(radio => {
            radio.removeEventListener('change', toggleBillingDetails);
            radio.addEventListener('change', toggleBillingDetails);
        });
        // 初回ロード時の状態は populateAccountInfoModal の最後で設定するため、ここでは呼び出さない
    }
}

/**
 * セクションの展開/折りたたみを行う。
 * @param {Event} event クリックイベント
 */
function toggleSectionContent(event) {
    const header = event.currentTarget;
    const contentId = header.getAttribute('aria-controls');
    const content = document.getElementById(contentId);
    const isExpanded = header.getAttribute('aria-expanded') === 'true';
    const icon = header.querySelector('.expand-icon');

    if (content) {
        if (isExpanded) {
            // 折りたたむ
            header.setAttribute('aria-expanded', 'false');
            icon.textContent = 'expand_more';
            content.style.height = content.scrollHeight + 'px'; // 現在の高さを設定してから
            requestAnimationFrame(() => {
                content.classList.add('hidden');
                content.style.height = ''; // hiddenクラスがheightを0にするので、ここで高さをリセット
            });
        } else {
            // 展開する
            header.setAttribute('aria-expanded', 'true');
            icon.textContent = 'expand_less';
            content.classList.remove('hidden');
            // heightをautoにする前にscrollHeightを設定してtransitionを効かせる
            content.style.height = content.scrollHeight + 'px';
            // transition完了後にheightをautoに戻す (コンテンツの変化に対応するため)
            const onTransitionEnd = () => {
                content.style.height = '';
                content.removeEventListener('transitionend', onTransitionEnd);
            };
            content.addEventListener('transitionend', onTransitionEnd);
        }
    }
}

/**
 * 「ご請求書の宛名」ラジオボタンに応じて請求先詳細の表示/非表示を切り替える。
 */
function toggleBillingDetails() {
    const billingSame = document.getElementById('billingSame');
    const billingDifferent = document.getElementById('billingDifferent');
    const billingDetailsSection = document.getElementById('billingDetailsSection');

    if (billingDetailsSection) {
        if (billingDifferent && billingDifferent.checked) {
            billingDetailsSection.classList.remove('hidden');
        } else {
            billingDetailsSection.classList.add('hidden');
        }
    }
}

/**
 * Account Info Modalにユーザーデータを投入する。
 * @param {object} userData 投入するユーザーデータオブジェクト
 */
export function populateAccountInfoModal(userData) {
    const modal = document.getElementById('accountInfoModal');
    if (!modal) return;

    // メールアドレス (readonly)
    const userEmailInput = modal.querySelector('#userEmail');
    if (userEmailInput) userEmailInput.value = userData.email || "";

    // 会社情報
    const companyNameInput = modal.querySelector('#companyName');
    if (companyNameInput) companyNameInput.value = userData.companyName || "";
    const departmentNameInput = modal.querySelector('#departmentName');
    if (departmentNameInput) departmentNameInput.value = userData.departmentName || "";
    const positionNameInput = modal.querySelector('#positionName');
    if (positionNameInput) positionNameInput.value = userData.positionName || "";

    // 個人連絡先
    const lastNameInput = modal.querySelector('#lastName');
    if (lastNameInput) lastNameInput.value = userData.lastName || "";
    const firstNameInput = modal.querySelector('#firstName');
    if (firstNameInput) firstNameInput.value = userData.firstName || "";
    const phoneNumberInput = modal.querySelector('#phoneNumber');
    if (phoneNumberInput) phoneNumberInput.value = userData.phoneNumber || "";
    const postalCodeInput = modal.querySelector('#postalCode');
    if (postalCodeInput) postalCodeInput.value = userData.postalCode || "";
    const addressInput = modal.querySelector('#address');
    if (addressInput) addressInput.value = userData.address || "";
    const buildingFloorInput = modal.querySelector('#buildingFloor');
    if (buildingFloorInput) buildingFloorInput.value = userData.buildingFloor || "";

    // ご請求書の宛名 (ラジオボタン)
    const billingSameRadio = modal.querySelector('#billingSame');
    const billingDifferentRadio = modal.querySelector('#billingDifferent');
    if (userData.billingAddressType === 'different') {
        if (billingDifferentRadio) billingDifferentRadio.checked = true;
    } else {
        if (billingSameRadio) billingSameRadio.checked = true;
    }
    toggleBillingDetails(); // ラジオボタンの状態に応じて請求先詳細の表示を切り替え (ここが正しいタイミング)

    // 請求先詳細 (条件付き表示)
    const billingCompanyNameInput = modal.querySelector('#billingCompanyName');
    if (billingCompanyNameInput) billingCompanyNameInput.value = userData.billingCompanyName || "";
    const billingDepartmentNameInput = modal.querySelector('#billingDepartmentName');
    if (billingDepartmentNameInput) billingDepartmentNameInput.value = userData.billingDepartmentName || "";
    const billingLastNameInput = modal.querySelector('#billingLastName');
    if (billingLastNameInput) billingLastNameInput.value = userData.billingLastName || "";
    const billingFirstNameInput = modal.querySelector('#billingFirstName');
    if (billingFirstNameInput) billingFirstNameInput.value = userData.billingFirstName || "";
    const billingPhoneNumberInput = modal.querySelector('#billingPhoneNumber');
    if (billingPhoneNumberInput) billingPhoneNumberInput.value = userData.billingPhoneNumber || "";
    const billingPostalCodeInput = modal.querySelector('#billingPostalCode');
    if (billingPostalCodeInput) billingPostalCodeInput.value = userData.billingPostalCode || "";
    const billingAddressInput = modal.querySelector('#billingAddress');
    if (billingAddressInput) billingAddressInput.value = userData.billingAddress || "";
    const billingBuildingFloorInput = modal.querySelector('#buildingFloor');
    if (billingBuildingFloorInput) billingBuildingFloorInput.value = userData.billingBuildingFloor || "";
}
