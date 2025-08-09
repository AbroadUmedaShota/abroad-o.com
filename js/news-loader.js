document.addEventListener('DOMContentLoaded', () => {
  const newsContainer = document.getElementById('news-container');
  const newsList = document.getElementById('news-list');
  const paginationContainer = document.getElementById('pagination-container');

  if (!newsContainer || !newsList || !paginationContainer) {
    console.error('Required elements not found.');
    return;
  }

  const state = {
    newsData: [],
    currentPage: 1,
    itemsPerPage: 5
  };

  function displayNews(page = 1) {
    state.currentPage = page;
    newsContainer.innerHTML = '';

    const start = (state.currentPage - 1) * state.itemsPerPage;
    const end = start + state.itemsPerPage;
    const paginatedItems = state.newsData.slice(start, end);

    paginatedItems.forEach(newsItem => {
      const card = document.createElement('div');
      card.className = 'card mb-4 border shadow-sm';
      card.id = newsItem.id;

      const cardBody = document.createElement('div');
      cardBody.className = 'card-body card-body-custom-bg';
      cardBody.innerHTML = newsItem.content;

      const dateParagraph = document.createElement('p');
      dateParagraph.className = 'card-text';
      const small = document.createElement('small');
      small.className = 'text-muted';
      small.textContent = `作成日：${newsItem.date}`;
      dateParagraph.appendChild(small);
      cardBody.appendChild(dateParagraph);

      card.appendChild(cardBody);
      newsContainer.appendChild(card);
    });

    updateUI();

    const newsTopElement = document.getElementById('news_top');
    if (newsTopElement) {
        window.scrollTo(0, newsTopElement.offsetTop);
    }
  }

  function setupPagination() {
    paginationContainer.innerHTML = '';
    const pageCount = Math.ceil(state.newsData.length / state.itemsPerPage);
    if (pageCount <= 1) return;

    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Page navigation');
    const ul = document.createElement('ul');
    ul.className = 'pagination justify-content-center'; // 中央揃えクラスを追加

    const prevLi = document.createElement('li');
    prevLi.id = 'prev-page';
    const prevA = document.createElement('a');
    prevA.className = 'page-link';
    prevA.href = '#';
    prevA.setAttribute('aria-label', 'Previous');
    prevA.innerHTML = '<span aria-hidden="true">&laquo;</span>';
    prevA.addEventListener('click', (e) => {
        e.preventDefault();
        if (state.currentPage > 1) {
            displayNews(state.currentPage - 1);
        }
    });
    prevLi.appendChild(prevA);
    ul.appendChild(prevLi);

    for (let i = 1; i <= pageCount; i++) {
        const li = document.createElement('li');
        li.className = 'page-item';
        li.dataset.pageNumber = i;
        const a = document.createElement('a');
        a.className = 'page-link';
        a.href = '#';
        a.innerText = i;
        a.addEventListener('click', (e) => {
            e.preventDefault();
            displayNews(i);
        });
        li.appendChild(a);
        ul.appendChild(li);
    }

    const nextLi = document.createElement('li');
    nextLi.id = 'next-page';
    const nextA = document.createElement('a');
    nextA.className = 'page-link';
    nextA.href = '#';
    nextA.setAttribute('aria-label', 'Next');
    nextA.innerHTML = '<span aria-hidden="true">&raquo;</span>';
    nextA.addEventListener('click', (e) => {
        e.preventDefault();
        if (state.currentPage < pageCount) {
            displayNews(state.currentPage + 1);
        }
    });
    nextLi.appendChild(nextA);
    ul.appendChild(nextLi);

    nav.appendChild(ul);
    paginationContainer.appendChild(nav);
  }

  function updateUI() {
    updatePaginationUI();
    updateActiveListItems();
  }

  function updatePaginationUI() {
    const pageCount = Math.ceil(state.newsData.length / state.itemsPerPage);
    const prevLi = document.getElementById('prev-page');
    if (prevLi) {
        prevLi.className = state.currentPage === 1 ? 'page-item disabled' : 'page-item';
    }
    const nextLi = document.getElementById('next-page');
    if (nextLi) {
        nextLi.className = state.currentPage === pageCount ? 'page-item disabled' : 'page-item';
    }
    const pageLis = paginationContainer.querySelectorAll('li[data-page-number]');
    pageLis.forEach(li => {
        const pageNumber = parseInt(li.dataset.pageNumber, 10);
        li.className = pageNumber === state.currentPage ? 'page-item active' : 'page-item';
    });
  }

  function updateActiveListItems() {
    const listItems = newsList.getElementsByTagName('a');
    const start = (state.currentPage - 1) * state.itemsPerPage;
    const end = start + state.itemsPerPage;

    for (let i = 0; i < listItems.length; i++) {
      if (i >= start && i < end) {
        listItems[i].classList.add('active');
      } else {
        listItems[i].classList.remove('active');
      }
    }
  }

  function displayList() {
    newsList.innerHTML = '';
    state.newsData.forEach((newsItem, index) => {
      const link = document.createElement('a');
      const pageOfItem = Math.ceil((index + 1) / state.itemsPerPage);
      link.href = `#${newsItem.id}`;
      link.className = 'list-group-item list-group-item-action';
      link.textContent = `【${newsItem.date}】${newsItem.title}`;
      
      link.addEventListener('click', (event) => {
          event.preventDefault();
          displayNews(pageOfItem);
          setTimeout(() => {
              const targetElement = document.getElementById(newsItem.id);
              if (targetElement) {
                  targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
          }, 150);
      });
      newsList.appendChild(link);
    });
  }

  fetch('news.json')
    .then(response => response.json())
    .then(data => {
      state.newsData = data;
      displayList();
      displayNews(1);
    })
    .catch(error => {
      console.error('There has been a problem with your fetch operation:', error);
      newsContainer.innerHTML = '<p>ニュースの読み込みに失敗しました。</p>';
    });
});
