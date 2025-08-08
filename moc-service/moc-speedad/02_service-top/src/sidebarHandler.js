import { lockScroll, unlockScroll, showToast } from './utils.js';
import { fetchGroups } from './groupService.js';
import { setGroupFilter } from './tableManager.js';

const sidebar = document.getElementById('sidebar');
const sidebarToggleMobile = document.getElementById('sidebarToggleMobile');
const mobileSidebarOverlay = document.getElementById('mobileSidebarOverlay');

/** Handles opening/closing of the mobile sidebar. */
export function toggleMobileSidebar() {
    const isOpen = sidebar.classList.contains('is-open-mobile');
    if (isOpen) {
        sidebar.classList.remove('is-open-mobile');
        mobileSidebarOverlay.classList.remove('is-visible');
        unlockScroll();
    } else {
        sidebar.classList.add('is-open-mobile');
        mobileSidebarOverlay.classList.add('is-visible');
        lockScroll();
    }
}

/** Adjusts layout based on screen size (PC vs Mobile sidebar behavior). */
/** Adjusts layout based on screen size (PC vs Mobile sidebar behavior). */
export function adjustLayout() {
    const isModalOpen = document.querySelector('.modal-overlay[data-state="open"]');

    if (window.innerWidth >= 1024) { // PC screens (LG and XL)
        sidebar.classList.remove('is-open-mobile');
        mobileSidebarOverlay.classList.remove('is-visible');
        if (!isModalOpen) {
            unlockScroll();
        }
    } else { // For screens smaller than LG (mobile/small tablet)
        const isMobileSidebarOpen = sidebar.classList.contains('is-open-mobile');
        if (!isMobileSidebarOpen && !isModalOpen) {
            unlockScroll();
        }
    }
    
    if (window.innerWidth >= 1024) { // PC screens (LG and up)
        sidebar.onmouseenter = () => document.body.classList.add('sidebar-hovered');
        sidebar.onmouseleave = () => document.body.classList.remove('sidebar-hovered');
    } else {
        // Clear listeners and class for smaller screens
        sidebar.onmouseenter = null;
        sidebar.onmouseleave = null;
        document.body.classList.remove('sidebar-hovered');
    }
}

/**
 * グループ選択ドロップダウンを動的に生成する。
 */
async function populateGroupSelect() {
    const userSelect = document.getElementById('user_select');
    if (!userSelect) return;

    // 既存のオプションをクリア
    userSelect.innerHTML = '';

    // デフォルトオプションを追加
    const defaultOption = document.createElement('option');
    defaultOption.value = 'current';
    defaultOption.textContent = 'Current Group'; // または適切なデフォルト名
    userSelect.appendChild(defaultOption);

    try {
        const groups = await fetchGroups();
        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            userSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to fetch groups for sidebar:', error);
        showToast('グループの読み込みに失敗しました。 ', 'error');
    }
}

export function initSidebarHandler() {
    // Event listener for mobile hamburger menu
    if (sidebarToggleMobile) sidebarToggleMobile.addEventListener('click', toggleMobileSidebar);
    // Event listener for clicking on mobile overlay
    if (mobileSidebarOverlay) mobileSidebarOverlay.addEventListener('click', toggleMobileSidebar);

    // Close mobile sidebar if a nav item is clicked
    sidebar.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (event) => {
            if (window.innerWidth < 1024) { // Only close on mobile
                if (!event.target.closest('[onclick^="handleOpenModal("]')) {
                    toggleMobileSidebar();
                }
            }
        });
    });

    // Logout button
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            showToast('ログアウト機能は未実装です。', 'info');
        });
    }

    const newGroupButton = document.querySelector('.sidebar-group-control button[aria-label="グループを新規作成"]');
    if (newGroupButton) {
        newGroupButton.addEventListener('click', () => {
            handleOpenModal('newGroupModal', 'modals/newGroupModal.html');
        });
    }

    // Group switch button
    const groupSwitchButton = document.querySelector('.sidebar-group-control button[aria-label="グループを切り替える"]');
    if (groupSwitchButton) {
        groupSwitchButton.addEventListener('click', () => {
            const selectedGroupId = document.getElementById('user_select').value;
            setGroupFilter(selectedGroupId === 'current' ? null : selectedGroupId); // 'current'の場合はnullを渡す
            showToast(`グループを ${selectedGroupId} に切り替えました。`, 'info');
        });
    }

    // Populate group select dropdown
    populateGroupSelect();

    // Initial adjustment on load
    adjustLayout();
    
    // Adjust on window resize
    window.addEventListener('resize', adjustLayout);

    // Set active state for the current page link
    const currentPage = window.location.pathname.split('/').pop();
    sidebar.querySelectorAll('nav a').forEach(link => {
        const linkPage = link.getAttribute('href').split('/').pop();
        if (linkPage === currentPage) {
            link.classList.add('active');
        }
    });
}
