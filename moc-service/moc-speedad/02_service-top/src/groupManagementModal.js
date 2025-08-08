import { showToast } from './utils.js';
import { closeModal } from './modalHandler.js';
import { createGroup, updateGroup, deleteGroup, fetchGroups, getGroupsInMemory } from './groupService.js';

let currentMembers = []; // モーダル内で管理するメンバーリスト
let currentGroupId = null; // 現在編集中のグループのID

/**
 * グループ管理モーダルのUI要素にイベントリスナーを設定し、初期状態を準備する。
 * モーダルがDOMにロードされるたびに呼び出す。
 * @param {HTMLElement} modalElement モーダルのルート要素
 * @param {string|null} groupId 編集するグループのID。新規作成の場合はnull。
 */
export async function initGroupManagementModal(modalElement, groupId = null) {
    currentGroupId = groupId;
    const groupForm = modalElement.querySelector('#groupForm');
    const addMemberBtn = modalElement.querySelector('#addMemberBtn');
    const memberEmailInput = modalElement.querySelector('#memberEmail');
    const memberRoleSelect = modalElement.querySelector('#memberRole');
    const memberListContainer = modalElement.querySelector('#memberList');
    const noMembersMessage = modalElement.querySelector('#noMembersMessage');
    const deleteGroupSection = modalElement.querySelector('#groupDeleteSection');
    const deleteGroupBtn = modalElement.querySelector('#deleteGroupBtn');
    const modalTitle = modalElement.querySelector('#newGroupModalTitle');
    const submitButton = groupForm.querySelector('button[type="submit"]');

    // イベントリスナーの重複登録を防ぐために、既存のリスナーを削除してから追加
    if (groupForm) groupForm.removeEventListener('submit', handleGroupFormSubmit);
    if (groupForm) groupForm.addEventListener('submit', handleGroupFormSubmit);

    if (addMemberBtn) addMemberBtn.removeEventListener('click', handleAddMember);
    if (addMemberBtn) addMemberBtn.addEventListener('click', handleAddMember);

    if (deleteGroupBtn) deleteGroupBtn.removeEventListener('click', handleDeleteGroup);
    if (deleteGroupBtn) deleteGroupBtn.addEventListener('click', handleDeleteGroup);

    // メンバーリストの初期化
    currentMembers = [];

    if (currentGroupId) {
        // 編集モード
        modalTitle.textContent = 'グループ情報編集';
        submitButton.textContent = '更新する';
        deleteGroupSection.classList.remove('hidden');
        const allGroups = await fetchGroups(); // 最新のグループデータを取得
        const groupToEdit = allGroups.find(g => g.id === currentGroupId);
        if (groupToEdit) {
            populateGroupForm(groupToEdit);
        } else {
            showToast('指定されたグループが見つかりません。新規作成モードで開きます。 ', 'error');
            currentGroupId = null; // 見つからない場合は新規作成モードに切り替える
            modalTitle.textContent = 'グループ新規作成';
            submitButton.textContent = '作成する';
            deleteGroupSection.classList.add('hidden');
        }
    } else {
        // 新規作成モード
        modalTitle.textContent = 'グループ新規作成';
        submitButton.textContent = '作成する';
        deleteGroupSection.classList.add('hidden');
        // フォームをクリア
        groupForm.reset();
    }
    renderMemberList();
}

/**
 * グループフォームの送信を処理する。
 * @param {Event} event
 */
async function handleGroupFormSubmit(event) {
    event.preventDefault();

    const groupNameInput = document.getElementById('groupName');
    const groupDescriptionInput = document.getElementById('groupDescription');
    const allowBillingInfoViewCheckbox = document.getElementById('allowBillingInfoView');

    const groupData = {
        name: groupNameInput.value.trim(),
        description: groupDescriptionInput.value.trim(),
        members: currentMembers,
        permissions: {
            allowBillingInfoView: allowBillingInfoViewCheckbox.checked
        }
    };

    if (!groupData.name) {
        showToast('グループ名は必須です。 ', 'error');
        return;
    }

    try {
        if (currentGroupId) {
            // 更新
            await updateGroup(currentGroupId, groupData);
            showToast('グループ情報が更新されました！ ', 'success');
        } else {
            // 新規作成
            await createGroup(groupData);
            showToast('グループが新規作成されました！ ', 'success');
        }
        closeModal('newGroupModal');
        // TODO: グループ一覧を再読み込みする処理を呼び出す
    } catch (error) {
        console.error('Error saving group:', error);
        showToast('グループの保存に失敗しました。 ', 'error');
    }
}

