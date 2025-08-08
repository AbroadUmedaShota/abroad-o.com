const breadcrumbPaths = {
    'index.html': [{ name: 'アンケート一覧', link: 'index.html' }],
    'surveyCreation.html': [
        { name: 'アンケート一覧', link: 'index.html' },
        { name: 'アンケート作成・編集', link: 'surveyCreation.html' },
    ],
    'bizcardSettings.html': [
        { name: 'アンケート一覧', link: 'index.html' },
        { name: 'アンケート作成・編集', link: '#' }, // surveyIdが必要なため、動的に設定
        { name: '名刺データ化設定', link: 'bizcardSettings.html' },
    ],
    'thankYouEmailSettings.html': [
        { name: 'アンケート一覧', link: 'index.html' },
        { name: 'アンケート作成・編集', link: '#' }, // surveyIdが必要なため、動的に設定
        { name: 'お礼メール設定', link: 'thankYouEmailSettings.html' },
    ],
};

function generateBreadcrumbs(currentPage, surveyId = null) {
    const paths = breadcrumbPaths[currentPage];
    if (!paths) return '';

    const breadcrumbItems = paths.map((path, index) => {
        let link = path.link;
        // 動的リンクの処理
        if (link === '#' && surveyId) {
            link = `surveyCreation.html?surveyId=${surveyId}`;
        }

        const isLast = index === paths.length - 1;
        const linkElement = isLast
            ? `<span class="text-on-surface-variant font-medium">${path.name}</span>`
            : `<a href="${link}" class="text-secondary hover:underline">${path.name}</a>`;

        const separator = isLast ? '' : `<span class="material-icons text-on-surface-variant mx-1">chevron_right</span>`;

        return `<li class="flex items-center">${linkElement}${separator}</li>`;
    }).join('');

    return `<nav aria-label="Breadcrumb"><ol class="flex items-center space-x-1 text-sm">${breadcrumbItems}</ol></nav>`;
}

export function initBreadcrumbs() {
    const container = document.getElementById('breadcrumb-container');
    if (!container) return;

    const currentPage = window.location.pathname.split('/').pop();
    const urlParams = new URLSearchParams(window.location.search);
    const surveyId = urlParams.get('surveyId');

    container.innerHTML = generateBreadcrumbs(currentPage, surveyId);
}
