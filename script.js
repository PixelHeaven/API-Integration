document.addEventListener('DOMContentLoaded', function() {
    // Application state
    const appState = {
        currentPage: 1,
        resultsPerPage: 20,
        totalResults: 0,
        searchHistory: [],
        savedSearches: [],
        settings: {
            theme: 'light',
            codeFontSize: 14,
            apiEndpoint: 'https://sourcegraph.com/.api/graphql',
            apiToken: '',
            defaultCaseSensitive: false,
            defaultIncludeContext: true,
            defaultResultsLimit: 50
        }
    };

    // DOM Elements
    const elements = {
        // Theme toggle
        themeToggle: document.getElementById('themeToggle'),
        
        // Search elements
        searchQuery: document.getElementById('searchQuery'),
        searchButton: document.getElementById('searchButton'),
        clearSearch: document.getElementById('clearSearch'),
        advancedOptionsToggle: document.getElementById('advancedOptionsToggle'),
        advancedOptions: document.getElementById('advancedOptions'),
        saveSearchBtn: document.getElementById('saveSearchBtn'),
        searchTags: document.getElementById('searchTags'),
        
        // Filter elements
        languageFilter: document.getElementById('languageFilter'),
        repoFilter: document.getElementById('repoFilter'),
        patternType: document.getElementById('patternType'),
        resultsLimit: document.getElementById('resultsLimit'),
        caseSensitive: document.getElementById('caseSensitive'),
        includeContext: document.getElementById('includeContext'),
        
        // Results elements
        resultsContainer: document.getElementById('resultsContainer'),
        loading: document.getElementById('loading'),
        emptyState: document.getElementById('emptyState'),
        results: document.getElementById('results'),
        resultsStats: document.getElementById('resultsStats'),
        pagination: document.getElementById('pagination'),
        sortOrder: document.getElementById('sortOrder'),
        listView: document.getElementById('listView'),
        gridView: document.getElementById('gridView'),
        
        // Sidebar elements
        sidebarToggle: document.getElementById('sidebar-toggle'),
        searchHistory: document.getElementById('searchHistory'),
        savedSearches: document.getElementById('savedSearches'),
        
        // Modals
        settingsBtn: document.getElementById('settingsBtn'),
        settingsModal: document.getElementById('settingsModal'),
        keyboardShortcutsModal: document.getElementById('keyboardShortcutsModal'),
        codePreviewModal: document.getElementById('codePreviewModal'),
        
        // Settings elements
        apiEndpoint: document.getElementById('apiEndpoint'),
        apiToken: document.getElementById('apiToken'),
        defaultCaseSensitive: document.getElementById('defaultCaseSensitive'),
        defaultIncludeContext: document.getElementById('defaultIncludeContext'),
        defaultResultsLimit: document.getElementById('defaultResultsLimit'),
        codeFontSize: document.getElementById('codeFontSize'),
        fontSizeValue: document.getElementById('fontSizeValue'),
        saveSettings: document.getElementById('saveSettings'),
        
        // Code preview elements
        codePreview: document.getElementById('codePreview'),
        previewFileName: document.getElementById('previewFileName'),
        previewRepoPath: document.getElementById('previewRepoPath'),
        openInSourcegraph: document.getElementById('openInSourcegraph'),
        copyFilePathBtn: document.getElementById('copyFilePathBtn'),
        
        // Toast container
        toastContainer: document.getElementById('toastContainer')
    };

    // Initialize the application
    initApp();
    
    /*
     * Core Functions
     */
    
    function initApp() {
        loadSettings();
        applyTheme();
        setupEventListeners();
        updateUIFromSettings();
        loadSearchHistory();
        loadSavedSearches();
    }
    
    function setupEventListeners() {
        // Theme toggle
        elements.themeToggle.addEventListener('click', toggleTheme);
        
        // Search functionality
        elements.searchButton.addEventListener('click', performSearch);
        elements.searchQuery.addEventListener('keypress', e => {
            if (e.key === 'Enter') performSearch();
        });
        elements.clearSearch.addEventListener('click', clearSearch);
        elements.advancedOptionsToggle.addEventListener('click', toggleAdvancedOptions);
        elements.saveSearchBtn.addEventListener('click', saveCurrentSearch);
        
        // Results view
        elements.listView.addEventListener('click', () => switchView('list'));
        elements.gridView.addEventListener('click', () => switchView('grid'));
        elements.sortOrder.addEventListener('change', sortResults);
        
        // Sidebar toggle
        elements.sidebarToggle.addEventListener('click', toggleSidebar);
        
        // Settings modal
        elements.settingsBtn.addEventListener('click', () => showModal(elements.settingsModal));
        elements.saveSettings.addEventListener('click', saveSettings);
        
        // Theme buttons
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme;
                setTheme(theme);
                updateThemeButtons(theme);
            });
        });
        
        // Font size slider
        elements.codeFontSize.addEventListener('input', updateFontSize);
        
        // Close modals
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', e => {
                const modal = e.target.closest('.modal');
                hideModal(modal);
            });
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboardShortcuts);
        
        // Copy file path
        elements.copyFilePathBtn.addEventListener('click', copyFilePath);
    }
    
    function performSearch() {
        const query = elements.searchQuery.value.trim();
        if (!query) {
            showToast('error', 'Error', 'Please enter a search query');
            return;
        }
        
        const searchParams = getSearchParams();
        
        // Show loading state
        elements.emptyState.classList.add('hidden');
        elements.results.innerHTML = '';
        elements.loading.classList.remove('hidden');
        elements.resultsStats.textContent = 'Searching...';
        
        // Add to search history
        addToSearchHistory(searchParams);
        
        // Update search tags
        updateSearchTags(searchParams);
        
        // Make API request
        fetchSearchResults(searchParams)
            .then(data => {
                elements.loading.classList.add('hidden');
                displayResults(data, searchParams);
            })
            .catch(error => {
                elements.loading.classList.add('hidden');
                elements.results.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-circle"></i>
                        <h3>An error occurred</h3>
                        <p>${error.message}</p>
                    </div>
                `;
                elements.resultsStats.textContent = 'Error occurred';
                showToast('error', 'Search Error', error.message);
            });
    }
    
    function getSearchParams() {
        return {
            query: elements.searchQuery.value.trim(),
            language: elements.languageFilter.value,
            repository: elements.repoFilter.value.trim(),
            patternType: elements.patternType.value,
            caseSensitive: elements.caseSensitive.checked,
            includeContext: elements.includeContext.checked,
            limit: parseInt(elements.resultsLimit.value),
            page: appState.currentPage,
            timestamp: new Date().toISOString()
        };
    }
    
    async function fetchSearchResults(params) {
        const apiEndpoint = appState.settings.apiEndpoint;
        
        // Build the full query
        let fullQuery = params.query;
        
        if (params.language) {
            fullQuery += ` ${params.language}`;
        }
        
        if (params.repository) {
            fullQuery += ` repo:${params.repository}`;
        }
        
        if (params.caseSensitive) {
            fullQuery += ' case:yes';
        }
        
        const graphqlQuery = {
            query: `
            query Search($query: String!, $patternType: SearchPatternType!, $limit: Int!) {
                search(query: $query, version: V2, patternType: $patternType, first: $limit) {
                    results {
                        limitHit
                        matchCount
                        approximateResultCount
                        missing {
                            name
                        }
                        cloning {
                            name
                        }
                        timedout {
                            name
                        }
                        results {
                            __typename
                            ... on FileMatch {
                                repository {
                                    name
                                    url
                                }
                                file {
                                    path
                                    url
                                    content
                                    commit {
                                        oid
                                        author {
                                            date
                                        }
                                    }
                                }
                                lineMatches {
                                    lineNumber
                                    offsetAndLengths
                                    preview
                                }
                            }
                        }
                    }
                }
            }`,
            variables: {
                query: fullQuery,
                patternType: params.patternType.toUpperCase(),
                limit: params.limit
            }
        };
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Add API token if available
        if (appState.settings.apiToken) {
            headers['Authorization'] = `token ${appState.settings.apiToken}`;
        }
        
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(graphqlQuery)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        
        if (data.errors && data.errors.length > 0) {
            throw new Error(`GraphQL Error: ${data.errors[0].message}`);
        }
        
        return data;
    }
    
    function displayResults(data, searchParams) {
        if (!data.data || !data.data.search || !data.data.search.results) {
            elements.results.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>No results found</h3>
                    <p>Try adjusting your search query or filters</p>
                </div>
            `;
            elements.resultsStats.textContent = 'No results found';
            return;
        }
        
        const searchResults = data.data.search.results;
        const matchCount = searchResults.matchCount || 0;
        const approximateCount = searchResults.approximateResultCount || 0;
        const isLimitHit = searchResults.limitHit || false;
        
        // Update application state
        appState.totalResults = approximateCount;
        
        // Update results stats
        let statsText = `Found ${matchCount} ${matchCount === 1 ? 'match' : 'matches'}`;
        if (isLimitHit) {
            statsText += ' (limit hit)';
        }
        elements.resultsStats.textContent = statsText;
        
        // Check if we have results
        const results = searchResults.results;
        if (!results || results.length === 0) {
            elements.results.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>No results found</h3>
                    <p>Try adjusting your search query or filters</p>
                </div>
            `;
            return;
        }
        
        // Display results
        elements.results.innerHTML = '';
        results.forEach(result => {
            if (result.__typename === 'FileMatch') {
                const fileMatch = createFileMatchElement(result, searchParams.includeContext);
                elements.results.appendChild(fileMatch);
            }
        });
        
        // Update pagination
        updatePagination();
        
        // Apply current view
        const currentView = elements.resultsContainer.classList.contains('grid-view') ? 'grid' : 'list';
        switchView(currentView, false);
    }
    
    function createFileMatchElement(result, includeContext) {
        const repository = result.repository;
        const file = result.file;
        const lineMatches = result.lineMatches;
        
        const repoName = repository.name;
        const filePath = file.path;
        const fileUrl = file.url;
        
        // Create result card element
        const resultCard = document.createElement('div');
        resultCard.className = 'result-card';
        
        // Create header with file info
        const header = document.createElement('div');
        header.className = 'result-header';
        header.innerHTML = `
            <div class="result-file">${filePath.split('/').pop()}</div>
            <div class="result-repo">${repoName}/${filePath}</div>
        `;
        
        // Create content with code preview
        const content = document.createElement('div');
        content.className = 'result-content';
        
        const codePreview = document.createElement('div');
        codePreview.className = 'result-match';
        
        // Format line matches with syntax highlighting
        let matchesHtml = '';
        
        if (lineMatches && lineMatches.length > 0) {
            const contextLines = includeContext ? 2 : 0;
            
            // Get unique line numbers from matches
            const matchedLines = new Set();
            lineMatches.forEach(match => matchedLines.add(match.lineNumber));
            
            // Expand with context lines
            const linesToShow = new Set(matchedLines);
            if (contextLines > 0) {
                matchedLines.forEach(lineNum => {
                    for (let i = Math.max(1, lineNum - contextLines); i <= lineNum + contextLines; i++) {
                        linesToShow.add(i);
                    }
                });
            }
            
            // Convert to sorted array
            const sortedLines = Array.from(linesToShow).sort((a, b) => a - b);
            
            // Create HTML with line numbers and highlights
            const fileContent = file.content ? file.content.split('\n') : [];
            let lastLineShown = 0;
            
            sortedLines.forEach(lineNum => {
                // Add a separator if lines are not consecutive
                if (lastLineShown > 0 && lineNum > lastLineShown + 1) {
                    matchesHtml += `<div class="line-separator">...</div>`;
                }
                
                const lineContent = fileContent[lineNum - 1] || '';
                const isMatchedLine = matchedLines.has(lineNum);
                
                // Find highlights for this line
                let highlightedLine = lineContent;
                
                if (isMatchedLine) {
                    const match = lineMatches.find(m => m.lineNumber === lineNum);
                    if (match && match.offsetAndLengths) {
                        // Apply highlights
                        highlightedLine = applyHighlights(lineContent, match.offsetAndLengths);
                    }
                }
                
                // Escape HTML for security (already done in applyHighlights)
                if (!isMatchedLine) {
                    highlightedLine = escapeHTML(highlightedLine);
                }
                
                const lineClass = isMatchedLine ? 'matched-line' : 'context-line';
                matchesHtml += `
                    <div class="code-line ${lineClass}">
                        <span class="line-number">${lineNum}</span>
                        <span class="line-content">${highlightedLine}</span>
                    </div>
                `;
                
                lastLineShown = lineNum;
            });
        }
        
        codePreview.innerHTML = matchesHtml;
        content.appendChild(codePreview);
        
        // Create footer with metadata and actions
        const footer = document.createElement('div');
        footer.className = 'result-footer';
        
        const commitDate = file.commit && file.commit.author ? new Date(file.commit.author.date) : null;
        const formattedDate = commitDate ? formatDate(commitDate) : 'Unknown date';
        
        footer.innerHTML = `
            <div class="result-meta">
                Last updated: ${formattedDate}
            </div>
            <div class="result-actions">
                <button class="btn-icon view-file-btn" title="View file">
                    <i class="fas fa-eye"></i>
                </button>
                <a href="${fileUrl}" target="_blank" class="btn-icon" title="Open in Sourcegraph">
                    <i class="fas fa-external-link-alt"></i>
                </a>
                <button class="btn-icon copy-path-btn" title="Copy file path" data-path="${repoName}/${filePath}">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
        `;
        
        // Assemble the card
        resultCard.appendChild(header);
        resultCard.appendChild(content);
        resultCard.appendChild(footer);
        
        // Add event listeners
        const viewFileBtn = resultCard.querySelector('.view-file-btn');
        viewFileBtn.addEventListener('click', () => {
            viewFile(repoName, filePath, fileUrl, file.content);
        });
        
        const copyPathBtn = resultCard.querySelector('.copy-path-btn');
        copyPathBtn.addEventListener('click', (e) => {
            const path = e.currentTarget.dataset.path;
            navigator.clipboard.writeText(path)
                .then(() => showToast('success', 'Copied!', `${path} copied to clipboard`))
                .catch(() => showToast('error', 'Error', 'Failed to copy path'));
        });
        
        return resultCard;
    }
    
    function applyHighlights(text, highlights) {
        // Escape HTML in the original text
        const escapedText = escapeHTML(text);
        
        // Sort highlights by offset in descending order to avoid position shifts
        const sortedHighlights = [...highlights].sort((a, b) => b[0] - a[0]);
        
        // Apply highlights from end to start
        let highlightedText = escapedText;
        for (const [offset, length] of sortedHighlights) {
            const beforeHighlight = highlightedText.substring(0, offset);
            const highlighted = highlightedText.substring(offset, offset + length);
            const afterHighlight = highlightedText.substring(offset + length);
            
            highlightedText = beforeHighlight + 
                              `<span class="highlight">${highlighted}</span>` + 
                              afterHighlight;
        }
        
        return highlightedText;
    }
    
    function escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function viewFile(repoName, filePath, fileUrl, content) {
        // Prepare the content
        const fileExtension = filePath.split('.').pop().toLowerCase();
        const fileName = filePath.split('/').pop();
        
        // Update modal elements
        elements.previewFileName.textContent = fileName;
        elements.previewRepoPath.textContent = repoName;
        elements.openInSourcegraph.href = fileUrl;
        
        // Store file path for copying
        elements.copyFilePathBtn.dataset.path = `${repoName}/${filePath}`;
        
        // Set up the code preview with syntax highlighting
        if (content) {
            let codeHTML = `<pre><code class="language-${fileExtension}">${escapeHTML(content)}</code></pre>`;
            elements.codePreview.innerHTML = codeHTML;
            
            // Apply syntax highlighting
            document.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        } else {
            elements.codePreview.innerHTML = '<div class="empty-state"><i class="fas fa-file-alt"></i><p>Content not available for preview</p></div>';
        }
        
        // Show the modal
        showModal(elements.codePreviewModal);
    }
    
    function updatePagination() {
        const totalPages = Math.ceil(appState.totalResults / appState.resultsPerPage);
        
        if (totalPages <= 1) {
            elements.pagination.classList.add('hidden');
            return;
        }
        
        elements.pagination.classList.remove('hidden');
        elements.pagination.innerHTML = '';
        
        // Previous button
        const prevBtn = document.createElement('button');
        prevBtn.className = 'page-btn';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.disabled = appState.currentPage === 1;
        prevBtn.addEventListener('click', () => {
            if (appState.currentPage > 1) {
                appState.currentPage--;
                performSearch();
            }
        });
        elements.pagination.appendChild(prevBtn);
        
        // Page buttons
        const maxButtons = 5;
        const startPage = Math.max(1, appState.currentPage - Math.floor(maxButtons / 2));
        const endPage = Math.min(totalPages, startPage + maxButtons - 1);
        
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = 'page-btn' + (i === appState.currentPage ? ' active' : '');
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', () => {
                appState.currentPage = i;
                performSearch();
            });
            elements.pagination.appendChild(pageBtn);
        }
        
        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.className = 'page-btn';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.disabled = appState.currentPage === totalPages;
        nextBtn.addEventListener('click', () => {
            if (appState.currentPage < totalPages) {
                appState.currentPage++;
                performSearch();
            }
        });
        elements.pagination.appendChild(nextBtn);
    }
    
    function updateSearchTags(params) {
        elements.searchTags.innerHTML = '';
        
        // Add tags for each active filter
        if (params.language) {
            addSearchTag('Language: ' + params.language.replace('lang:', ''), () => {
                elements.languageFilter.value = '';
                performSearch();
            });
        }
        
        if (params.repository) {
            addSearchTag('Repository: ' + params.repository, () => {
                elements.repoFilter.value = '';
                performSearch();
            });
        }
        
        if (params.patternType !== 'literal') {
            addSearchTag('Pattern: ' + params.patternType, () => {
                elements.patternType.value = 'literal';
                performSearch();
            });
        }
        
        if (params.caseSensitive) {
            addSearchTag('Case sensitive', () => {
                elements.caseSensitive.checked = false;
                performSearch();
            });
        }
    }
    
    function addSearchTag(text, removeCallback) {
        const tag = document.createElement('div');
        tag.className = 'search-tag';
        tag.innerHTML = `
            ${text}
            <i class="fas fa-times"></i>
        `;
        
        tag.querySelector('i').addEventListener('click', removeCallback);
        elements.searchTags.appendChild(tag);
    }
    
    function switchView(view, performSwitch = true) {
        if (view === 'grid') {
            elements.resultsContainer.classList.remove('list-view');
            elements.resultsContainer.classList.add('grid-view');
            elements.listView.classList.remove('active');
            elements.gridView.classList.add('active');
        } else {
            elements.resultsContainer.classList.remove('grid-view');
            elements.resultsContainer.classList.add('list-view');
            elements.listView.classList.add('active');
            elements.gridView.classList.remove('active');
        }
    }
    
    function sortResults() {
        // This would re-fetch or re-sort the current results
        // For now, just re-perform the search
        performSearch();
    }
    
    function toggleAdvancedOptions() {
        elements.advancedOptions.classList.toggle('hidden');
        
        // Update button icon
        const icon = elements.advancedOptionsToggle.querySelector('i');
        if (elements.advancedOptions.classList.contains('hidden')) {
            icon.className = 'fas fa-sliders-h';
        } else {
            icon.className = 'fas fa-chevron-up';
        }
    }
    
    function clearSearch() {
        elements.searchQuery.value = '';
        elements.languageFilter.value = '';
        elements.repoFilter.value = '';
        elements.patternType.value = 'literal';
        elements.resultsLimit.value = appState.settings.defaultResultsLimit;
        elements.caseSensitive.checked = appState.settings.defaultCaseSensitive;
        elements.includeContext.checked = appState.settings.defaultIncludeContext;
        
        elements.searchTags.innerHTML = '';
        elements.results.innerHTML = '';
        elements.resultsStats.textContent = '';
        elements.pagination.classList.add('hidden');
        elements.emptyState.classList.remove('hidden');
        
        // Focus the search input
        elements.searchQuery.focus();
    }
    
    function addToSearchHistory(searchParams) {
        // Remove duplicates
        appState.searchHistory = appState.searchHistory.filter(item => 
            item.query !== searchParams.query || 
            item.language !== searchParams.language || 
            item.repository !== searchParams.repository || 
            item.patternType !== searchParams.patternType || 
            item.caseSensitive !== searchParams.caseSensitive
        );
        
        // Add new item to the beginning
        appState.searchHistory.unshift(searchParams);
        
        // Limit history size
        if (appState.searchHistory.length > 20) {
            appState.searchHistory.pop();
        }
        
        // Update local storage
        localStorage.setItem('searchHistory', JSON.stringify(appState.searchHistory));
        
        // Update UI
        updateSearchHistoryUI();
    }
    
    function updateSearchHistoryUI() {
        elements.searchHistory.innerHTML = '';
        
        if (appState.searchHistory.length === 0) {
            elements.searchHistory.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-