/**
 * メンバー追加ボタンのクリックを処理する。
 */
function handleAddMember() {
    const memberEmailInput = document.getElementById('memberEmail');
    const memberRoleSelect = document.getElementById('memberRole');

    const email = memberEmailInput.value.trim();
    const role = memberRoleSelect.value;

    if (!email) {
        showToast('メールアドレスを入力してください。 ', 'error');
        return;
    }
    if (!isValidEmail(email)) {
        showToast('有効なメールアドレスを入力してください。 ', 'error');
        return;
    }
    if (currentMembers.some(member => member.email === email)) {
        showToast('このメンバーは既に追加されています。 ', 'error');
        return;
    }

    currentMembers.push({ email, role });
    memberEmailInput.value = ''; // 入力フィールドをクリア
    renderMemberList();
    showToast(`${email} を追加しました。`, 'success');
}

/**
 * メンバーリストをレンダリングする。
 */
function renderMemberList() {
    const memberListContainer = document.getElementById('memberList');
    const noMembersMessage = document.getElementById('noMembersMessage');

    if (!memberListContainer) return;

    memberListContainer.innerHTML = ''; // Clear existing list

    if (currentMembers.length === 0) {
        memberListContainer.appendChild(noMembersMessage);
        noMembersMessage.classList.remove('hidden');
    } else {
        noMembersMessage.classList.add('hidden');
        currentMembers.forEach((member, index) => {
            const memberDiv = document.createElement('div');
            memberDiv.className = 'flex items-center justify-between p-2 border-b border-outline-variant last:border-b-0';
            memberDiv.innerHTML = `
                <span class="text-on-surface text-sm">${member.email} (${member.role === 'admin' ? '管理者' : '一般メンバー'})</span>
                <button type="button" class="text-error hover:text-error-container material-icons text-base" data-index="${index}" title="メンバーを削除">
                    delete
                </button>
            `;
            memberDiv.querySelector('button').addEventListener('click', handleRemoveMember);
            memberListContainer.appendChild(memberDiv);
        });
    }
}

/**
 * メンバー削除ボタンのクリックを処理する。
 * @param {Event} event
 */
function handleRemoveMember(event) {
    const indexToRemove = parseInt(event.currentTarget.dataset.index, 10);
    const removedMember = currentMembers.splice(indexToRemove, 1)[0];
    renderMemberList();
    showToast(`${removedMember.email} を削除しました。`, 'success');
}

/**
 * グループ削除ボタンのクリックを処理する。
 */
async function handleDeleteGroup() {
    if (!currentGroupId) {
        showToast('削除するグループが指定されていません。 ', 'error');
        return;
    }

    if (confirm('本当にこのグループを削除しますか？この操作は元に戻せません。 ')) {
        try {
            await deleteGroup(currentGroupId);
            showToast('グループが削除されました！ ', 'success');
            closeModal('newGroupModal');
            // TODO: グループ一覧を再読み込みする処理を呼び出す
        } catch (error) {
            console.error('Error deleting group:', error);
            showToast('グループの削除に失敗しました。 ', 'error');
        }
    }
}

/**
 * メールアドレスの形式を検証する。
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
    // 簡易的なメールアドレスの正規表現
    return /^.+@.+\..+$/.test(email);
}

/**
 * フォームにグループデータを投入する。
 * @param {object} groupData 投入するグループデータ
 */
function populateGroupForm(groupData) {
    document.getElementById('groupName').value = groupData.name || '';
    document.getElementById('groupDescription').value = groupData.description || '';
    document.getElementById('allowBillingInfoView').checked = groupData.permissions?.allowBillingInfoView || false;
    currentMembers = groupData.members || [];
    renderMemberList();
}