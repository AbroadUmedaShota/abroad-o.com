export function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    
    const themeIcons = [document.getElementById('themeIcon'), document.getElementById('sidebarThemeIcon')];
    themeIcons.forEach(iconElement => {
        if (iconElement) {
            iconElement.textContent = isDarkMode ? 'dark_mode' : 'light_mode';
        }
    });
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
}

export function initThemeToggle() {
    const themeToggles = [document.getElementById('themeToggle'), document.getElementById('sidebarThemeToggle')];
    const themeIcons = [document.getElementById('themeIcon'), document.getElementById('sidebarThemeIcon')];

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeIcons.forEach(icon => { if(icon) icon.textContent = 'dark_mode'; });
    } else {
        themeIcons.forEach(icon => { if(icon) icon.textContent = 'light_mode'; });
    }

    if (themeToggles[0]) themeToggles[0].addEventListener('click', toggleTheme);
    if (themeToggles[1]) themeToggles[1].addEventListener('click', toggleTheme);
}
